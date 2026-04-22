'use strict';

/**
 * Threshold routes — manage alert thresholds for a resource.
 *
 * Purpose: Let users view, add, and modify per-resource alert thresholds.
 *          Saving or adding a threshold creates/updates a live CloudWatch Alarm in AWS.
 *
 * GET    /cloud-accounts/:accountId/resources/:resourceId/thresholds
 *        Input: none | Response: { status, data: threshold[] }
 *
 * GET    /cloud-accounts/:accountId/resources/:resourceId/thresholds/available
 *        Input: none | Response: { status, data: thresholdDefinition[] }
 *        Returns metric definitions from the catalog that have no DB row yet.
 *
 * POST   /cloud-accounts/:accountId/resources/:resourceId/thresholds
 *        Input: { metric_name* } | Response: { status, data: threshold }
 *        Inserts a threshold from defaults and creates a CloudWatch alarm in AWS.
 *
 * PATCH  /cloud-accounts/:accountId/resources/:resourceId/thresholds/:thresholdId
 *        Input: { threshold_value* (required), operator?, evaluation_periods?, period? }
 *        Response: { status, data: threshold }
 *
 * DELETE /cloud-accounts/:accountId/resources/:resourceId/thresholds/:thresholdId
 *        Input: none | Response: { status, message }
 */

const router  = require('express').Router({ mergeParams: true });
const { authenticate } = require('../middleware');
const { decrypt }      = require('../lib/crypto');
const db               = require('../db');
const { listThresholds, updateThreshold, deleteThreshold, setAlarmInfo, listAvailableThresholds, createThreshold } = require('../service/threshold');
const { ensureSnsTopic, ensureSnsSubscription, putCloudWatchAlarm, deleteCloudWatchAlarm } = require('../lib/aws/cloudwatchAlarm');

const asyncHandler = require('../lib/asyncHandler');
const { buildAwsCredentials } = require('../lib/aws/credentials');

// Verify the user belongs to the org that owns this cloud account
async function verifyAccountOwnership(req, res, next) {
  const account = await db('cloud_accounts')
    .where({ id: req.params.accountId })
    .whereNull('deleted_at')
    .first();

  if (!account) return res.status(404).json({ status: 0, error: 'Cloud account not found.' });

  const membership = await db('org_members')
    .where({ org_id: account.org_id, user_id: req.user.id })
    .first();

  if (!membership) return res.status(403).json({ status: 0, error: 'Access denied.' });

  req.cloudAccount = account;
  next();
}

// GET /cloud-accounts/:accountId/resources/:resourceId/thresholds
router.get(
  '/',
  authenticate,
  asyncHandler(verifyAccountOwnership),
  asyncHandler(async (req, res) => {
    const { resourceId } = req.params;
    console.log(`[route] GET /thresholds  resourceId=${resourceId}`);

    const thresholds = await listThresholds(resourceId, req.cloudAccount.org_id);
    res.status(200).json({ status: 1, data: thresholds });
  })
);

// GET /cloud-accounts/:accountId/resources/:resourceId/thresholds/available
router.get(
  '/available',
  authenticate,
  asyncHandler(verifyAccountOwnership),
  asyncHandler(async (req, res) => {
    const { resourceId } = req.params;
    console.log(`[route] GET /thresholds/available  resourceId=${resourceId}`);

    const available = await listAvailableThresholds(resourceId, req.cloudAccount.org_id);
    res.status(200).json({ status: 1, data: available });
  })
);

// POST /cloud-accounts/:accountId/resources/:resourceId/thresholds
// metric_name — required: the metric to add (must exist in DEFAULT_THRESHOLDS for this resource's service)
router.post(
  '/',
  authenticate,
  asyncHandler(verifyAccountOwnership),
  asyncHandler(async (req, res) => {
    const { accountId, resourceId } = req.params;

    // metric_name — required
    const { metric_name } = req.body;
    if (!metric_name || typeof metric_name !== 'string' || !metric_name.trim()) {
      return res.status(400).json({ status: 0, error: 'metric_name is required.' });
    }

    console.log(`[route] POST /thresholds  resourceId=${resourceId}  metric_name=${metric_name}`);

    const { resource, threshold } = await createThreshold(
      resourceId,
      req.cloudAccount.org_id,
      metric_name.trim(),
      req.user.id
    );

    // CloudWatch alarm creation requires a public WEBHOOK_URL for SNS delivery
    const WEBHOOK_URL = process.env.WEBHOOK_URL;
    if (!WEBHOOK_URL) {
      console.warn('[thresholds] WEBHOOK_URL not set — threshold saved but CloudWatch alarm not created');
      return res.status(201).json({ status: 1, data: threshold });
    }

    const creds    = JSON.parse(decrypt(req.cloudAccount.encrypted_creds));
    const awsCreds = buildAwsCredentials(req.cloudAccount.auth_type, creds, resource.region);

    // One SNS topic per cloud account — created if it doesn't exist yet
    const snsTopicArn = await ensureSnsTopic(awsCreds, accountId);
    await ensureSnsSubscription(awsCreds, snsTopicArn, WEBHOOK_URL);

    const alarmName = await putCloudWatchAlarm(awsCreds, resource, threshold, snsTopicArn);
    await setAlarmInfo(threshold.id, alarmName, snsTopicArn);

    res.status(201).json({
      status: 1,
      data: { ...threshold, alarm_name: alarmName, sns_topic_arn: snsTopicArn },
    });
  })
);

