'use strict';

/**
 * Org routes — member management, incidents, and cloud accounts scoped to an org.
 *
 * GET    /orgs/me                                  Input: Bearer token                           Response: { status, data: org[] }
 * GET    /orgs/:orgId/members                      Input: ?page ?limit                           Response: { status, data: member[], meta }
 * PATCH  /orgs/:orgId/members/:userId/role         Input: { role* }  (owner only)               Response: { status, data: { userId, role } }
 * DELETE /orgs/:orgId/members/:userId              Input: none       (admin+)                    Response: { status, message }
 * GET    /orgs/:orgId/dashboard/summary             Input: none       (viewer+)                   Response: { status, data: summary }
 * GET    /orgs/:orgId/incidents                    Input: ?limit ?offset ?status (viewer+)       Response: { status, data, meta }
 * GET    /orgs/:orgId/incidents/:incidentId        Input: none       (viewer+)                   Response: { status, data: incident }
 * POST   /orgs/:orgId/cloud-accounts               Input: { name*, provider*, authType*, credentials*, regions } (admin+) Response: { status, data: account }
 * GET    /orgs/:orgId/cloud-accounts               Input: none       (viewer+)                   Response: { status, data: account[] }
 * DELETE /orgs/:orgId/cloud-accounts/:accountId   Input: none       (admin+)                    Response: { status, message }
 */

const router      = require('express').Router();
const Joi         = require('joi');
const orgService  = require('../service/org');
const asyncHandler = require('../lib/asyncHandler');
const roleLevel   = require('../lib/roles');
const { authenticate } = require('../middleware');
const db          = require('../db');

// Verify actor is a member of the org in the URL param (fresh DB lookup, not JWT)
async function orgMember(req, res, next) {
  const membership = await db('org_members')
    .where({ org_id: req.params.orgId, user_id: req.user.id })
    .first();

  if (!membership) {
    return res.status(403).json({ status: 0, error: 'You are not a member of this org.' });
  }

  req.orgMemberRole = membership.role;
  next();
}

// GET /orgs/me — list all orgs the current user belongs to
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const orgs = await orgService.getMyOrgs(req.user.id);
  res.status(200).json({ status: 1, data: orgs });
}));

// GET /orgs/:orgId/members — paginated member list (viewer+)
const listQuerySchema = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

router.get(
  '/:orgId/members',
  authenticate,
  asyncHandler(orgMember),
  asyncHandler(async (req, res) => {
    // Any valid org member (viewer+) can list members
    const { error, value } = listQuerySchema.validate(req.query, { abortEarly: false });
    if (error) {
      return res.status(400).json({ status: 0, error: error.details.map((d) => d.message) });
    }

    const result = await orgService.listMembers(req.params.orgId, value.page, value.limit);
    res.status(200).json({ status: 1, ...result });
  })
);

// PATCH /orgs/:orgId/members/:userId/role — change a member's role (owner only)
const changeRoleSchema = Joi.object({
  role: Joi.string().valid('viewer', 'member', 'admin', 'owner').required(),
});

router.patch(
  '/:orgId/members/:userId/role',
  authenticate,
  asyncHandler(orgMember),
  asyncHandler(async (req, res) => {
    // Only org owner can change roles
    if (req.orgMemberRole !== 'owner') {
      return res.status(403).json({ status: 0, error: 'Only the org owner can change member roles.' });
    }

    // role — required, one of: viewer | member | admin | owner
    const { error, value } = changeRoleSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ status: 0, error: error.details.map((d) => d.message) });
    }

    const updated = await orgService.changeMemberRole(req.params.orgId, req.params.userId, value.role, req.user.id);
    res.status(200).json({ status: 1, data: { userId: updated.user_id, role: updated.role } });
  })
);

// DELETE /orgs/:orgId/members/:userId — remove a member (admin+)
router.delete(
  '/:orgId/members/:userId',
  authenticate,
  asyncHandler(orgMember),
  asyncHandler(async (req, res) => {
    // Requires admin or higher
    if (roleLevel[req.orgMemberRole] < roleLevel['admin']) {
      return res.status(403).json({ status: 0, error: 'Admin or higher role required.' });
    }

    await orgService.removeMember(req.params.orgId, req.params.userId, req.user.id);
    res.status(200).json({ status: 1, message: 'Member removed.' });
  })
);

