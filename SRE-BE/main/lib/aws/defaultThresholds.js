'use strict';

// Default alert threshold templates per AWS service.
// Built from the canonical metrics catalog at main/metrics/aws/.
// Users can modify threshold_value, operator, evaluation_periods, and period via the PATCH API.

const metrics = require('../../metrics/aws');

// Converts a metrics object into a flat threshold array for seedDefaultThresholds
function toThresholdArray(metricsObj) {
  return Object.entries(metricsObj)
    .filter(([, m]) => m.global_threshold)
    .map(([metric_name, m]) => {
      const t = m.global_threshold;
      return {
        metric_name,
        operator:           t.threshold_condition,
        threshold_value:    t.threshold_value,
        evaluation_periods: t.evaluation_periods,
        period:             t.period,
        statistic:          t.statistic,
        threshold_type:     t.threshold_type,
      };
    });
}

const DEFAULT_THRESHOLDS = {
  ec2:        toThresholdArray(metrics.ec2_metrics),
  rds:        toThresholdArray(metrics.rds_metrics),
  elb:        toThresholdArray(metrics.elb_metrics),
  alb:        toThresholdArray(metrics.alb_metrics),
  lambda:     toThresholdArray(metrics.lambda_metrics),
  sqs:        toThresholdArray(metrics.sqs_metrics),
  dynamodb:   toThresholdArray(metrics.dynamodb_metrics),
  redis:      toThresholdArray(metrics.redis_metrics),
  kafka:      toThresholdArray(metrics.kafka_metrics),
  ecs:        toThresholdArray(metrics.ecs_metrics),
  eks:        toThresholdArray(metrics.eks_container_insights_metrics),
  asg:        toThresholdArray(metrics.asg_metrics),
  cloudfront: toThresholdArray(metrics.cloudfront_metrics),
  apigateway: toThresholdArray(metrics.apigateway_metrics),
  appsync:    toThresholdArray(metrics.appsync_metrics),
  dms:        toThresholdArray(metrics.dms_instance_metrics),
  docdb:      toThresholdArray(metrics.docdb_metrics),
  kinesis:    toThresholdArray(metrics.kinesis_data_stream_metrics),
  memcached:  toThresholdArray(metrics.memcached_metrics),
  opensearch: toThresholdArray(metrics.opensearch_metrics),
  rabbitmq:   toThresholdArray(metrics.rabbitmq_metrics),
  redshift:   toThresholdArray(metrics.redshift_metrics),
  ses:        toThresholdArray(metrics.ses_metrics),
  waf:        toThresholdArray(metrics.waf_metrics),
};

module.exports = { DEFAULT_THRESHOLDS };
