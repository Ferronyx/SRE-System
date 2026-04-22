'use strict';

const { CloudWatchClient, GetMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
const Sentry = require('@sentry/node');
const { buildClient } = require('./clientFactory');

/**
 * Fetches all dashboard metrics for a single AWS account+region in one batched CloudWatch call.
 * Uses SEARCH expressions so no resource enumeration is needed — CloudWatch discovers all resources.
 * Returns a map of metric id → { timestamps: Date[], values: number[] }, newest-first.
 *
 * Metrics returned:
 *   ec2_failed    — StatusCheckFailed Sum per hour across all EC2 instances
 *   ec2_total     — StatusCheckFailed SampleCount per hour across all EC2 instances
 *   alb_latency   — TargetResponseTime p99 per hour averaged across all ALBs (seconds)
 *   apigw_latency — IntegrationLatency p99 per hour averaged across all API GWs (milliseconds)
 *   alb_5xx       — HTTPCode_Target_5XX_Count Sum per hour across all ALBs
 *   alb_req       — RequestCount Sum per hour across all ALBs
 *   apigw_5xx     — 5XXError Sum per hour across all API GWs
 *   apigw_req     — Count Sum per hour across all API GWs
 *
 * @param {{ accessKeyId?, secretAccessKey?, roleArn?, externalId?, region: string }} awsCreds
 * @returns {Promise<Object>}
 */
async function fetchDashboardMetrics(awsCreds) {
  const clientConfig = await buildClient(awsCreds);
  const client = new CloudWatchClient(clientConfig);

  const now = new Date();
  // 30 days of hourly data covers: 30d uptime, 24h error rate, 7-day WoW delta, and 10h sparklines
  const startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let resp;
  try {
    resp = await client.send(new GetMetricDataCommand({
      StartTime: startTime,
      EndTime: now,
      ScanBy: 'TimestampDescending',
      MetricDataQueries: [
        // EC2 uptime: total failed status checks summed across all instances (hourly)
        {
          Id: 'ec2_failed',
          Expression: `SUM(SEARCH(' {AWS/EC2,InstanceId} MetricName="StatusCheckFailed" ', 'Sum', 3600))`,
          ReturnData: true,
        },
        // EC2 uptime: total status check count summed across all instances (hourly)
        // SampleCount ≈ 60 per instance per hour (one check per minute)
        {
          Id: 'ec2_total',
          Expression: `SUM(SEARCH(' {AWS/EC2,InstanceId} MetricName="StatusCheckFailed" ', 'SampleCount', 3600))`,
          ReturnData: true,
        },
        // ALB P99 response latency averaged across all load balancers (hourly, CloudWatch unit: seconds)
        {
          Id: 'alb_latency',
          Expression: `AVG(SEARCH(' {AWS/ApplicationELB,LoadBalancer} MetricName="TargetResponseTime" ', 'p99', 3600))`,
          ReturnData: true,
        },
        // API Gateway P99 integration latency averaged across all APIs (hourly, CloudWatch unit: milliseconds)
        {
          Id: 'apigw_latency',
          Expression: `AVG(SEARCH(' {AWS/ApiGateway,ApiName} MetricName="IntegrationLatency" ', 'p99', 3600))`,
          ReturnData: true,
        },
        // ALB 5xx error count summed across all load balancers (hourly)
        {
          Id: 'alb_5xx',
          Expression: `SUM(SEARCH(' {AWS/ApplicationELB,LoadBalancer} MetricName="HTTPCode_Target_5XX_Count" ', 'Sum', 3600))`,
          ReturnData: true,
        },
        // ALB total request count summed across all load balancers (hourly)
        {
          Id: 'alb_req',
          Expression: `SUM(SEARCH(' {AWS/ApplicationELB,LoadBalancer} MetricName="RequestCount" ', 'Sum', 3600))`,
          ReturnData: true,
        },
        // API Gateway 5xx error count summed across all APIs (hourly)
        {
          Id: 'apigw_5xx',
          Expression: `SUM(SEARCH(' {AWS/ApiGateway,ApiName} MetricName="5XXError" ', 'Sum', 3600))`,
          ReturnData: true,
        },
        // API Gateway total request count summed across all APIs (hourly)
        {
          Id: 'apigw_req',
          Expression: `SUM(SEARCH(' {AWS/ApiGateway,ApiName} MetricName="Count" ', 'Sum', 3600))`,
          ReturnData: true,
        },
      ],
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }

  // Build id → { timestamps, values } map; both arrays are newest-first
  const result = {};
  for (const r of (resp.MetricDataResults || [])) {
    result[r.Id] = { timestamps: r.Timestamps || [], values: r.Values || [] };
  }

  return result;
}

module.exports = { fetchDashboardMetrics };
