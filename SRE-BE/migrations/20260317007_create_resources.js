'use strict'; 

exports.up = async function (knex) {
  await knex.schema.createTable('resources', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    t.uuid('cloud_account_id').notNullable().references('id').inTable('cloud_accounts').onDelete('CASCADE');
    t.text('provider').notNullable().defaultTo('aws');
    t.text('service').notNullable();       // ec2 | rds | s3 | lambda | elb
    t.text('external_id').notNullable();   // AWS resource ID
    t.text('name');
    t.text('region');
    t.text('status');
    t.jsonb('metadata').defaultTo('{}');
    t.timestamp('last_seen_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('deleted_at');

    t.unique(['cloud_account_id', 'external_id']);
    t.index('org_id');
    t.index('cloud_account_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('resources');
};
