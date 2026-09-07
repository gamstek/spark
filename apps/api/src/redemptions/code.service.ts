import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

function keys(): Record<string, Buffer> {
  const raw = JSON.parse(process.env.REDEEM_CODE_KEYS ?? '{}') as Record<string, string>;
  return Object.fromEntries(Object.entries(raw).map(([id, value]) => [id, Buffer.from(value, 'base64')]));
}

@Injectable()
export class CodeService {
  create(): { hash: string; encryptedCode: string; keyId: string } {
    const keyId = process.env.REDEEM_CODE_ACTIVE_KEY_ID ?? '';
    const key = keys()[keyId];
    if (!key || key.length !== 32) throw new Error('REDEEM_CODE_KEY_INVALID');
    const code = randomBytes(18).toString('base64url');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
    const encryptedCode = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
    return { hash: createHash('sha256').update(code).digest('hex'), encryptedCode, keyId };
  }

  restore(encryptedCode: string, keyId: string): string {
    const key = keys()[keyId];
    if (!key || key.length !== 32) throw new Error('REDEEM_CODE_KEY_INVALID');
    const packed = Buffer.from(encryptedCode, 'base64url');
    if (packed.length < 29) throw new Error('REDEEM_CODE_INVALID');
    const decipher = createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
  }
}
