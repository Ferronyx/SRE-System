'use strict';

const ses_metrics = {
  Bounce: {
    dimensions: [],
    namespace: 'AWS/SES',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
  Complaint: {
    dimensions: [],
    namespace: 'AWS/SES',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
  'Reputation.BounceRate': {
    dimensions: [{ Name: 'ses:configuration-set', Value: '' }],
    namespace: 'AWS/SES',
    global_threshold: {
      threshold_value: 0.05,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
      statistic: 'Average',
    },
    metric_weight: 1,
  },
  'Reputation.ComplaintRate': {
    dimensions: [{ Name: 'ses:configuration-set', Value: '' }],
    namespace: 'AWS/SES',
    global_threshold: {
      threshold_value: 0.05,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      period: 60,
      evaluation_periods: 10,
      threshold_type: 'Static',
      statistic: 'Average',
    },
    metric_weight: 1,
  },
  Reject: {
    dimensions: [],
    namespace: 'AWS/SES',
    unit: 'Percent',
    global_threshold: null,
    metric_weight: 1,
  },
  Subscription: {
    dimensions: [],
    namespace: 'AWS/SES',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
};

module.exports = { ses_metrics };
