'use strict';

const https  = require('https');
const Sentry = require('@sentry/node');

// Posts a message to the configured Slack channel via the Web API
function postSlackMessage(text) {
  const token     = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;

  if (!token || !channelId) return;

  const body = JSON.stringify({ channel: channelId, text });

  const options = {
    hostname: 'slack.com',
    path:     '/api/chat.postMessage',
    method:   'POST',
    headers: {
      'Content-Type':  'application/json; charset=utf-8',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (!parsed.ok) {
          console.error(`[slack] chat.postMessage failed  error=${parsed.error}`);
        }
      } catch {
        // ignore parse errors on Slack response
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[slack] request failed  error=${err.message}`);
    Sentry.captureException(err);
  });

  req.write(body);
  req.end();
}

// Sends a Slack message when a new alert/incident is created
function notifyAlertCreated(incident) {
  const text = [
    `:red_circle: *New Alert Fired*`,
    `• *Metric:* ${incident.metric_name}`,
    `• *Threshold:* ${incident.threshold_value}`,
    `• *State:* ${incident.state}`,
    `• *Priority:* ${incident.priority}`,
    `• *Incident ID:* ${incident.id}`,
    `• *Started At:* ${incident.started_at}`,
  ].join('\n');

  postSlackMessage(text);
}

// Sends a Slack message when an alert/incident is marked resolved
function notifyAlertResolved(incident, resolvedByName) {
  const text = [
    `:white_check_mark: *Alert Resolved*`,
    `• *Incident ID:* ${incident.id}`,
    `• *Resolved At:* ${incident.resolved_at}`,
    `• *Resolved By:* ${resolvedByName}`,
  ].join('\n');

  postSlackMessage(text);
}

module.exports = { notifyAlertCreated, notifyAlertResolved };
