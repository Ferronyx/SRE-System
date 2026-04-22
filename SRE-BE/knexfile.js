'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const sslCert = process.env.DB_SSL_CERT
  ? fs.readFileSync(path.resolve(process.env.DB_SSL_CERT))
  : null;

const connection = {
  connectionString: process.env.DATABASE_URL,
  ...(sslCert && {
    ssl: { rejectUnauthorized: true, ca: sslCert },
  }),
};

module.exports = {
  development: {
    client: 'pg',
    connection,
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
  },
  production: {
    client: 'pg',
    connection,
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
  },
};
