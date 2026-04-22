'use strict';

const { LambdaClient, ListFunctionsCommand } = require('@aws-sdk/client-lambda');
const { buildClient } = require('./clientFactory');

/**
 * Returns all Lambda functions in the given region.
 */
async function describeLambda(awsCreds) {
  const client = new LambdaClient(await buildClient(awsCreds));
  const functions = [];
  let marker;

  do {
    const resp = await client.send(new ListFunctionsCommand({
      Marker: marker,
      MaxItems: 50,
    }));

    for (const fn of (resp.Functions || [])) {
      functions.push({
        FunctionName: fn.FunctionName,
        FunctionArn: fn.FunctionArn,
        Runtime: fn.Runtime,
        MemorySize: fn.MemorySize,
        Timeout: fn.Timeout,
        State: fn.State,
        LastModified: fn.LastModified,
        Description: fn.Description,
        Region: awsCreds.region,
      });
    }

    marker = resp.NextMarker;
  } while (marker);

  return functions;
}

module.exports = { describeLambda };
