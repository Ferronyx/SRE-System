'use strict';

const guard_duty_metrics = {
  guardduty_finding_event_rule: {
    dimensions: [],
    namespace: 'AWS/GuardDuty',
    unit: null,
    global_threshold: null,
    metric_weight: 1,
  },
};

module.exports = { guard_duty_metrics };
