'use strict';

const appsync_metrics = {
  '4XXError': {
    dimensions: [{ Name: 'GraphQLAPIId', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: {
      threshold_value: 1000,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
    },
    metric_weight: 1,
  },
  '5XXError': {
    dimensions: [{ Name: 'GraphQLAPIId', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: {
      threshold_value: 500,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
    },
    metric_weight: 1,
  },
  Latency: {
    dimensions: [{ Name: 'GraphQLAPIId', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: {
      threshold_value: 1200,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      statistic: 'Average',
      period: 60,
      evaluation_periods: 10,
      unit: 'Milliseconds',
      threshold_type: 'Static',
    },
    metric_weight: 1,
  },
  Requests: {
    dimensions: [{ Name: 'Region', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: null,
    metric_weight: 1,
  },
  appsyncCacheEngineCPUUtilization: {
    dimensions: [{ Name: 'GraphQLAPIId', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: {
      threshold_value: 0.85,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      statistic: 'Average',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
    },
    metric_weight: 1,
  },
  appsyncCacheNetworkBandwidthOutAllowanceExceeded: {
    dimensions: [{ Name: 'GraphQLAPIId', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: {
      threshold_value: 50,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      statistic: 'Average',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
    },
    metric_weight: 1,
  },
};

const appsync_resolver_metrics = {
  GraphQLError: {
    dimensions: [{ Name: 'GraphQLAPIId', Value: '' }, { Name: 'Resolver', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: {
      threshold_value: 100,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      statistic: 'Average',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
    },
    metric_weight: 1,
  },
  Request: {
    dimensions: [{ Name: 'GraphQLAPIId', Value: '' }, { Name: 'Resolver', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: null,
    metric_weight: 1,
  },
  Latency: {
    dimensions: [{ Name: 'GraphQLAPIId', Value: '' }, { Name: 'Resolver', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: {
      threshold_value: 1200,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      statistic: 'Average',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
    },
    metric_weight: 1,
  },
};

const appsync_datasource_metrics = {
  GraphQLError: {
    dimensions: [{ Name: 'GraphQLAPIId', Value: '' }, { Name: 'DataSource', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: {
      threshold_value: 100,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      statistic: 'Average',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
    },
    metric_weight: 1,
  },
  Request: {
    dimensions: [{ Name: 'GraphQLAPIId', Value: '' }, { Name: 'DataSource', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: null,
    metric_weight: 1,
  },
  Latency: {
    dimensions: [{ Name: 'GraphQLAPIId', Value: '' }, { Name: 'DataSource', Value: '' }],
    namespace: 'AWS/AppSync',
    global_threshold: {
      threshold_value: 500,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      statistic: 'Average',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
    },
    metric_weight: 1,
  },
};

module.exports = { appsync_metrics, appsync_resolver_metrics, appsync_datasource_metrics };
