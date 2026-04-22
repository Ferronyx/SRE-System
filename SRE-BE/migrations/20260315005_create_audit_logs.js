'use strict';

exports.up = async (knex) => {
  await knex.schema.createTable('audit_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').nullable();
    t.uuid('user_id').nullable();
    t.string('action', 100).notNullable();
    t.string('entity_type', 100).nullable();
    t.uuid('entity_id').nullable();
    t.string('ip_address', 45).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index('org_id');
    t.index('user_id');
    t.index('action');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('audit_logs');
};
