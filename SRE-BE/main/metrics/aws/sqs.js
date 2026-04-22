'use strict';

const sqs_metrics = {
  ApproximateNumberOfMessagesDelayed: {
    dimensions: [{ Name: 'QueueName', Value: '' }],
    namespace: 'AWS/SQS',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
  ApproximateAgeOfOldestMessage: {
    dimensions: [{ Name: 'QueueName', Value: '' }],
    namespace: 'AWS/SQS',
    unit: 'Seconds',
    global_threshold: {
      threshold_value: 600,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      statistic: 'Maximum',
      period: 60,
      evaluation_periods: 10,
      unit: 'Seconds',
      threshold_type: 'Static',
    },
    metric_weight: 1,
  },
  ApproximateNumberOfMessagesVisible: {
    dimensions: [{ Name: 'QueueName', Value: '' }],
    namespace: 'AWS/SQS',
    unit: 'Count',
    global_threshold: {
      threshold_value: 100,
      threshold_condition: 'GreaterThanOrEqualToThreshold',
      statistic: 'Maximum',
      period: 60,
      evaluation_periods: 10,
      unit: 'Count',
      threshold_type: 'Static',
    },
    metric_weight: 1,
  },
  ApproximateNumberOfMessagesNotVisible: {
    dimensions: [{ Name: 'QueueName', Value: '' }],
    namespace: 'AWS/SQS',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
  NumberOfMessagesDeleted: {
    dimensions: [{ Name: 'QueueName', Value: '' }],
    namespace: 'AWS/SQS',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
  NumberOfMessagesSent: {
    dimensions: [{ Name: 'QueueName', Value: '' }],
    namespace: 'AWS/SQS',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
  NumberOfMessagesReceived: {
    dimensions: [{ Name: 'QueueName', Value: '' }],
    namespace: 'AWS/SQS',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
  NumberOfEmptyReceives: {
    dimensions: [{ Name: 'QueueName', Value: '' }],
    namespace: 'AWS/SQS',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
};

module.exports = { sqs_metrics };
