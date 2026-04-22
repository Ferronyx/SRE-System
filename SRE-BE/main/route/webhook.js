'use strict';

/**
 * Webhook routes — receives SNS notifications from CloudWatch Alarms.
 *
 * Purpose: SNS calls this endpoint when a CloudWatch Alarm fires or recovers.
 *          Auto-confirms the SNS subscription on first call.
 *          Creates an incident record when alarm state = ALARM | INSUFFICIENT_DATA.
 *
 * POST /webhooks/cloudwatch
 *      Input: SNS notification body (text/plain JSON, no auth — called by AWS SNS)
 *      Response: { status: 1 }
 */

const express    = require('express');
const https      = require('https');
const router     = express.Router();
const Sentry     = require('@sentry/node');
const db         = require('../db');
const asyncHandler = require('../lib/asyncHandler');
const { createIncident } = require('../service/incident');
const { notifyAlertCreated } = require('../lib/slack');

// SNS sends Content-Type: text/plain — parse it as text for this router only
router.use(express.text({ type: '*/*' }));

// POST /webhooks/cloudwatch
router.post(
  '/cloudwatch',
  asyncHandler(async (req, res) => {
    // Parse the body — SNS sends raw JSON as text/plain
    let payload;
    try {
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ status: 0, error: 'Invalid body.' });
    }

    const messageType = payload.Type || req.headers['x-amz-sns-message-type'];

    // Step 1 — Auto-confirm SNS subscription on first delivery
    if (messageType === 'SubscriptionConfirmation') {
      const confirmUrl = payload.SubscribeURL;
      if (!confirmUrl) {
        return res.status(400).json({ status: 0, error: 'Missing SubscribeURL.' });
      }

      // Hit the SubscribeURL to complete the subscription handshake
      https.get(confirmUrl, () => {}).on('error', (err) => {
        console.error(`[webhook] SNS subscription confirm failed  error=${err.message}`);
        Sentry.captureException(err);
      });

      return res.status(200).json({ status: 1, message: 'Subscription confirmed.' });
    }

    // Step 2 — Handle alarm state change notification
    if (messageType === 'Notification') {
      let message;
      try {
        message = JSON.parse(payload.Message);
      } catch {
        return res.status(400).json({ status: 0, error: 'Invalid message content.' });
      }

      const alarmName = message.AlarmName;     // e.g. sre-{thresholdId}
      const newState  = message.NewStateValue; // ALARM | OK | INSUFFICIENT_DATA
      const alarmArn  = message.AlarmArn;

      // Only process alarms created by this system (prefixed with sre-)
      if (!alarmName || !alarmName.startsWith('sre-')) {
        return res.status(200).json({ status: 1 });
      }

      const thresholdId = alarmName.replace('sre-', '');

      const threshold = await db('alert_thresholds')
        .where({ id: thresholdId })
        .whereNull('deleted_at')
        .first();

      if (!threshold) {
        return res.status(200).json({ status: 1 });
      }

      // Create incident when alarm fires (ALARM or INSUFFICIENT_DATA)
      if (newState === 'ALARM' || newState === 'INSUFFICIENT_DATA') {
        try {
          const incident = await createIncident({
            resourceId:     threshold.resource_id,
            thresholdId:    threshold.id,
            metricName:     threshold.metric_name,
            thresholdValue: threshold.threshold_value,
            alarmArn,
            state:          newState,
            rawPayload:     message,
          });
          notifyAlertCreated(incident);
        } catch (err) {
          console.error(`[webhook] incident creation failed  thresholdId=${thresholdId}  error=${err.message}`);
          Sentry.captureException(err);
          // Still return 200 so SNS does not retry — incident failure should not block SNS
          return res.status(200).json({ status: 1 });
        }
      }

      // OK state — auto-close is a future feature (reserved)

      return res.status(200).json({ status: 1 });
    }

    // Unknown message type — acknowledge to prevent SNS retries
    res.status(200).json({ status: 1 });
  })
);

module.exports = router;
