'use strict';

const db = require('../db');
const { DEFAULT_THRESHOLDS } = require('../lib/aws/defaultThresholds');
const { listCloudWatchAlarms, ensureSnsTopic, ensureSnsSubscription, attachSnsTopicToAlarm } = require('../lib/aws/cloudwatchAlarm');

// Reverse map: AWS namespace → { dimensionName, getValue(resource) }
// Mirrors the ALARM_CONFIGS in lib/aws/cloudwatchAlarm.js
const NAMESPACE_TO_DIMENSION = {
  'AWS/EC2':            { name: 'InstanceId',           getValue: (r) => r.external_id },
  'AWS/RDS':            { name: 'DBInstanceIdentifier', getValue: (r) => r.external_id },
  'AWS/Lambda':         { name: 'FunctionName',         getValue: (r) => r.name },
  'AWS/ApplicationELB': { name: 'LoadBalancer',         getValue: (r) => r.external_id.split(':loadbalancer/')[1] },
};

/**
 * Seed default thresholds for newly synced resources.
 * Uses onConflict ignore so user-modified thresholds are never overwritten on re-sync.
 *
 * @param {Array<{ id: string, service: string }>} resources
 */
async function seedDefaultThresholds(resources) {
  if (!resources || resources.length === 0) return;

  const now = new Date().toISOString();
  const rows = [];

  for (const resource of resources) {
    const defaults = DEFAULT_THRESHOLDS[resource.service];
    if (!defaults) continue; // S3 has no defaults

    for (const tpl of defaults) {
      rows.push({
        resource_id:        resource.id,
        metric_name:        tpl.metric_name,
        operator:           tpl.operator,
        threshold_value:    tpl.threshold_value,
        evaluation_periods: tpl.evaluation_periods,
        period:             tpl.period,
        is_default:         true,
        created_at:         now,
        updated_at:         now,
      });
    }
  }

  if (rows.length === 0) return;

  await db('alert_thresholds').insert(rows).onConflict(['resource_id', 'metric_name']).ignore(); // never overwrite user-modified thresholds

  console.log(`[thresholds] seeded ${rows.length} defaults for ${resources.length} resources`);
}

/**
 * List all active thresholds for a resource.
 * Includes ownership check via org_id.
 *
 * @param {string} resourceId
 * @param {string} orgId
 */
async function listThresholds(resourceId, orgId) {
  const resource = await db('resources')
    .where({ id: resourceId, org_id: orgId })
    .whereNull('deleted_at')
    .first();

  if (!resource) {
    const err = new Error('Resource not found.');
    err.status = 404;
    throw err;
  }

  return db('alert_thresholds')
    .where({ resource_id: resourceId })
    .whereNull('deleted_at')
    .orderBy('metric_name', 'asc')
    .select('id', 'metric_name', 'operator', 'threshold_value', 'evaluation_periods',
            'period', 'alarm_name', 'sns_topic_arn', 'is_default', 'created_at', 'updated_at');
}

/**
 * Update a threshold with user-supplied values. Marks it as no longer a default.
 * Returns the full resource row (for alarm creation) and the updated threshold row.
 *
 * @param {string} thresholdId
 * @param {string} resourceId
 * @param {string} orgId
 * @param {{ threshold_value?, operator?, evaluation_periods?, period? }} updates
 * @param {string} userId
 */
async function updateThreshold(thresholdId, resourceId, orgId, updates, userId) {
  const resource = await db('resources')
    .where({ id: resourceId, org_id: orgId })
    .whereNull('deleted_at')
    .first();

  if (!resource) {
    const err = new Error('Resource not found.');
    err.status = 404;
    throw err;
  }

  const threshold = await db('alert_thresholds')
    .where({ id: thresholdId, resource_id: resourceId })
    .whereNull('deleted_at')
    .first();

  if (!threshold) {
    const err = new Error('Threshold not found.');
    err.status = 404;
    throw err;
  }

  // Only allow updating these fields
  const allowed = {};
  if (updates.threshold_value   !== undefined) allowed.threshold_value   = updates.threshold_value;
  if (updates.operator          !== undefined) allowed.operator          = updates.operator;
  if (updates.evaluation_periods !== undefined) allowed.evaluation_periods = updates.evaluation_periods;
  if (updates.period            !== undefined) allowed.period            = updates.period;

  const [updated] = await db('alert_thresholds')
    .where({ id: thresholdId })
    .update({ ...allowed, is_default: false, created_by: userId, updated_at: db.fn.now() })
    .returning('*');

  return { resource, threshold: updated };
}

/**
 * Soft-delete a threshold.
 * Returns resource and threshold rows (caller needs them to delete the CloudWatch alarm).
 *
 * @param {string} thresholdId
 * @param {string} resourceId
 * @param {string} orgId
 */
