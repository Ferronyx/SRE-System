'use strict';

const Sentry     = require('@sentry/node');
const db         = require('../main/db');
const { decrypt } = require('../main/lib/crypto');
const { buildAwsCredentials } = require('../main/lib/aws/credentials');
const { describeEc2 }    = require('../main/lib/aws/ec2');
const { describeRds }    = require('../main/lib/aws/rds');
const { describeS3 }     = require('../main/lib/aws/s3');
const { describeLambda } = require('../main/lib/aws/lambda');
const { describeElb }    = require('../main/lib/aws/elb');
const { normalizeEc2, normalizeRds, normalizeS3, normalizeLambda, normalizeElb } = require('../main/lib/aws/normalize');
const { upsertResources, markStaleResources } = require('../main/service/resource');
const { syncAlarmsFromAws } = require('../main/service/threshold');

/**
 * Bull processor — discovers all AWS resources for a cloud account and upserts them into DB.
 * Receives job data: { cloud_account_id }
 */
module.exports = async function resourceSyncProcessor(job) {
  const { cloud_account_id } = job.data;
  console.log(`[sync] job started  jobId=${job.id}  cloud_account_id=${cloud_account_id}`);

  // Load the cloud account with encrypted credentials
  const account = await db('cloud_accounts')
    .where({ id: cloud_account_id })
    .whereNull('deleted_at')
    .first();

  if (!account) {
    const err = new Error(`Cloud account ${cloud_account_id} not found`);
    Sentry.captureException(err);
    throw err;
  }

  const creds   = JSON.parse(decrypt(account.encrypted_creds));
  const regions = account.regions && account.regions.length > 0 ? account.regions : ['us-east-1'];
  const context = { orgId: account.org_id, cloudAccountId: account.id };

  // Run all service describers across all regions in parallel
  // Preserve awsCreds per region so we can use them for alarm sync after upsert
  const regionTasks = regions.map((region) => {
    const awsCreds = buildAwsCredentials(account.auth_type, creds, region);
    return runRegionSync(awsCreds, region, context).then((resources) => ({ resources, awsCreds, region }));
  });

  const results      = await Promise.allSettled(regionTasks);
  const allResources = [];
  const regionMeta   = []; // { awsCreds, region } for successful regions

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      allResources.push(...result.value.resources);
      regionMeta.push({ awsCreds: result.value.awsCreds, region: result.value.region });
    } else {
      // Log region failure but continue — partial sync is better than no sync
      console.error(`[sync] region=${regions[i]} failed  error=${result.reason?.message}`);
      Sentry.captureException(result.reason, { extra: { cloud_account_id, region: regions[i] } });
    }
  }

  // Upsert all discovered resources
  if (allResources.length > 0) {
    await upsertResources(allResources);

    const resourceRows = await db('resources')
      .where({ cloud_account_id })
      .whereNull('deleted_at')
      .whereIn('external_id', allResources.map((r) => r.external_id))
      .select('id', 'service', 'external_id', 'name', 'region');

    // Sync CloudWatch alarms from AWS into alert_thresholds, per region
    for (const { awsCreds, region } of regionMeta) {
      const regionResources = resourceRows.filter((r) => r.region === region);
      if (regionResources.length === 0) continue;

      try {
        await syncAlarmsFromAws(awsCreds, regionResources, cloud_account_id);
      } catch (err) {
        console.error(`[alarmSync] region=${region} failed  error=${err.message}`);
        Sentry.captureException(err, { extra: { cloud_account_id, region } });
      }
    }
  }

  // Soft-delete resources not seen in this sync
  await markStaleResources(cloud_account_id, allResources.map((r) => r.external_id));

  // Mark account sync as complete
  await db('cloud_accounts')
    .where({ id: cloud_account_id })
    .update({ sync_status: 'done', last_synced_at: db.fn.now(), updated_at: db.fn.now() });

  console.log(`[sync] job complete  jobId=${job.id}  resourceCount=${allResources.length}`);
  return { resourceCount: allResources.length };
};

// Runs all AWS describe calls for a single region and returns normalized resource array
async function runRegionSync(awsCreds, region, context) {
  const [ec2Instances, rdsInstances, s3Buckets, lambdaFunctions, elbBalancers] =
    await Promise.allSettled([
      describeEc2(awsCreds),
      describeRds(awsCreds),
      describeS3(awsCreds),
      describeLambda(awsCreds),
      describeElb(awsCreds),
    ]);

  const resources = [];

  if (ec2Instances.status    === 'fulfilled') resources.push(...ec2Instances.value.map((r) => normalizeEc2(r, context)));
  if (rdsInstances.status    === 'fulfilled') resources.push(...rdsInstances.value.map((r) => normalizeRds(r, context)));
  if (s3Buckets.status       === 'fulfilled') resources.push(...s3Buckets.value.map((r) => normalizeS3(r, context)));
  if (lambdaFunctions.status === 'fulfilled') resources.push(...lambdaFunctions.value.map((r) => normalizeLambda(r, context)));
  if (elbBalancers.status    === 'fulfilled') resources.push(...elbBalancers.value.map((r) => normalizeElb(r, context)));

  // Log individual service errors for region without failing the whole region
  [ec2Instances, rdsInstances, s3Buckets, lambdaFunctions, elbBalancers].forEach((r, idx) => {
    if (r.status === 'rejected') {
      const service = ['ec2', 'rds', 's3', 'lambda', 'elb'][idx];
      console.error(`[sync:${region}] ${service} describe failed  error=${r.reason?.message}`);
    }
  });

  return resources;
}
