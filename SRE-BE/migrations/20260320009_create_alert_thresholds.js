'use strict';

// alert_thresholds — stores per-resource metric thresholds.
// Defaults are seeded at sync time; users can modify any value per resource.

exports.up = async function (knex) {
  await knex.schema.createTable('alert_thresholds', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Which resource this threshold belongs to
    t.uuid('resource_id').notNullable().references('id').inTable('resources').onDelete('CASCADE');

    // e.g. CPUUtilization, FreeStorageSpace, Errors
    t.text('metric_name').notNullable();

    // GreaterThanThreshold | LessThanThreshold | GreaterThanOrEqualToThreshold | LessThanOrEqualToThreshold
    t.text('operator').notNullable().defaultTo('GreaterThanThreshold');

    // The numeric value to compare against (e.g. 70 for CPU %)
    t.float('threshold_value').notNullable();

    // How many consecutive periods must breach before alarm fires (default: 2)
    t.integer('evaluation_periods').notNullable().defaultTo(2);

    // Sampling interval in seconds (default: 300 = 5 min)
    t.integer('period').notNullable().defaultTo(300);

    // CloudWatch alarm name set after alarm is created: sre-{id}
    t.text('alarm_name');

    // SNS topic ARN used by this alarm (one topic per cloud account)
    t.text('sns_topic_arn');

    // true = system default value; false = user has modified it
    t.boolean('is_default').notNullable().defaultTo(true);

    // null for system-seeded defaults; set to user_id when user modifies
    t.uuid('created_by');

    t.timestamp('deleted_at');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // One threshold per metric per resource
    t.unique(['resource_id', 'metric_name']);
    t.index('resource_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('alert_thresholds');
};