async function deleteThreshold(thresholdId, resourceId, orgId) {
  const resource = await db('resources')
    .where({ id: resourceId, org_id: orgId })
    .whereNull('deleted_at')
    .first();

  if (!resource) {
    const err = new Error('Resource not found.');
    err.status = 404;
    throw err;
  }

  const threshold = await db('alert_thresholds')
    .where({ id: thresholdId, resource_id: resourceId })
    .whereNull('deleted_at')
    .first();

  if (!threshold) {
    const err = new Error('Threshold not found.');
    err.status = 404;
    throw err;
  }

  await db('alert_thresholds')
    .where({ id: thresholdId })
    .update({ deleted_at: db.fn.now(), updated_at: db.fn.now() });

  return { resource, threshold };
}

/**
 * Store the CloudWatch alarm name + SNS topic ARN on a threshold record
 * after the alarm has been successfully created in AWS.
 *
 * @param {string} thresholdId
 * @param {string} alarmName
 * @param {string} snsTopicArn
 */
async function setAlarmInfo(thresholdId, alarmName, snsTopicArn) {
  await db('alert_thresholds')
    .where({ id: thresholdId })
    .update({ alarm_name: alarmName, sns_topic_arn: snsTopicArn, updated_at: db.fn.now() });
}

/**
 * Pulls all CloudWatch alarms for a region and syncs them into alert_thresholds.
 * New alarms (exist in AWS, not in DB) are inserted.
 * Changed alarms (values differ from DB) are updated.
 * Ensures an SNS topic exists and attaches it to any alarm that is missing it.
 *
 * @param {object} awsCreds       — credentials for a specific region
 * @param {Array}  resources      — resource rows for that region: { id, service, external_id, name }
 * @param {string} cloudAccountId — used to name the SNS topic
 */
async function syncAlarmsFromAws(awsCreds, resources, cloudAccountId) {
  if (!resources || resources.length === 0) return;

  const alarms = await listCloudWatchAlarms(awsCreds);
  if (alarms.length === 0) return;

  // Ensure SNS topic exists and webhook is subscribed
  const webhookUrl = process.env.WEBHOOK_URL;
  let snsTopicArn  = null;

  if (webhookUrl) {
    snsTopicArn = await ensureSnsTopic(awsCreds, cloudAccountId);
    await ensureSnsSubscription(awsCreds, snsTopicArn, `${webhookUrl}`);
  }

  // Build lookup: namespace → (dimensionValue → resource row)
  const resourceMap = new Map();
  for (const [ns, cfg] of Object.entries(NAMESPACE_TO_DIMENSION)) {
    const nsMap = new Map();
    for (const r of resources) {
      try {
        const val = cfg.getValue(r);
        if (val) nsMap.set(val, r);
      } catch (_) {
        // skip resources where dimension extraction fails (e.g. ELB external_id missing suffix)
      }
    }
    resourceMap.set(ns, nsMap);
  }

  // Load all existing thresholds for these resources in one query
  const resourceIds      = resources.map((r) => r.id);
  const existingInDb     = await db('alert_thresholds')
    .whereIn('resource_id', resourceIds)
    .whereNull('deleted_at')
    .select('id', 'resource_id', 'metric_name', 'threshold_value', 'operator', 'evaluation_periods', 'period', 'alarm_name', 'sns_topic_arn');

  // Build lookup: "resourceId::metricName" → threshold row
  const thresholdMap = new Map();
  for (const t of existingInDb) {
    thresholdMap.set(`${t.resource_id}::${t.metric_name}`, t);
  }

  const now      = new Date().toISOString();
  const toInsert = [];
  const toUpdate = [];

  for (const alarm of alarms) {
    const dimCfg = NAMESPACE_TO_DIMENSION[alarm.Namespace];
    if (!dimCfg) continue;

    const nsMap = resourceMap.get(alarm.Namespace);
    if (!nsMap) continue;

    const dim = (alarm.Dimensions || []).find((d) => d.Name === dimCfg.name);
    if (!dim) continue;

    const resource = nsMap.get(dim.Value);
    if (!resource) continue; // alarm belongs to a resource not in our DB

    // Use the synced SNS topic ARN if we created/fetched one, else fall back to whatever the alarm has
    const alarmSnsArn = snsTopicArn || (alarm.AlarmActions || [])[0] || null;

    // If we have an SNS topic and the alarm is missing it, attach it in AWS
    if (snsTopicArn && !(alarm.AlarmActions || []).includes(snsTopicArn)) {
      try {
        await attachSnsTopicToAlarm(awsCreds, alarm, snsTopicArn);
      } catch (err) {
        console.error(`[alarmSync] failed to attach SNS to alarm=${alarm.AlarmName}  error=${err.message}`);
      }
    }

    const key            = `${resource.id}::${alarm.MetricName}`;
    const existingRecord = thresholdMap.get(key);

    if (!existingRecord) {
      toInsert.push({
        resource_id:        resource.id,
        metric_name:        alarm.MetricName,
        operator:           alarm.ComparisonOperator,
        threshold_value:    alarm.Threshold,
        evaluation_periods: alarm.EvaluationPeriods,
        period:             alarm.Period,
        alarm_name:         alarm.AlarmName,
        sns_topic_arn:      alarmSnsArn,
        is_default:         false,
        created_at:         now,
        updated_at:         now,
      });
    } else {
      // Check if any value has changed in AWS
      const changed =
        existingRecord.threshold_value    !== alarm.Threshold             ||
        existingRecord.operator           !== alarm.ComparisonOperator    ||
        existingRecord.evaluation_periods !== alarm.EvaluationPeriods     ||
        existingRecord.period             !== alarm.Period                 ||
        existingRecord.alarm_name         !== alarm.AlarmName             ||
        (snsTopicArn && existingRecord.sns_topic_arn !== snsTopicArn);

      if (changed) {
        toUpdate.push({
          id:                 existingRecord.id,
          threshold_value:    alarm.Threshold,
          operator:           alarm.ComparisonOperator,
          evaluation_periods: alarm.EvaluationPeriods,
          period:             alarm.Period,
          alarm_name:         alarm.AlarmName,
          ...(snsTopicArn ? { sns_topic_arn: snsTopicArn } : {}),
          updated_at:         now,
        });
      }
    }
  }

  if (toInsert.length > 0) {
    await db('alert_thresholds')
      .insert(toInsert)
      .onConflict(['resource_id', 'metric_name'])
      .merge(['threshold_value', 'operator', 'evaluation_periods', 'period', 'alarm_name', 'sns_topic_arn', 'updated_at']);
  }

  for (const { id, ...changes } of toUpdate) {
    await db('alert_thresholds').where({ id }).update(changes);
  }

  console.log(`[alarmSync] inserted=${toInsert.length} updated=${toUpdate.length}`);
}

