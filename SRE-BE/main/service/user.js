'use strict';

const db = require('../db');

/**
 * Get current user's profile + their membership in the given org.
 */
async function getMe(userId, orgId) {
  const user = await db('users')
    .where('id', userId)
    .whereNull('deleted_at')
    .select('id', 'email', 'full_name', 'is_verified', 'last_login_at', 'created_at')
    .first();

  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }

  const membership = await db('org_members')
    .join('orgs', 'orgs.id', 'org_members.org_id')
    .where('org_members.user_id', userId)
    .where('org_members.org_id', orgId)
    .select('org_members.role', 'orgs.id as org_id', 'orgs.name as org_name', 'orgs.slug')
    .first();

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    isVerified: user.is_verified,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    org: membership
      ? { id: membership.org_id, name: membership.org_name, slug: membership.slug }
      : null,
    role: membership?.role ?? null,
  };
}

/**
 * Update the current user's full_name. Returns updated user fields.
 */
async function updateMe(userId, fullName) {
  const [updated] = await db('users')
    .where('id', userId)
    .whereNull('deleted_at')
    .update({ full_name: fullName, updated_at: db.fn.now() })
    .returning(['id', 'email', 'full_name', 'is_verified', 'updated_at']);

  if (!updated) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }

  return {
    id: updated.id,
    email: updated.email,
    fullName: updated.full_name,
    isVerified: updated.is_verified,
    updatedAt: updated.updated_at,
  };
}

module.exports = { getMe, updateMe };
