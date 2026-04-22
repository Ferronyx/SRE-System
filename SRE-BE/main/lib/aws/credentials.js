'use strict';

// Builds AWS SDK credential config from a cloud account's auth_type and decrypted creds
function buildAwsCredentials(authType, creds, region) {
  if (authType === 'access_key') {
    return { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey, region };
  }
  if (authType === 'role_arn') {
    return { roleArn: creds.roleArn, externalId: creds.externalId, region };
  }
  throw new Error(`Unsupported auth_type: ${authType}`);
}

module.exports = { buildAwsCredentials };
