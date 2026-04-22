'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;


// Helpers
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

async function uniqueSlug(base) {
  let slug = slugify(base);
  let attempt = slug;
  let i = 2;
  while (true) {
    const existing = await db('orgs').where('slug', attempt).first();
    if (!existing) return attempt;
    attempt = `${slug}-${i++}`;
  }
}


// Auth Service
/**
 * Register a new user. Creates user, default org, and owner membership in a transaction.
 * Returns { user, org, accessToken, refreshToken }.
 */
async function register({ email, password, fullName, orgName, ip }) {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db('users').where('email', normalizedEmail).first();
  if (existing) {
    const err = new Error('An account with this email already exists.');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const slug = await uniqueSlug(orgName);

  return db.transaction(async (trx) => {
    const [user] = await trx('users')
      .insert({ email: normalizedEmail, password_hash: passwordHash, full_name: fullName })
      .returning(['id', 'email', 'full_name', 'is_verified', 'created_at']);

    const [org] = await trx('orgs')
      .insert({ name: orgName.trim(), slug })
      .returning(['id', 'name', 'slug', 'plan']);

    await trx('org_members').insert({ org_id: org.id, user_id: user.id, role: 'owner' });

    await trx('audit_logs').insert({
      org_id: org.id,
      user_id: user.id,
      action: 'user.register',
      entity_type: 'user',
      entity_id: user.id,
      ip_address: ip,
    });

    const { accessToken, refreshToken } = await _issueTokens(trx, user, org.id, 'owner', ip);

    return { user, org, accessToken, refreshToken };
  });
}

/**
 * Login with email + password.
 * Returns { user, org, role, accessToken, refreshToken }.
 */
async function login({ email, password, ip }) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await db('users')
    .where('email', normalizedEmail)
    .whereNull('deleted_at')
    .first();

  if (!user) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await db('audit_logs').insert({
      user_id: user.id,
      action: 'user.login_failed',
      entity_type: 'user',
      entity_id: user.id,
      ip_address: ip,
    });
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  // Get default org membership (first org where user is a member)
  const membership = await db('org_members')
    .join('orgs', 'orgs.id', 'org_members.org_id')
    .where('org_members.user_id', user.id)
    .whereNull('orgs.deleted_at')
    .select('orgs.id as org_id', 'orgs.name as org_name', 'orgs.slug', 'org_members.role')
    .first();

  if (!membership) {
    const err = new Error('User has no active org membership.');
    err.status = 403;
    throw err;
  }

  await db('users').where('id', user.id).update({ last_login_at: db.fn.now() });

  await db('audit_logs').insert({
    org_id: membership.org_id,
    user_id: user.id,
    action: 'user.login',
    entity_type: 'user',
    entity_id: user.id,
    ip_address: ip,
  });

  const { accessToken, refreshToken } = await _issueTokens(db, user, membership.org_id, membership.role, ip);

  return {
    user: { id: user.id, email: user.email, full_name: user.full_name },
    org: { id: membership.org_id, name: membership.org_name, slug: membership.slug },
    role: membership.role,
    accessToken,
    refreshToken,
  };
}

/**
 * Rotate a refresh token. Returns new { accessToken, refreshToken }.
 */
async function refreshTokens({ rawToken, ip }) {
  const tokenHash = hashToken(rawToken);

  const record = await db('refresh_tokens')
    .where('token_hash', tokenHash)
    .first();

  if (!record || record.revoked_at || new Date(record.expires_at) < new Date()) {
    const err = new Error('Refresh token is invalid or expired.');
    err.status = 401;
    throw err;
  }

  // Revoke old token
  await db('refresh_tokens').where('id', record.id).update({ revoked_at: db.fn.now() });

  const user = await db('users').where('id', record.user_id).first();
  if (!user) {
    const err = new Error('User not found.');
    err.status = 401;
    throw err;
  }

  const membership = await db('org_members')
    .join('orgs', 'orgs.id', 'org_members.org_id')
    .where('org_members.user_id', user.id)
    .whereNull('orgs.deleted_at')
    .select('org_members.org_id', 'org_members.role')
    .first();

  if (!membership) {
    const err = new Error('User has no active org membership.');
    err.status = 403;
    throw err;
  }

  return _issueTokens(db, user, membership.org_id, membership.role, ip);
}

/**
 * Revoke a single refresh token (logout).
 */
async function revokeToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  await db('refresh_tokens')
    .where('token_hash', tokenHash)
    .whereNull('revoked_at')
    .update({ revoked_at: db.fn.now() });
}

/**
 * Revoke all refresh tokens for a user (logout-all).
 */
async function revokeAllTokens(userId) {
  await db('refresh_tokens')
    .where('user_id', userId)
    .whereNull('revoked_at')
    .update({ revoked_at: db.fn.now() });
}


// Internal helpers
async function _issueTokens(trx, user, orgId, role, ip) {
  const jti = crypto.randomUUID();

  const accessToken = jwt.sign(
    { sub: user.id, org: orgId, role, jti },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL }
  );

  const rawRefresh = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawRefresh);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await trx('refresh_tokens').insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    ip_address: ip,
  });

  return { accessToken, refreshToken: rawRefresh };
}

module.exports = { register, login, refreshTokens, revokeToken, revokeAllTokens };
