'use strict';

const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { buildClient } = require('./clientFactory');

/**
 * Returns all RDS DB instances in the given region.
 */
async function describeRds(awsCreds) {
  const client = new RDSClient(await buildClient(awsCreds));
  const instances = [];
  let marker;

  do {
    const resp = await client.send(new DescribeDBInstancesCommand({
      Marker: marker,
      MaxRecords: 100,
    }));

    for (const db of (resp.DBInstances || [])) {
      instances.push({
        DBInstanceIdentifier: db.DBInstanceIdentifier,
        DBInstanceClass: db.DBInstanceClass,
        Engine: db.Engine,
        EngineVersion: db.EngineVersion,
        DBInstanceStatus: db.DBInstanceStatus,
        AvailabilityZone: db.AvailabilityZone,
        MultiAZ: db.MultiAZ,
        AllocatedStorage: db.AllocatedStorage,
        Endpoint: db.Endpoint,
        Region: awsCreds.region,
      });
    }

    marker = resp.Marker;
  } while (marker);

  return instances;
}

module.exports = { describeRds };