// ── Dashboard routes ──────────────────────────────────────────────────────────

const { getDashboardSummary } = require('../service/dashboard');

// GET /orgs/:orgId/dashboard/summary — live metrics aggregated from AWS CloudWatch (viewer+)
router.get(
  '/:orgId/dashboard/summary',
  authenticate,
  asyncHandler(orgMember),
  asyncHandler(async (req, res) => {
    const summary = await getDashboardSummary(req.params.orgId);
    res.status(200).json({ status: 1, data: summary });
  })
);

// ── Incident routes ───────────────────────────────────────────────────────────

const { listOrgIncidents, getIncidentById } = require('../service/incident');

// GET /orgs/:orgId/incidents — all incidents in org, newest first (viewer+)
// Optional ?status=open|resolved to filter by incident status
router.get(
  '/:orgId/incidents',
  authenticate,
  asyncHandler(orgMember),
  asyncHandler(async (req, res) => {
    // Any valid org member can view incidents
    const limit  = Math.min(parseInt(req.query.limit,  10) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0,  0);

    // status filter — only pass through valid values
    const status = ['open', 'resolved'].includes(req.query.status) ? req.query.status : undefined;

    const result = await listOrgIncidents(req.params.orgId, { limit, offset, status });
    res.status(200).json({ status: 1, ...result });
  })
);

// GET /orgs/:orgId/incidents/:incidentId — single incident with raw CloudWatch payload (viewer+)
router.get(
  '/:orgId/incidents/:incidentId',
  authenticate,
  asyncHandler(orgMember),
  asyncHandler(async (req, res) => {
    const incident = await getIncidentById(req.params.incidentId, req.params.orgId);
    res.status(200).json({ status: 1, data: incident });
  })
);

// ── Cloud Account routes ──────────────────────────────────────────────────────

const cloudAccountService = require('../service/cloudAccount');

const createAccountSchema = Joi.object({
  name:        Joi.string().max(255).required(),
  provider:    Joi.string().valid('aws').default('aws'),
  authType:    Joi.string().valid('access_key', 'role_arn').required(),
  credentials: Joi.when('authType', {
    is:        'access_key',
    then:      Joi.object({ accessKeyId: Joi.string().required(), secretAccessKey: Joi.string().required() }).required(),
    otherwise: Joi.object({ roleArn: Joi.string().required(), externalId: Joi.string().optional() }).required(),
  }),
  regions: Joi.array().items(Joi.string()).default([]),
});

// POST /orgs/:orgId/cloud-accounts — create a cloud account (admin+)
router.post(
  '/:orgId/cloud-accounts',
  authenticate,
  asyncHandler(orgMember),
  asyncHandler(async (req, res) => {
    // Requires admin or higher
    if (roleLevel[req.orgMemberRole] < roleLevel['admin']) {
      return res.status(403).json({ status: 0, error: 'Admin or higher role required.' });
    }

    // name, provider, authType, credentials — required
    const { error, value } = createAccountSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ status: 0, error: error.details.map((d) => d.message) });
    }

    const account = await cloudAccountService.create(req.params.orgId, value);
    res.status(201).json({ status: 1, data: account });
  })
);

// GET /orgs/:orgId/cloud-accounts — list all cloud accounts (viewer+)
router.get(
  '/:orgId/cloud-accounts',
  authenticate,
  asyncHandler(orgMember),
  asyncHandler(async (req, res) => {
    const accounts = await cloudAccountService.list(req.params.orgId);
    res.status(200).json({ status: 1, data: accounts });
  })
);

// DELETE /orgs/:orgId/cloud-accounts/:accountId — hard delete (admin+)
router.delete(
  '/:orgId/cloud-accounts/:accountId',
  authenticate,
  asyncHandler(orgMember),
  asyncHandler(async (req, res) => {
    // Requires admin or higher
    if (roleLevel[req.orgMemberRole] < roleLevel['admin']) {
      return res.status(403).json({ status: 0, error: 'Admin or higher role required.' });
    }

    await cloudAccountService.remove(req.params.accountId, req.params.orgId);
    res.status(200).json({ status: 1, message: 'Cloud account deleted.' });
  })
);

module.exports = router;
