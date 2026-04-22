'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.CREDENTIAL_ENCRYPTION_KEY;

function getKey() {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(KEY_HEX, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a JSON string containing base64-encoded iv, ciphertext, and authTag.
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
  });
}

/**
 * Decrypts a JSON string produced by encrypt().
 * Returns the original plaintext string.
 */
function decrypt(encryptedJson) {
  const key = getKey();
  const { iv, ciphertext, authTag } = JSON.parse(encryptedJson);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };
