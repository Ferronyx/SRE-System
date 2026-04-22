'use strict';

exports.up = async (knex) => {
  await knex.schema.createTable('cloud_accounts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.string('provider', 50).notNullable().defaultTo('aws');
    t.string('auth_type', 50).notNullable();
    t.text('encrypted_creds').notNullable();
    t.jsonb('regions').notNullable().defaultTo('[]');
    t.string('sync_status', 50).notNullable().defaultTo('idle');
    t.timestamp('last_synced_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('deleted_at', { useTz: true }).nullable();

    t.index(['org_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTable('cloud_accounts');
};
