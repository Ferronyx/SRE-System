'use strict';

/**
 * Cloud Account routes — manage AWS cloud account connections.
 *
 * GET    /cloud-accounts                   Input: Bearer token                                           Response: { status, data: account[] }
 * POST   /cloud-accounts                   Input: { name*, provider*, authType*, credentials*, regions } Response: { status, data: account }
 * GET    /cloud-accounts/:id               Input: none                                                   Response: { status, data: account }
 * DELETE /cloud-accounts/:id               Input: none                                                   Response: { status: 1 }
 * POST   /cloud-accounts/:id/validate      Input: none — runs live STS credential check                 Response: { status, data }
 * POST   /cloud-accounts/:id/sync          Input: none — enqueues resource discovery job                Response: { status, data: { jobId } }
 * GET    /cloud-accounts/:id/sync-status   Input: ?jobId                                                Response: { status, data: { jobId, status, progress } }
 */

const router               = require('express').Router();
const Joi                  = require('joi');
const cloudAccountService  = require('../service/cloudAccount');
const asyncHandler         = require('../lib/asyncHandler');
const { authenticate }     = require('../middleware');
const db                   = require('../db');
const { resourceSyncQueue } = require('../../workers');

// Verify the authenticated user belongs to the org that owns this account
async function verifyOwnership(req, res, next) {
  const account = await db('cloud_accounts')
    .where({ id: req.params.id })
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

const createSchema = Joi.object({
  name:        Joi.string().trim().max(255).required(),
  provider:    Joi.string().valid('aws').default('aws'),
  authType:    Joi.string().valid('access_key', 'role_arn').required(),
  credentials: Joi.when('authType', {
    is:        'access_key',
    then:      Joi.object({ accessKeyId: Joi.string().required(), secretAccessKey: Joi.string().required() }).required(),
    otherwise: Joi.object({ roleArn: Joi.string().required(), externalId: Joi.string().optional() }).required(),
  }),
  regions: Joi.array().items(Joi.string()).default([]),
});

// GET /cloud-accounts — list all accounts for the user's org
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const accounts = await cloudAccountService.list(req.orgId);
  res.status(200).json({ status: 1, data: accounts });
}));

// POST /cloud-accounts — create a new cloud account with encrypted credentials
router.post('/', authenticate, asyncHandler(async (req, res) => {
  // name, provider, authType, credentials — required
  const { error, value } = createSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ status: 0, error: error.details.map((d) => d.message) });
  }

  const account = await cloudAccountService.create(req.orgId, value);
  res.status(201).json({ status: 1, data: account });
}));

// GET /cloud-accounts/:id — fetch a single account (credentials masked)
router.get('/:id', authenticate, asyncHandler(verifyOwnership), asyncHandler(async (req, res) => {
  res.status(200).json({ status: 1, data: cloudAccountService.maskCredentials(req.cloudAccount) });
}));

// DELETE /cloud-accounts/:id — permanently remove an account
router.delete('/:id', authenticate, asyncHandler(verifyOwnership), asyncHandler(async (req, res) => {
  await cloudAccountService.remove(req.params.id, req.cloudAccount.org_id);
  res.status(200).json({ status: 1 });
}));

// POST /cloud-accounts/:id/validate — test credentials with a live STS call
router.post('/:id/validate', authenticate, asyncHandler(verifyOwnership), asyncHandler(async (req, res) => {
  const result = await cloudAccountService.validate(req.params.id, req.cloudAccount.org_id);
  res.status(200).json({ status: 1, data: result });
}));

// POST /cloud-accounts/:id/sync — enqueue a background resource discovery job
router.post('/:id/sync', authenticate, asyncHandler(verifyOwnership), asyncHandler(async (req, res) => {
  const result = await cloudAccountService.enqueueSync(req.params.id, req.cloudAccount.org_id);
  res.status(202).json({ status: 1, data: result });
}));

// GET /cloud-accounts/:id/sync-status — poll job progress by jobId or account sync_status
router.get('/:id/sync-status', authenticate, asyncHandler(verifyOwnership), asyncHandler(async (req, res) => {
  const { jobId } = req.query;

  // No jobId — return account-level sync status from DB
  if (!jobId) {
    return res.status(200).json({ status: 1, data: { syncStatus: req.cloudAccount.sync_status } });
  }

  const job = await resourceSyncQueue.getJob(jobId);
  if (!job) return res.status(404).json({ status: 0, error: 'Job not found.' });

  const state  = await job.getState();
  const result = { jobId: job.id, status: state, progress: job.progress() };

  if (state === 'failed')    result.failReason   = job.failedReason;
  if (state === 'completed') result.returnValue  = job.returnvalue;

  res.status(200).json({ status: 1, data: result });
}));

module.exports = router;
