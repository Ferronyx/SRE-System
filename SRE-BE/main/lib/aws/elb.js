'use strict';

const {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
} = require('@aws-sdk/client-elastic-load-balancing-v2');
const { buildClient } = require('./clientFactory');

/**
 * Returns all ELBv2 load balancers (ALB/NLB) in the given region.
 */
async function describeElb(awsCreds) {
  const client = new ElasticLoadBalancingV2Client(await buildClient(awsCreds));
  const balancers = [];
  let marker;

  do {
    const resp = await client.send(new DescribeLoadBalancersCommand({
      Marker: marker,
    }));

    for (const lb of (resp.LoadBalancers || [])) {
      balancers.push({
        LoadBalancerArn: lb.LoadBalancerArn,
        LoadBalancerName: lb.LoadBalancerName,
        Type: lb.Type,
        Scheme: lb.Scheme,
        State: lb.State?.Code,
        VpcId: lb.VpcId,
        DNSName: lb.DNSName,
        CreatedTime: lb.CreatedTime,
        Region: awsCreds.region,
      });
    }

    marker = resp.NextMarker;
  } while (marker);

  return balancers;
}

module.exports = { describeElb };