/**
 * List metric definitions from DEFAULT_THRESHOLDS that have no DB row yet for this resource.
 *
 * @param {string} resourceId
 * @param {string} orgId
 */
async function listAvailableThresholds(resourceId, orgId) {
  const resource = await db('resources')
    .where({ id: resourceId, org_id: orgId })
    .whereNull('deleted_at')
    .first();

  if (!resource) {
    const err = new Error('Resource not found.');
    err.status = 404;
    throw err;
  }

  const defaults = DEFAULT_THRESHOLDS[resource.service];
  if (!defaults || defaults.length === 0) return [];

  // Find metric names already configured for this resource
  const existing = await db('alert_thresholds')
    .where({ resource_id: resourceId })
    .whereNull('deleted_at')
    .pluck('metric_name');

  const existingSet = new Set(existing);

  // Return default definitions not yet in DB
  return defaults.filter((t) => !existingSet.has(t.metric_name));
}

/**
 * Insert a new threshold from the DEFAULT_THRESHOLDS catalog and return resource + threshold.
 * Does not create a CloudWatch alarm — caller handles that.
 *
 * @param {string} resourceId
 * @param {string} orgId
 * @param {string} metricName
 * @param {string} userId
 */
async function createThreshold(resourceId, orgId, metricName, userId) {
  const resource = await db('resources')
    .where({ id: resourceId, org_id: orgId })
    .whereNull('deleted_at')
    .first();

  if (!resource) {
    const err = new Error('Resource not found.');
    err.status = 404;
    throw err;
  }

  const defaults = DEFAULT_THRESHOLDS[resource.service];
  const tpl = defaults && defaults.find((t) => t.metric_name === metricName);

  if (!tpl) {
    const err = new Error(`No default threshold definition found for metric "${metricName}".`);
    err.status = 400;
    throw err;
  }

  // Conflict means it already exists (not soft-deleted) — surface it as a 409
  const existing = await db('alert_thresholds')
    .where({ resource_id: resourceId, metric_name: metricName })
    .whereNull('deleted_at')
    .first();

  if (existing) {
    const err = new Error('Threshold for this metric already exists.');
    err.status = 409;
    throw err;
  }

  const [threshold] = await db('alert_thresholds')
    .insert({
      resource_id:        resourceId,
      metric_name:        tpl.metric_name,
      operator:           tpl.operator,
      threshold_value:    tpl.threshold_value,
      evaluation_periods: tpl.evaluation_periods,
      period:             tpl.period,
      is_default:         true,
      created_by:         userId,
    })
    .returning('*');

  return { resource, threshold };
}

module.exports = { seedDefaultThresholds, listThresholds, updateThreshold, deleteThreshold, setAlarmInfo, syncAlarmsFromAws, listAvailableThresholds, createThreshold };
