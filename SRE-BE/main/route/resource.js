'use strict';

/**
 * Resource routes — list and fetch AWS resources discovered under a cloud account.
 *
 * GET /cloud-accounts/:accountId/resources              Input: ?limit ?offset ?service ?region ?status ?search   Response: { status, data: resource[], meta }
 * GET /cloud-accounts/:accountId/resources/:resourceId  Input: none                                              Response: { status, data: resource }
 */

const router      = require('express').Router({ mergeParams: true });
const asyncHandler = require('../lib/asyncHandler');
const { authenticate } = require('../middleware');
const db          = require('../db');
const { listResources, getResourceById } = require('../service/resource');

// Verify the authenticated user belongs to the org that owns this cloud account
async function verifyAccountOwnership(req, res, next) {
  const account = await db('cloud_accounts')
    .where({ id: req.params.accountId })
    .whereNull('deleted_at')
    .first();

  if (!account) return res.status(404).json({ status: 0, error: 'Cloud account not found.' });

  const membership = await db('org_members')
    .where({ org_id: account.org_id, user_id: req.user.id })
    .first();

  if (!membership) return res.status(403).json({ status: 0, error: 'Access denied.' });

  req.cloudAccount = account;
  next();
}

// GET /cloud-accounts/:accountId/resources — paginated resource list with optional filters
router.get(
  '/',
  authenticate,
  asyncHandler(verifyAccountOwnership),
  asyncHandler(async (req, res) => {
    const limit   = Math.min(parseInt(req.query.limit,  10) || 20, 100); // cap at 100
    const offset  = Math.max(parseInt(req.query.offset, 10) || 0,  0);
    const { service, region, status, search } = req.query;

    const result = await listResources(
      req.params.accountId,
      req.cloudAccount.org_id,
      { limit, offset, service, region, status, search }
    );

    res.status(200).json({ status: 1, ...result });
  })
);

// GET /cloud-accounts/:accountId/resources/:resourceId — single resource detail
router.get(
  '/:resourceId',
  authenticate,
  asyncHandler(verifyAccountOwnership),
  asyncHandler(async (req, res) => {
    const resource = await getResourceById(
      req.params.resourceId,
      req.params.accountId,
      req.cloudAccount.org_id
    );
    res.status(200).json({ status: 1, data: resource });
  })
);

module.exports = router;
