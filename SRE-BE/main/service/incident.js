'use strict';

const db = require('../db');

/**
 * Create an incident record when a CloudWatch alarm fires.
 * Inherits assigned_to and priority from the previous incident with the same alarm_arn, if one exists.
 *
 * @param {{ resourceId, thresholdId, metricName, thresholdValue, alarmArn, state, rawPayload }}
 */
async function createIncident({ resourceId, thresholdId, metricName, thresholdValue, alarmArn, state, rawPayload }) {
  // Inherit assigned_to and priority from the last incident with the same alarm_arn
  let assignedTo = null;
  let priority = 'high';

  if (alarmArn) {
    const prev = await db('incidents')
      .where({ alarm_arn: alarmArn })
      .orderBy('created_at', 'desc')
      .select('assigned_to', 'priority')
      .first();

    if (prev) {
      assignedTo = prev.assigned_to;
      priority   = prev.priority;
    }
  }

  const [incident] = await db('incidents')
    .insert({
      resource_id:     resourceId,
      threshold_id:    thresholdId,
      metric_name:     metricName,
      threshold_value: thresholdValue,
      alarm_arn:       alarmArn,
      state,
      status:          'open',
      assigned_to:     assignedTo,
      priority,
      started_at:      db.fn.now(),
      raw_payload:     JSON.stringify(rawPayload || {}),
    })
    .returning(['id', 'resource_id', 'metric_name', 'threshold_value', 'state', 'status', 'assigned_to', 'priority', 'started_at', 'created_at']);

  return incident;
}

/**
 * List incidents for a resource, newest first.
 * Includes ownership check via org_id.
 *
 * @param {string} resourceId
 * @param {string} orgId
 */
async function listIncidents(resourceId, orgId) {
  const resource = await db('resources')
    .where({ id: resourceId, org_id: orgId })
    .whereNull('deleted_at')
    .first();

  if (!resource) {
    const err = new Error('Resource not found.');
    err.status = 404;
    throw err;
  }

  return db('incidents')
    .where({ resource_id: resourceId })
    .orderBy('started_at', 'desc')
    .select('id', 'metric_name', 'threshold_value', 'alarm_arn', 'state', 'status', 'assigned_to', 'priority', 'started_at', 'resolved_at', 'created_at');
}

/**
 * List all incidents across every resource in an org, newest first.
 * Joins resources + cloud_accounts to provide context for each incident.
 *
 * @param {string} orgId
 * @param {{ limit: number, offset: number, status?: 'open'|'resolved' }} opts
 */
async function listOrgIncidents(orgId, { limit = 20, offset = 0, status } = {}) {
  const query = db('incidents as i')
    .join('resources as r',       'i.resource_id',       'r.id')
    .join('cloud_accounts as ca', 'r.cloud_account_id',  'ca.id')
    .where('ca.org_id', orgId)
    .whereNull('ca.deleted_at')
    .whereNull('r.deleted_at');

  // Filter by incident status when provided
  if (status) query.where('i.status', status);

  const [{ count }] = await query.clone().count('i.id as count');
  const total = parseInt(count, 10);

  const rows = await query
    .orderBy('i.started_at', 'desc')
    .limit(limit)
    .offset(offset)
    .select(
      'i.id',
      'i.metric_name',
      'i.threshold_value',
      'i.state',
      'i.status',
      'i.priority',
      'i.assigned_to',
      'i.started_at',
      'i.resolved_at',
      'i.created_at',
      'r.id         as resource_id',
      'r.name       as resource_name',
      'r.service    as resource_service',
      'r.region     as resource_region',
      'ca.id        as cloud_account_id',
      'ca.name      as account_name'
    );

  return {
    data: rows,
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  };
}

/**
 * Get a single incident by id with full detail including raw CloudWatch payload.
 * Ownership check via org_id through the resource → cloud_account chain.
 *
 * @param {string} incidentId
 * @param {string} orgId
 */
async function getIncidentById(incidentId, orgId) {
  const row = await db('incidents as i')
    .join('resources as r',       'i.resource_id',       'r.id')
    .join('cloud_accounts as ca', 'r.cloud_account_id',  'ca.id')
    .where('i.id', incidentId)
    .where('ca.org_id', orgId)
    .whereNull('ca.deleted_at')
    .whereNull('r.deleted_at')
    .select(
      'i.id',
      'i.metric_name',
      'i.threshold_value',
      'i.alarm_arn',
      'i.state',
      'i.started_at',
      'i.resolved_at',
      'i.raw_payload',
      'i.created_at',
      'r.id         as resource_id',
      'r.name       as resource_name',
      'r.service    as resource_service',
      'r.region     as resource_region',
      'ca.id        as cloud_account_id',
      'ca.name      as account_name'
    )
    .first();

  if (!row) {
    const err = new Error('Incident not found.');
    err.status = 404;
    throw err;
  }

  return row;
}

/**
 * Mark an incident as resolved and set resolved_at timestamp.
 *
 * @param {string} incidentId
 * @param {string} orgId
 */
async function resolveIncident(incidentId, orgId) {
  // Ownership check — will throw 404 if not found or not in org
  await getIncidentById(incidentId, orgId);

  const [updated] = await db('incidents')
    .where({ id: incidentId })
    .update({ status: 'resolved', resolved_at: db.fn.now() })
    .returning(['id', 'status', 'resolved_at']);

  return updated;
}

/**
 * Update assignee and/or priority on an incident.
 *
 * @param {string} incidentId
 * @param {string} orgId
 * @param {{ assignedTo?: string, priority?: string }} updates
 */
async function updateIncidentConfig(incidentId, orgId, { assignedTo, priority }) {
  // Ownership check — will throw 404 if not found or not in org
  await getIncidentById(incidentId, orgId);

  const changes = {};
  if (assignedTo !== undefined) changes.assigned_to = assignedTo;
  if (priority   !== undefined) changes.priority     = priority;

  const [updated] = await db('incidents')
    .where({ id: incidentId })
    .update(changes)
    .returning(['id', 'assigned_to', 'priority', 'status']);

  return updated;
}

module.exports = { createIncident, listIncidents, listOrgIncidents, getIncidentById, resolveIncident, updateIncidentConfig };
