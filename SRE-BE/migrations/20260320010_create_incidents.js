'use strict';

// incidents — records each time a CloudWatch alarm fires for a resource.
// Created by the SNS webhook; resolved_at is reserved for future auto-close feature.

exports.up = async function (knex) {
  await knex.schema.createTable('incidents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    t.uuid('resource_id').notNullable().references('id').inTable('resources').onDelete('CASCADE');

    // Which threshold triggered this — nullable so incidents survive threshold deletion
    t.uuid('threshold_id').references('id').inTable('alert_thresholds').onDelete('SET NULL');

    t.text('metric_name').notNullable();

    // The threshold value at the time the incident was created
    t.float('threshold_value');

    // CloudWatch alarm ARN from the SNS payload
    t.text('alarm_arn');

    // ALARM | INSUFFICIENT_DATA
    t.text('state').notNullable().defaultTo('ALARM');

    t.timestamp('started_at').notNullable().defaultTo(knex.fn.now());

    // Populated when auto-close is implemented (future feature)
    t.timestamp('resolved_at');

    // Full SNS message payload for debugging
    t.jsonb('raw_payload').defaultTo('{}');

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index('resource_id');
    t.index(['resource_id', 'state']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('incidents');
};
