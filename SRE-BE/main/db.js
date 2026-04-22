'use strict';

const fs = require('fs');
const path = require('path');
const knex = require('knex');

const sslCert = process.env.DB_SSL_CERT
  ? fs.readFileSync(path.resolve(process.env.DB_SSL_CERT))
  : null;

const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ...(sslCert && {
      ssl: { rejectUnauthorized: true, ca: sslCert },
    }),
  },
  pool: {
    min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
    max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    acquireTimeoutMillis: 30_000,
    idleTimeoutMillis: 30_000,
    reapIntervalMillis: 1_000,
  },
  acquireConnectionTimeout: 30_000,
});

module.exports = db;
