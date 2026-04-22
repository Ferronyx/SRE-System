'use strict';

/**
 * Incident routes — view, resolve, and configure alarm incidents.
 *
 * Purpose: List incidents per resource; resolve incidents; assign and set priority.
 *
 * GET   /cloud-accounts/:accountId/resources/:resourceId/incidents
 *     Input: none | Response: { status, data: incident[] }
 *
 * PATCH /incidents/:incidentId/resolve
 *     Input: none | Response: { status, data: { id, status, resolved_at } }
 *
 * PATCH /incidents/:incidentId
 *     Input: { assigned_to?, priority? } | Response: { status, data: { id, assigned_to, priority, status } }
 */

const Joi    = require('joi');
const router = require('express').Router({ mergeParams: true });
const incidentRouter = require('express').Router();
const { authenticate } = require('../middleware');
const asyncHandler   = require('../lib/asyncHandler');
const db = require('../db');
const { listIncidents, resolveIncident, updateIncidentConfig } = require('../service/incident');
const { notifyAlertResolved } = require('../lib/slack');

// ── Middleware shared by nested resource-level route ──────────────────────────

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

// Resolves org_id for a given incident and verifies the caller is a member
async function verifyIncidentAccess(req, res, next) {
  const row = await db('incidents as i')
    .join('resources as r',       'i.resource_id',      'r.id')
    .join('cloud_accounts as ca', 'r.cloud_account_id', 'ca.id')
    .where('i.id', req.params.incidentId)
    .whereNull('ca.deleted_at')
    .whereNull('r.deleted_at')
    .select('ca.org_id')
    .first();

  if (!row) return res.status(404).json({ status: 0, error: 'Incident not found.' });

  const membership = await db('org_members')
    .where({ org_id: row.org_id, user_id: req.user.id })
    .first();

  if (!membership) return res.status(403).json({ status: 0, error: 'Access denied.' });

  req.orgId = row.org_id;
  next();
}

// ── Resource-scoped GET ───────────────────────────────────────────────────────

// GET /cloud-accounts/:accountId/resources/:resourceId/incidents
router.get(
  '/',
  authenticate,
  asyncHandler(verifyAccountOwnership),
  asyncHandler(async (req, res) => {
    const { resourceId } = req.params;
    const incidents = await listIncidents(resourceId, req.cloudAccount.org_id);
    res.status(200).json({ status: 1, data: incidents });
  })
);

// ── Incident-level PATCH routes (/incidents/:incidentId) ──────────────────────

// PATCH /incidents/:incidentId/resolve
incidentRouter.patch(
  '/:incidentId/resolve',
  authenticate,
  asyncHandler(verifyIncidentAccess),
  asyncHandler(async (req, res) => {
    const result = await resolveIncident(req.params.incidentId, req.orgId);

    // Look up the resolver's name to include in the Slack notification
    const resolver = await db('users').where({ id: req.user.id }).whereNull('deleted_at').select('full_name', 'email').first();
    const resolvedByName = resolver ? (resolver.full_name || resolver.email) : req.user.id;
    notifyAlertResolved(result, resolvedByName);

    res.status(200).json({ status: 1, data: result });
  })
);

// PATCH /incidents/:incidentId — assign_to and/or priority
incidentRouter.patch(
  '/:incidentId',
  authenticate,
  asyncHandler(verifyIncidentAccess),
  asyncHandler(async (req, res) => {
    // assigned_to, priority — at least one required
    const schema = Joi.object({
      assigned_to: Joi.string().uuid(),
      priority:    Joi.string().valid('high', 'medium', 'low'),
    }).min(1);

    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ status: 0, error: error.details.map((d) => d.message) });
    }

    const result = await updateIncidentConfig(req.params.incidentId, req.orgId, {
      assignedTo: value.assigned_to,
      priority:   value.priority,
    });
    res.status(200).json({ status: 1, data: result });
  })
);

module.exports = { resourceRouter: router, incidentRouter };
