'use strict';

function tagValue(tags, key) {
  const tag = (tags || []).find((t) => t.Key === key);
  return tag ? tag.Value : null;
}

function now() {
  return new Date().toISOString();
}

/**
 * Normalizes an EC2 instance to the unified resource schema.
 */
function normalizeEc2(instance, { orgId, cloudAccountId }) {
  return {
    org_id: orgId,
    cloud_account_id: cloudAccountId,
    provider: 'aws',
    service: 'ec2',
    external_id: instance.InstanceId,
    name: tagValue(instance.Tags, 'Name') || instance.InstanceId,
    region: instance.Region,
    status: instance.State || 'unknown',
    metadata: {
      instance_type: instance.InstanceType,
      availability_zone: instance.Placement?.AvailabilityZone,
      vpc_id: instance.VpcId,
      subnet_id: instance.SubnetId,
      private_ip: instance.PrivateIpAddress,
      public_ip: instance.PublicIpAddress,
      launch_time: instance.LaunchTime,
    },
    last_seen_at: now(),
  };
}

/**
 * Normalizes an RDS DB instance.
 */
function normalizeRds(instance, { orgId, cloudAccountId }) {
  return {
    org_id: orgId,
    cloud_account_id: cloudAccountId,
    provider: 'aws',
    service: 'rds',
    external_id: instance.DBInstanceIdentifier,
    name: instance.DBInstanceIdentifier,
    region: instance.Region,
    status: instance.DBInstanceStatus || 'unknown',
    metadata: {
      db_instance_class: instance.DBInstanceClass,
      engine: instance.Engine,
      engine_version: instance.EngineVersion,
      availability_zone: instance.AvailabilityZone,
      multi_az: instance.MultiAZ,
      allocated_storage_gb: instance.AllocatedStorage,
      endpoint: instance.Endpoint?.Address,
      port: instance.Endpoint?.Port,
    },
    last_seen_at: now(),
  };
}

/**
 * Normalizes an S3 bucket.
 */
function normalizeS3(bucket, { orgId, cloudAccountId }) {
  return {
    org_id: orgId,
    cloud_account_id: cloudAccountId,
    provider: 'aws',
    service: 's3',
    external_id: bucket.Name,
    name: bucket.Name,
    region: bucket.Region || 'us-east-1',
    status: 'available',
    metadata: {
      creation_date: bucket.CreationDate,
    },
    last_seen_at: now(),
  };
}

/**
 * Normalizes a Lambda function.
 */
function normalizeLambda(fn, { orgId, cloudAccountId }) {
  return {
    org_id: orgId,
    cloud_account_id: cloudAccountId,
    provider: 'aws',
    service: 'lambda',
    external_id: fn.FunctionArn,
    name: fn.FunctionName,
    region: fn.Region,
    status: fn.State || 'active',
    metadata: {
      runtime: fn.Runtime,
      memory_mb: fn.MemorySize,
      timeout_s: fn.Timeout,
      last_modified: fn.LastModified,
      description: fn.Description,
    },
    last_seen_at: now(),
  };
}

/**
 * Normalizes an ELBv2 load balancer.
 */
function normalizeElb(lb, { orgId, cloudAccountId }) {
  return {
    org_id: orgId,
    cloud_account_id: cloudAccountId,
    provider: 'aws',
    service: 'elb',
    external_id: lb.LoadBalancerArn,
    name: lb.LoadBalancerName,
    region: lb.Region,
    status: lb.State || 'unknown',
    metadata: {
      type: lb.Type,
      scheme: lb.Scheme,
      vpc_id: lb.VpcId,
      dns_name: lb.DNSName,
      created_time: lb.CreatedTime,
    },
    last_seen_at: now(),
  };
}

module.exports = { normalizeEc2, normalizeRds, normalizeS3, normalizeLambda, normalizeElb };
