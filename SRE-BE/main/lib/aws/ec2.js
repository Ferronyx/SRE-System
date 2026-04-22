'use strict';

const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { buildClient } = require('./clientFactory');

/**
 * Returns all EC2 instances in the given region.
 * @param {{ accessKeyId?, secretAccessKey?, roleArn?, externalId?, region: string }} awsCreds
 * @returns {Promise<object[]>}
 */
async function describeEc2(awsCreds) {
  const client = new EC2Client(await buildClient(awsCreds));
  const instances = [];
  let nextToken;

  do {
    const resp = await client.send(new DescribeInstancesCommand({
      NextToken: nextToken,
      MaxResults: 1000,
    }));

    for (const reservation of (resp.Reservations || [])) {
      for (const instance of (reservation.Instances || [])) {
        instances.push({
          InstanceId: instance.InstanceId,
          InstanceType: instance.InstanceType,
          State: instance.State?.Name,
          Placement: instance.Placement,
          VpcId: instance.VpcId,
          SubnetId: instance.SubnetId,
          PrivateIpAddress: instance.PrivateIpAddress,
          PublicIpAddress: instance.PublicIpAddress,
          Tags: instance.Tags || [],
          LaunchTime: instance.LaunchTime,
          Region: awsCreds.region,
        });
      }
    }

    nextToken = resp.NextToken;
  } while (nextToken);

  return instances;
}

module.exports = { describeEc2 };
