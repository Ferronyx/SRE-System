'use strict';

const { S3Client, ListBucketsCommand, GetBucketLocationCommand } = require('@aws-sdk/client-s3');
const { buildClient } = require('./clientFactory');

/**
 * Returns all S3 buckets (with their regions).
 * S3 is a global service so we use us-east-1 to list, then look up each bucket's region.
 */
async function describeS3(awsCreds) {
  const listCreds = { ...awsCreds, region: 'us-east-1' };
  const client = new S3Client(await buildClient(listCreds));

  const resp = await client.send(new ListBucketsCommand({}));
  const buckets = resp.Buckets || [];

  const enriched = await Promise.allSettled(
    buckets.map(async (bucket) => {
      let region = 'us-east-1';
      try {
        const locResp = await client.send(new GetBucketLocationCommand({ Bucket: bucket.Name }));
        // AWS returns null for us-east-1
        region = locResp.LocationConstraint || 'us-east-1';
      } catch {
        // ignore location errors — keep us-east-1 as fallback
      }
      return {
        Name: bucket.Name,
        CreationDate: bucket.CreationDate,
        Region: region,
      };
    })
  );

  return enriched
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

module.exports = { describeS3 };
