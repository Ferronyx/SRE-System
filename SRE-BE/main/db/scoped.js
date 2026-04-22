'use strict';

const db = require('../db');

/**
 * Returns a Knex query builder proxy that automatically applies
 * .where('org_id', orgId) to every query — enforces tenant isolation.
 *
 * Usage: const sdb = scopedDb(req.orgId);
 *        sdb('resources').select(...)  → SELECT * FROM resources WHERE org_id = ?
 */
function scopedDb(orgId) {
  return new Proxy(db, {
    apply(target, thisArg, args) {
      return target.apply(thisArg, args);
    },
    get(target, prop) {
      const original = target[prop];
      if (typeof original !== 'function') return original;

      // Intercept table-query calls: db('table') or db.table('table')
      if (prop === 'table' || prop === 'from') {
        return (...args) => original.apply(target, args).where('org_id', orgId);
      }

      return (...args) => {
        const result = original.apply(target, args);
        // If result is a Knex QueryBuilder, scope it
        if (result && typeof result.where === 'function' && typeof result.select === 'function') {
          return result.where('org_id', orgId);
        }
        return result;
      };
    },
  });
}

module.exports = scopedDb;
