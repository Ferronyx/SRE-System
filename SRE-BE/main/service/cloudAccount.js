'use strict';

const db = require('../db');
const { encrypt, decrypt } = require('../lib/crypto');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { resourceSyncQueue } = require('../../workers');

// Returns a safe display version of the account — never exposes raw credentials
function maskCredentials(account) {
  let credDisplay;
  if (account.auth_type === 'access_key') {
    try {
      const parsed = JSON.parse(decrypt(account.encrypted_creds));
      const keyId  = parsed.accessKeyId || '';
      credDisplay  = keyId.length > 8 ? `${keyId.slice(0, 4)}***${keyId.slice(-4)}` : `${keyId.slice(0, 2)}***`;
    } catch {
      credDisplay = '***';
    }
  } else if (account.auth_type === 'role_arn') {
    try {
      const parsed = JSON.parse(decrypt(account.encrypted_creds));
      credDisplay  = parsed.roleArn || '***';
    } catch {
      credDisplay = '***';
    }
  } else {
    credDisplay = '***';
  }

  const { encrypted_creds, ...safe } = account;
  return { ...safe, credential_display: credDisplay };
}

// Creates a cloud account with encrypted credentials and returns masked version
async function create(orgId, { name, provider = 'aws', authType, credentials, regions = [] }) {
  const encrypted = encrypt(JSON.stringify(credentials));

  const [account] = await db('cloud_accounts')
    .insert({
      org_id:          orgId,
      name,
      provider,
      auth_type:       authType,
      encrypted_creds: encrypted,
      regions:         JSON.stringify(regions),
    })
    .returning('*');

  return maskCredentials(account);
}

// Lists all active cloud accounts for an org (credentials masked)
async function list(orgId) {
  const accounts = await db('cloud_accounts')
    .where({ org_id: orgId })
    .whereNull('deleted_at')
    .orderBy('created_at', 'asc');

  return accounts.map(maskCredentials);
}

// Fetches a single cloud account by id with org ownership check
async function getById(id, orgId) {
  const account = await db('cloud_accounts')
    .where({ id, org_id: orgId })
    .whereNull('deleted_at')
    .first();

  if (!account) {
    const err = new Error('Cloud account not found.');
    err.status = 404;
    throw err;
  }

  return account;
}

// Hard-deletes a cloud account (cascades to resources via application logic)
async function remove(id, orgId) {
  const deleted = await db('cloud_accounts')
    .where({ id, org_id: orgId })
    .whereNull('deleted_at')
    .delete();

  if (!deleted) {
    const err = new Error('Cloud account not found.');
    err.status = 404;
    throw err;
  }
}

// Validates AWS credentials by making a live STS GetCallerIdentity call
async function validate(id, orgId) {
  const account = await getById(id, orgId);
  const creds   = JSON.parse(decrypt(account.encrypted_creds));

  let stsConfig;
  if (account.auth_type === 'access_key') {
    stsConfig = {
      region:      'us-east-1',
      credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey },
    };
  } else if (account.auth_type === 'role_arn') {
    // Role ARN validation requires assume-role; use ambient creds for basic check
    stsConfig = { region: 'us-east-1' };
  } else {
    return { valid: false, error: `Unsupported auth_type: ${account.auth_type}` };
  }

  // Build client fresh per call — never cache decrypted credentials
  const client = new STSClient(stsConfig);

  try {
    const response = await client.send(new GetCallerIdentityCommand({}));
    return { valid: true, accountId: response.Account, arn: response.Arn, userId: response.UserId };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// Marks the account as syncing so callers can track state
async function markSyncing(id, orgId) {
  const [updated] = await db('cloud_accounts')
    .where({ id, org_id: orgId })
    .whereNull('deleted_at')
    .update({ sync_status: 'syncing', updated_at: db.fn.now() })
    .returning('*');

  if (!updated) {
    const err = new Error('Cloud account not found.');
    err.status = 404;
    throw err;
  }

  return updated;
}

// Enqueues a resource-sync job and marks account as syncing
async function enqueueSync(id, orgId) {
  const account = await markSyncing(id, orgId);
  const job = await resourceSyncQueue.add(
    { cloud_account_id: id },
    { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 50 }
  );
  return { jobId: job.id, status: 'queued', accountId: account.id };
}

module.exports = { create, list, getById, remove, validate, markSyncing, enqueueSync, maskCredentials };
