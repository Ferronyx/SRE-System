'use strict';

const kinesis_data_stream_metrics = {
  'GetRecords.IteratorAgeMilliseconds': {
    dimensions: [{ Name: 'StreamName', Value: '' }],
    namespace: 'AWS/Kinesis',
    unit: 'Milliseconds',
    global_threshold: {
      threshold_value: 300000,
      threshold_condition: 'GreaterThanThreshold',
      period: 60,
      evaluation_periods: 10,
      unit: 'Milliseconds',
      threshold_type: 'Static',
      statistic: 'Maximum',
    },
    metric_weight: 1,
  },
  ReadProvisionedThroughputExceeded: {
    dimensions: [{ Name: 'StreamName', Value: '' }],
    namespace: 'AWS/Kinesis',
    unit: 'Count',
    global_threshold: {
      threshold_value: 10,
      threshold_condition: 'GreaterThanThreshold',
      period: 60,
      evaluation_periods: 10,
      unit: 'Count',
      threshold_type: 'Static',
      statistic: 'Sum',
    },
    metric_weight: 1,
  },
  WriteProvisionedThroughputExceeded: {
    dimensions: [{ Name: 'StreamName', Value: '' }],
    namespace: 'AWS/Kinesis',
    unit: 'Count',
    global_threshold: {
      threshold_value: 10,
      threshold_condition: 'GreaterThanThreshold',
      period: 60,
      evaluation_periods: 10,
      unit: 'Count',
      threshold_type: 'Static',
      statistic: 'Sum',
    },
    metric_weight: 1,
  },
  'GetRecords.Success': {
    dimensions: [{ Name: 'StreamName', Value: '' }],
    namespace: 'AWS/Kinesis',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
  'PutRecord.Success': {
    dimensions: [{ Name: 'StreamName', Value: '' }],
    namespace: 'AWS/Kinesis',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
  'PutRecords.Success': {
    dimensions: [{ Name: 'StreamName', Value: '' }],
    namespace: 'AWS/Kinesis',
    unit: 'Count',
    global_threshold: null,
    metric_weight: 1,
  },
};

module.exports = { kinesis_data_stream_metrics };
