'use strict';

const db = require('../db');

/**
 * Bulk-upserts normalized resource objects.
 * Conflict target: (cloud_account_id, external_id) — deduplicates S3 buckets that appear in every region scan.
 * On conflict: updates all fields except id and created_at.
 */
async function upsertResources(resources) {
  if (!resources || resources.length === 0) return;

  // Deduplicate by (cloud_account_id, external_id) — a single INSERT cannot touch the same
  // conflict target twice or Postgres throws "ON CONFLICT DO UPDATE command cannot affect row a second time"
  const seen = new Map();
  for (const r of resources) {
    const key = `${r.cloud_account_id}::${r.external_id}`;
    seen.set(key, r); // last write wins — all copies of the same resource are identical
  }
  const deduplicated = Array.from(seen.values());

  const now  = new Date().toISOString();
  const rows = deduplicated.map((r) => ({
    ...r,
    metadata:   JSON.stringify(r.metadata || {}),
    updated_at: now,
  }));

  await db('resources')
    .insert(rows)
    .onConflict(['cloud_account_id', 'external_id'])
    .merge(['name', 'region', 'status', 'metadata', 'last_seen_at', 'updated_at', 'deleted_at']);
  // deleted_at is merged to clear soft-delete if a resource reappears after being stale
}

/**
 * Soft-deletes resources not seen in the latest sync scan.
 * Resources with external_id in seenIds are left untouched.
 */
async function markStaleResources(cloudAccountId, seenIds) {
  const query = db('resources')
    .where({ cloud_account_id: cloudAccountId })
    .whereNull('deleted_at')
    .update({ deleted_at: db.fn.now(), updated_at: db.fn.now() });

  if (seenIds && seenIds.length > 0) {
    query.whereNotIn('external_id', seenIds);
  }

  await query;
}

/**
 * Lists resources for a cloud account with pagination and optional filters.
 *
 * @param {string} cloudAccountId
 * @param {string} orgId               — tenant safety check
 * @param {object} opts
 * @param {number} opts.limit
 * @param {number} opts.offset
 * @param {string} [opts.service]      — filter by service (ec2|rds|s3|lambda|elb)
 * @param {string} [opts.region]       — filter by AWS region
 * @param {string} [opts.status]       — filter by resource status
 * @param {string} [opts.search]       — partial match on name or external_id
 */
async function listResources(cloudAccountId, orgId, { limit = 20, offset = 0, service, region, status, search } = {}) {
  const query = db('resources')
    .where({ cloud_account_id: cloudAccountId, org_id: orgId })
    .whereNull('deleted_at');

  if (service) query.where({ service });
  if (region)  query.where({ region });
  if (status)  query.where({ status });
  if (search) {
    query.where((q) =>
      q.whereILike('name', `%${search}%`)
       .orWhereILike('external_id', `%${search}%`)
    );
  }

  const [{ count }] = await query.clone().count('id as count');
  const total = parseInt(count, 10);

  const rows = await query
    .orderBy('service', 'asc')
    .orderBy('name', 'asc')
    .limit(limit)
    .offset(offset)
    .select('id', 'service', 'external_id', 'name', 'region', 'status', 'metadata', 'last_seen_at', 'created_at', 'updated_at');

  return {
    data:       rows,
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  };
}

// Fetches a single resource by id with org + account ownership check
async function getResourceById(id, cloudAccountId, orgId) {
  const resource = await db('resources')
    .where({ id, cloud_account_id: cloudAccountId, org_id: orgId })
    .whereNull('deleted_at')
    .first();

  if (!resource) {
    const err = new Error('Resource not found.');
    err.status = 404;
    throw err;
  }

  return resource;
}

module.exports = { upsertResources, markStaleResources, listResources, getResourceById };
