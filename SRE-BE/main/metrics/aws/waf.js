'use strict';

const waf_metrics = {
  CaptchaRequests: {
    dimensions: [
      { Name: 'WebACL', Value: '' },
      { Name: 'Region', Value: '' },
      { Name: 'Rule', Value: '' },
    ],
    namespace: 'AWS/WAFV2',
    unit: 'Count',
    global_threshold: {
      threshold_value: 500,
      threshold_condition: 'GreaterThanThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 10,
      unit: 'Count',
      threshold_type: 'Static',
    },
    global_threshold_dynamic: {
      deviation_count: 10,
      threshold_condition: 'GreaterThanUpperThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 300,
      unit: 'Count',
      threshold_type: 'Dynamic',
    },
    metric_weight: 1,
  },
  BlockedRequests: {
    dimensions: [
      { Name: 'WebACL', Value: '' },
      { Name: 'Region', Value: '' },
      { Name: 'Rule', Value: '' },
    ],
    namespace: 'AWS/WAFV2',
    global_threshold: {
      threshold_value: 100,
      threshold_condition: 'GreaterThanThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
    },
    global_threshold_dynamic: {
      deviation_count: 10,
      threshold_condition: 'GreaterThanUpperThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 300,
      threshold_type: 'Dynamic',
    },
    metric_weight: 1,
  },
};

const rulegroup_metrics = {
  CaptchaRequests: {
    dimensions: [
      { Name: 'Region', Value: '' },
      { Name: 'Rule', Value: '' },
      { Name: 'RuleGroup', Value: '' },
    ],
    namespace: 'AWS/WAFV2',
    unit: 'Count',
    global_threshold: {
      threshold_value: 500,
      threshold_condition: 'GreaterThanThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 10,
      unit: 'Count',
      threshold_type: 'Static',
    },
    global_threshold_dynamic: {
      deviation_count: 10,
      threshold_condition: 'GreaterThanUpperThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 300,
      unit: 'Count',
      threshold_type: 'Dynamic',
    },
    metric_weight: 1,
  },
  BlockedRequests: {
    dimensions: [
      { Name: 'Region', Value: '' },
      { Name: 'Rule', Value: '' },
      { Name: 'RuleGroup', Value: '' },
    ],
    namespace: 'AWS/WAFV2',
    global_threshold: {
      threshold_value: 100,
      threshold_condition: 'GreaterThanThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
    },
    global_threshold_dynamic: {
      deviation_count: 10,
      threshold_condition: 'GreaterThanUpperThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 300,
      threshold_type: 'Dynamic',
    },
    metric_weight: 1,
  },
};

const managedrulegroup_metrics = {
  CaptchaRequests: {
    dimensions: [
      { Name: 'Region', Value: '' },
      { Name: 'WebACL', Value: '' },
      { Name: 'ManagedRuleGroup', Value: '' },
    ],
    namespace: 'AWS/WAFV2',
    unit: 'Count',
    global_threshold: {
      threshold_value: 500,
      threshold_condition: 'GreaterThanThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 10,
      unit: 'Count',
      threshold_type: 'Static',
    },
    global_threshold_dynamic: {
      deviation_count: 10,
      threshold_condition: 'GreaterThanUpperThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 300,
      unit: 'Count',
      threshold_type: 'Dynamic',
    },
    metric_weight: 1,
  },
  BlockedRequests: {
    dimensions: [
      { Name: 'Region', Value: '' },
      { Name: 'WebACL', Value: '' },
      { Name: 'ManagedRuleGroup', Value: '' },
    ],
    namespace: 'AWS/WAFV2',
    global_threshold: {
      threshold_value: 100,
      threshold_condition: 'GreaterThanThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
    },
    global_threshold_dynamic: {
      deviation_count: 10,
      threshold_condition: 'GreaterThanUpperThreshold',
      statistic: 'Sum',
      period: 60,
      evaluation_periods: 300,
      threshold_type: 'Dynamic',
    },
    metric_weight: 1,
  },
};

module.exports = { waf_metrics, rulegroup_metrics, managedrulegroup_metrics };
