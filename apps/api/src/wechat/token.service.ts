import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { WechatGateway } from './wechat.gateway.js';

@Injectable()
export class WechatTokenService {
  private readonly encryptionKey: Buffer;

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(WechatGateway) private readonly gateway: WechatGateway,
  ) {
    const secret = process.env.WECHAT_TOKEN_ENCRYPTION_KEY;
    if (process.env.NODE_ENV === 'production' && !secret)
      throw new Error('WECHAT_TOKEN_ENCRYPTION_KEY_REQUIRED');
    this.encryptionKey = createHash('sha256')
      .update(secret ?? 'development-token-key')
      .digest();
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
  }

  private decrypt(value: string): string {
    const [ivText, tagText, ciphertextText] = value.split('.');
    if (!ivText || !tagText || !ciphertextText)
      throw new Error('WECHAT_TOKEN_CACHE_INVALID');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(ivText, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  async getAccessToken(): Promise<string> {
    const appId = process.env.WECHAT_APP_ID ?? '';
    const cached = await this.dataSource.query<
      { access_token_ciphertext: string; expires_at: Date }[]
    >(
      `SELECT access_token_ciphertext, expires_at FROM wechat_credential_cache WHERE app_id=$1`,
      [appId],
    );
    if (
      cached[0] &&
      new Date(cached[0].expires_at).getTime() > Date.now() + 60_000
    )
      return this.decrypt(cached[0].access_token_ciphertext);

    await this.dataSource.query(
      `INSERT INTO wechat_credential_cache (app_id, access_token_ciphertext, expires_at) VALUES ($1,'',to_timestamp(0)) ON CONFLICT DO NOTHING`,
      [appId],
    );
    const leaseResult = await this.dataSource.query<
      [{ app_id: string }[], number]
    >(
      `UPDATE wechat_credential_cache SET refresh_lease_until=now() + interval '15 seconds'
       WHERE app_id=$1 AND (refresh_lease_until IS NULL OR refresh_lease_until < now()) RETURNING app_id`,
      [appId],
    );
    if (!leaseResult[0][0]) throw new Error('WECHAT_TOKEN_REFRESH_BUSY');

    try {
      const fresh = await this.gateway.fetchStableAccessToken();
      const expiresAt = new Date(
        Date.now() + Math.max(60, fresh.expiresIn - 120) * 1000,
      );
      await this.dataSource.query(
        `UPDATE wechat_credential_cache SET access_token_ciphertext=$2, expires_at=$3, refresh_lease_until=NULL, updated_at=now() WHERE app_id=$1`,
        [appId, this.encrypt(fresh.accessToken), expiresAt],
      );
      return fresh.accessToken;
    } catch (error) {
      await this.dataSource.query(
        `UPDATE wechat_credential_cache SET refresh_lease_until=NULL WHERE app_id=$1`,
        [appId],
      );
      throw error;
    }
  }
}
