'use strict';

// Add workflow fields to incidents: status (open/resolved), assigned_to, and priority (high/medium/low).

exports.up = async function (knex) {
  await knex.schema.table('incidents', (t) => {
    t.text('status').notNullable().defaultTo('open');
    t.uuid('assigned_to').references('id').inTable('users').onDelete('SET NULL');
    t.text('priority').notNullable().defaultTo('high');
  });
};

exports.down = async function (knex) {
  await knex.schema.table('incidents', (t) => {
    t.dropColumn('status');
    t.dropColumn('assigned_to');
    t.dropColumn('priority');
  });
};
