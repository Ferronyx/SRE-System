'use strict';

const db = require('../db');

/**
 * Get all orgs + roles for a user.
 */
async function getMyOrgs(userId) {
  return db('org_members')
    .join('orgs', 'orgs.id', 'org_members.org_id')
    .where('org_members.user_id', userId)
    .whereNull('orgs.deleted_at')
    .select(
      'orgs.id',
      'orgs.name',
      'orgs.slug',
      'orgs.plan',
      'org_members.role',
      'org_members.created_at as joined_at'
    )
    .orderBy('org_members.created_at', 'asc');
}

/**
 * Paginated list of members in an org with their roles.
 */
async function listMembers(orgId, page, limit) {
  const offset = (page - 1) * limit;

  const [{ count }] = await db('org_members')
    .where('org_id', orgId)
    .count('id as count');

  const members = await db('org_members')
    .join('users', 'users.id', 'org_members.user_id')
    .where('org_members.org_id', orgId)
    .whereNull('users.deleted_at')
    .select(
      'users.id',
      'users.email',
      'users.full_name',
      'org_members.role',
      'org_members.created_at as joined_at'
    )
    .orderBy('org_members.created_at', 'asc')
    .limit(limit)
    .offset(offset);

  return { data: members, meta: { page, limit, total: parseInt(count, 10) } };
}

/**
 * Change a member's role within an org.
 * Actor must be the org owner (verified from DB, not JWT).
 */
async function changeMemberRole(orgId, targetUserId, newRole, actorUserId) {
  // Verify actor is the org owner (fresh DB lookup)
  const actorMembership = await db('org_members')
    .where({ org_id: orgId, user_id: actorUserId })
    .first();

  if (!actorMembership || actorMembership.role !== 'owner') {
    const err = new Error('Only the org owner can change member roles.');
    err.status = 403;
    throw err;
  }

  if (actorUserId === targetUserId) {
    const err = new Error('Cannot change your own role.');
    err.status = 400;
    throw err;
  }

  // Prevent demoting the only owner
  if (newRole !== 'owner') {
    const targetMembership = await db('org_members')
      .where({ org_id: orgId, user_id: targetUserId })
      .first();

    if (targetMembership?.role === 'owner') {
      const ownerCount = await db('org_members')
        .where({ org_id: orgId, role: 'owner' })
        .count('id as count')
        .first();

      if (parseInt(ownerCount.count, 10) <= 1) {
        const err = new Error('Cannot demote the only owner of an org.');
        err.status = 400;
        throw err;
      }
    }
  }

  const [updated] = await db('org_members')
    .where({ org_id: orgId, user_id: targetUserId })
    .update({ role: newRole, updated_at: db.fn.now() })
    .returning(['user_id', 'role']);

  if (!updated) {
    const err = new Error('Member not found in this org.');
    err.status = 404;
    throw err;
  }

  return updated;
}

/**
 * Remove a member from an org.
 * Actor must be admin+ (verified from DB).
 * Cannot remove the org owner or yourself.
 */
async function removeMember(orgId, targetUserId, actorUserId) {
  const actorMembership = await db('org_members')
    .where({ org_id: orgId, user_id: actorUserId })
    .first();

  const roleLevel = { viewer: 1, member: 2, admin: 3, owner: 4 };
  if (!actorMembership || roleLevel[actorMembership.role] < roleLevel['admin']) {
    const err = new Error('Admin or higher role required to remove members.');
    err.status = 403;
    throw err;
  }

  if (actorUserId === targetUserId) {
    const err = new Error('Cannot remove yourself from the org.');
    err.status = 400;
    throw err;
  }

  const targetMembership = await db('org_members')
    .where({ org_id: orgId, user_id: targetUserId })
    .first();

  if (!targetMembership) {
    const err = new Error('Member not found in this org.');
    err.status = 404;
    throw err;
  }

  if (targetMembership.role === 'owner') {
    const err = new Error('Cannot remove the org owner.');
    err.status = 400;
    throw err;
  }

  await db('org_members').where({ org_id: orgId, user_id: targetUserId }).delete();
}

module.exports = { getMyOrgs, listMembers, changeMemberRole, removeMember };
