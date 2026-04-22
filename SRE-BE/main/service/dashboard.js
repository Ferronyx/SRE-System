'use strict';

const Sentry = require('@sentry/node');
const db = require('../db');
const { decrypt } = require('../lib/crypto');
const { buildAwsCredentials } = require('../lib/aws/credentials');
const { fetchDashboardMetrics } = require('../lib/aws/cloudwatch');

// In-memory cache keyed by orgId — avoids hammering CloudWatch on every request
const summaryCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

// Returns cached data for orgId if still valid, otherwise null
function getCached(orgId) {
  const entry = summaryCache.get(orgId);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  return null;
}

// Stores data in cache for orgId with 60s TTL
function setCached(orgId, data) {
  summaryCache.set(orgId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Merges a SUM-type metric across multiple account+region result objects into one hourly series.
// Returns [{ hourMs, value }] sorted newest-first.
function mergeSumSeries(allResults, metricId) {
  const buckets = new Map();

  for (const result of allResults) {
    const series = result[metricId];
    if (!series || !series.timestamps.length) continue;

    for (let i = 0; i < series.timestamps.length; i++) {
      const val = series.values[i];
      if (val === null || val === undefined || isNaN(val)) continue;

      // Floor to nearest hour boundary so data from different accounts aligns
      const hourMs = Math.floor(new Date(series.timestamps[i]).getTime() / 3600000) * 3600000;
      buckets.set(hourMs, (buckets.get(hourMs) || 0) + val);
    }
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([hourMs, value]) => ({ hourMs, value }));
}

// Merges ALB latency (seconds) and API GW latency (ms) into one ms series averaged per hour.
// Returns [{ hourMs, value }] sorted newest-first.
function mergeLatencySeries(allResults) {
  const buckets = new Map();

  for (const result of allResults) {
    // ALB TargetResponseTime is in seconds → convert to ms; API GW IntegrationLatency is already ms
    for (const [metricId, toMs] of [['alb_latency', 1000], ['apigw_latency', 1]]) {
      const series = result[metricId];
      if (!series || !series.timestamps.length) continue;

      for (let i = 0; i < series.timestamps.length; i++) {
        const val = series.values[i];
        if (val === null || val === undefined || isNaN(val)) continue;

        const hourMs = Math.floor(new Date(series.timestamps[i]).getTime() / 3600000) * 3600000;
        const entry = buckets.get(hourMs) || { sum: 0, count: 0 };
        entry.sum += val * toMs;
        entry.count += 1;
        buckets.set(hourMs, entry);
      }
    }
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([hourMs, { sum, count }]) => ({ hourMs, value: Math.round(sum / count) }));
}

// Computes 30-day rolling uptime from EC2 StatusCheckFailed series.
// uptime% = (1 - totalFailed / totalChecks) * 100
function computeUptime30d(ec2FailedSeries, ec2TotalSeries) {
  const totalFailed = ec2FailedSeries.reduce((acc, { value }) => acc + value, 0);
  const totalChecks = ec2TotalSeries.reduce((acc, { value }) => acc + value, 0);

  if (totalChecks === 0) return null;
  return parseFloat(((1 - totalFailed / totalChecks) * 100).toFixed(3));
}

// Computes 24h error rate and week-over-week change from merged error metrics.
// Returns { current: number|null, change: number|null }
function computeErrorRate(allResults) {
  const alb5xx   = mergeSumSeries(allResults, 'alb_5xx');
  const albReq   = mergeSumSeries(allResults, 'alb_req');
  const apigw5xx = mergeSumSeries(allResults, 'apigw_5xx');
  const apigwReq = mergeSumSeries(allResults, 'apigw_req');

  // Combine ALB and API GW into one 5xx and one request series keyed by hour
  const combined5xx = new Map();
  const combinedReq = new Map();

  for (const { hourMs, value } of alb5xx)   combined5xx.set(hourMs, (combined5xx.get(hourMs) || 0) + value);
  for (const { hourMs, value } of apigw5xx) combined5xx.set(hourMs, (combined5xx.get(hourMs) || 0) + value);
  for (const { hourMs, value } of albReq)   combinedReq.set(hourMs, (combinedReq.get(hourMs) || 0) + value);
  for (const { hourMs, value } of apigwReq) combinedReq.set(hourMs, (combinedReq.get(hourMs) || 0) + value);

  // All hour buckets sorted newest-first
  const allHours = [...new Set([...combined5xx.keys(), ...combinedReq.keys()])].sort((a, b) => b - a);

  // Compute rate for a given 24h slice of allHours
  function rateForSlice(hours) {
    const total5xx = hours.reduce((s, h) => s + (combined5xx.get(h) || 0), 0);
    const totalReq = hours.reduce((s, h) => s + (combinedReq.get(h) || 0), 0);
    return totalReq > 0 ? parseFloat((total5xx / totalReq * 100).toFixed(4)) : null;
  }

  // Current 24h: most recent 24 hour buckets
  const current24Hours = allHours.slice(0, 24);
  const currentRate = rateForSlice(current24Hours);

  // Previous week's same 24h window: hours at index 168–191 (7 * 24 = 168 hours ago)
  const prev24Hours = allHours.slice(168, 192);
  const prevRate = rateForSlice(prev24Hours);

  let changePercent = null;
  if (currentRate !== null && prevRate !== null && prevRate > 0) {
    changePercent = parseFloat(((currentRate - prevRate) / prevRate * 100).toFixed(1));
  }

  return { current: currentRate, change: changePercent };
}

// Builds a 10-point hourly uptime sparkline from the newest 10 hours.
// Returns array of uptime% values (newest-first).
function buildUptimeSparkline(ec2FailedSeries, ec2TotalSeries) {
  const failedMap = new Map(ec2FailedSeries.map(({ hourMs, value }) => [hourMs, value]));
  const totalMap  = new Map(ec2TotalSeries.map(({ hourMs, value }) => [hourMs, value]));

  const allHours = [...new Set([...failedMap.keys(), ...totalMap.keys()])].sort((a, b) => b - a);

  return allHours.slice(0, 10).reduce((acc, hourMs) => {
    const total = totalMap.get(hourMs);
    if (!total) return acc;
    const failed = failedMap.get(hourMs) || 0;
    acc.push(parseFloat(((1 - failed / total) * 100).toFixed(1)));
    return acc;
  }, []);
}

// Counts open incidents and incidents resolved in the last 24h for the org
async function getIncidentCounts(orgId) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const baseQuery = db('incidents as i')
    .join('resources as r',       'i.resource_id',      'r.id')
    .join('cloud_accounts as ca', 'r.cloud_account_id', 'ca.id')
    .where('ca.org_id', orgId)
    .whereNull('ca.deleted_at')
    .whereNull('r.deleted_at');

  const [activeRow] = await baseQuery.clone().where('i.status', 'open').count('i.id as count');
  const [resolvedRow] = await baseQuery.clone()
    .where('i.status', 'resolved')
    .where('i.resolved_at', '>=', cutoff)
    .count('i.id as count');

  return {
    activeCount:   parseInt(activeRow.count, 10),
    resolvedCount: parseInt(resolvedRow.count, 10),
  };
}

// Determines system status from open incident priorities:
//   critical — any open high-priority incident
//   degraded — any open medium-priority incident (but no high)
//   healthy  — no open incidents
async function getSystemStatus(orgId) {
  const openIncidents = await db('incidents as i')
    .join('resources as r',       'i.resource_id',      'r.id')
    .join('cloud_accounts as ca', 'r.cloud_account_id', 'ca.id')
    .where('ca.org_id', orgId)
    .whereNull('ca.deleted_at')
    .whereNull('r.deleted_at')
    .where('i.status', 'open')
    .select('i.priority');

  if (!openIncidents.length) return 'healthy';

  const priorities = openIncidents.map((i) => i.priority);
  if (priorities.includes('high')) return 'critical';
  if (priorities.includes('medium')) return 'degraded';
  return 'healthy';
}

// Returns the empty/null response shape used when no cloud accounts exist or metrics are unavailable
async function buildEmptyResponse(orgId) {
  const [systemStatus, { activeCount, resolvedCount }] = await Promise.all([
    getSystemStatus(orgId),
    getIncidentCounts(orgId),
  ]);

  return {
    uptime_percent:            null,
    p99_latency_ms:            null,
    error_rate_24h_percent:    null,
    error_rate_change_percent: null,
    system_status:             systemStatus,
    active_incident_count:     activeCount,
    resolved_last_24h_count:   resolvedCount,
    uptime_sparkline:          [],
    latency_sparkline:         [],
  };
}

/**
 * Fetches and aggregates live dashboard metrics for an org from AWS CloudWatch.
 * Queries all cloud accounts in the org and merges data across accounts and regions.
 * Results are cached for 60 seconds to limit CloudWatch API cost.
 *
 * @param {string} orgId
 * @returns {Promise<Object>}
 */
async function getDashboardSummary(orgId) {
  const cached = getCached(orgId);
  if (cached) return cached;

  // Load all active cloud accounts for the org
  const accounts = await db('cloud_accounts')
    .where({ org_id: orgId })
    .whereNull('deleted_at')
    .select('id', 'auth_type', 'encrypted_creds', 'regions');

  if (!accounts.length) {
    const empty = await buildEmptyResponse(orgId);
    setCached(orgId, empty);
    return empty;
  }

  // Fetch metrics from every account+region in parallel; failures are isolated per account
  const fetchJobs = accounts.flatMap((account) => {
    const creds = JSON.parse(decrypt(account.encrypted_creds));
    const awsBase = buildAwsCredentials(account.auth_type, creds, 'us-east-1');
    const regions = Array.isArray(account.regions) && account.regions.length
      ? account.regions
      : ['us-east-1'];

    return regions.map((region) =>
      fetchDashboardMetrics({ ...awsBase, region }).catch((err) => {
        Sentry.captureException(err);
        return null;
      })
    );
  });

  const allMetrics = await Promise.all(fetchJobs);
  const validResults = allMetrics.filter(Boolean);

  if (!validResults.length) {
    const empty = await buildEmptyResponse(orgId);
    setCached(orgId, empty);
    return empty;
  }

  // Aggregate time series across all accounts+regions
  const ec2FailedSeries = mergeSumSeries(validResults, 'ec2_failed');
  const ec2TotalSeries  = mergeSumSeries(validResults, 'ec2_total');
  const latencySeries   = mergeLatencySeries(validResults);

  // Compute each summary value
  const uptimePercent = computeUptime30d(ec2FailedSeries, ec2TotalSeries);
  const errorRateResult = computeErrorRate(validResults);
  const currentLatency = latencySeries.length ? latencySeries[0].value : null;

  const uptimeSparkline  = buildUptimeSparkline(ec2FailedSeries, ec2TotalSeries);
  const latencySparkline = latencySeries.slice(0, 10).map(({ value }) => value);

  const [systemStatus, { activeCount, resolvedCount }] = await Promise.all([
    getSystemStatus(orgId),
    getIncidentCounts(orgId),
  ]);

  const summary = {
    uptime_percent:            uptimePercent,
    p99_latency_ms:            currentLatency,
    error_rate_24h_percent:    errorRateResult.current,
    error_rate_change_percent: errorRateResult.change,
    system_status:             systemStatus,
    active_incident_count:     activeCount,
    resolved_last_24h_count:   resolvedCount,
    uptime_sparkline:          uptimeSparkline,
    latency_sparkline:         latencySparkline,
  };

  setCached(orgId, summary);
  return summary;
}

module.exports = { getDashboardSummary };