// PATCH /cloud-accounts/:accountId/resources/:resourceId/thresholds/:thresholdId
// threshold_value: new numeric value to trigger the alarm (required)
// operator: comparison direction (optional)
// evaluation_periods: consecutive periods before alarm fires (optional)
// period: sampling interval in seconds (optional)
router.patch(
  '/:thresholdId',
  authenticate,
  asyncHandler(verifyAccountOwnership),
  asyncHandler(async (req, res) => {
    const { accountId, resourceId, thresholdId } = req.params;

    // threshold_value — required: the new value to trigger the alarm
    // operator        — optional: GreaterThanThreshold | LessThanThreshold | etc.
    // evaluation_periods — optional: consecutive periods before alarm fires
    // period          — optional: sampling interval in seconds (e.g. 300)
    const { threshold_value, operator, evaluation_periods, period } = req.body;

    if (threshold_value === undefined) {
      return res.status(400).json({ status: 0, error: 'threshold_value is required.' });
    }

    console.log(`[route] PATCH /thresholds/${thresholdId}  resourceId=${resourceId}  value=${threshold_value}`);

    const { resource, threshold } = await updateThreshold(
      thresholdId,
      resourceId,
      req.cloudAccount.org_id,
      { threshold_value, operator, evaluation_periods, period },
      req.user.id
    );

    // CloudWatch alarm creation requires a public WEBHOOK_URL for SNS delivery
    const WEBHOOK_URL = process.env.WEBHOOK_URL;
    if (!WEBHOOK_URL) {
      console.warn('[thresholds] WEBHOOK_URL not set — threshold saved but CloudWatch alarm not created');
      return res.status(200).json({ status: 1, data: threshold });
    }

    const creds    = JSON.parse(decrypt(req.cloudAccount.encrypted_creds));
    const awsCreds = buildAwsCredentials(req.cloudAccount.auth_type, creds, resource.region);

    // One SNS topic per cloud account — created if it doesn't exist yet
    const snsTopicArn = await ensureSnsTopic(awsCreds, accountId);
    await ensureSnsSubscription(awsCreds, snsTopicArn, WEBHOOK_URL);

    const alarmName = await putCloudWatchAlarm(awsCreds, resource, threshold, snsTopicArn);
    await setAlarmInfo(thresholdId, alarmName, snsTopicArn);

    res.status(200).json({
      status: 1,
      data: { ...threshold, alarm_name: alarmName, sns_topic_arn: snsTopicArn },
    });
  })
);

// DELETE /cloud-accounts/:accountId/resources/:resourceId/thresholds/:thresholdId
router.delete(
  '/:thresholdId',
  authenticate,
  asyncHandler(verifyAccountOwnership),
  asyncHandler(async (req, res) => {
    const { resourceId, thresholdId } = req.params;
    console.log(`[route] DELETE /thresholds/${thresholdId}  resourceId=${resourceId}`);

    const { resource, threshold } = await deleteThreshold(
      thresholdId,
      resourceId,
      req.cloudAccount.org_id
    );

    // Delete the CloudWatch alarm if one was created for this threshold
    if (threshold.alarm_name) {
      try {
        const creds    = JSON.parse(decrypt(req.cloudAccount.encrypted_creds));
        const awsCreds = buildAwsCredentials(req.cloudAccount.auth_type, creds, resource.region);
        await deleteCloudWatchAlarm(awsCreds, threshold.alarm_name);
      } catch (err) {
        // Log but don't fail — threshold is already soft-deleted in DB
        console.error(`[thresholds] failed to delete CloudWatch alarm  alarm=${threshold.alarm_name}  error=${err.message}`);
      }
    }

    res.status(200).json({ status: 1, message: 'Threshold deleted.' });
  })
);

module.exports = router;
