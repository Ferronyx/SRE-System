'use strict';

const { fromTemporaryCredentials } = require('@aws-sdk/credential-providers');

/**
 * Builds an AWS SDK client config from either static keys or a role ARN.
 * @param {{ accessKeyId?, secretAccessKey?, roleArn?, externalId?, region: string }} awsCreds
 * @returns {Promise<{ region: string, credentials?: object }>}
 */
async function buildClient(awsCreds) {
  const { region } = awsCreds;

  if (awsCreds.roleArn) {
    const assumeRoleParams = {
      RoleArn: awsCreds.roleArn,
      RoleSessionName: 'SreResourceSync',
    };
    if (awsCreds.externalId) {
      assumeRoleParams.ExternalId = awsCreds.externalId;
    }

    return {
      region,
      credentials: fromTemporaryCredentials({ params: assumeRoleParams }),
    };
  }

  // Static access key
  return {
    region,
    credentials: {
      accessKeyId: awsCreds.accessKeyId,
      secretAccessKey: awsCreds.secretAccessKey,
    },
  };
}

module.exports = { buildClient };
