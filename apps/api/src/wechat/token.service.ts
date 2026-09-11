import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { WechatCredentialCache } from '../../database/entities/accounts.entities.js';

import { WechatGateway } from './wechat.gateway.js';

@Injectable()
export class WechatTokenService {
  private readonly logger = new Logger(WechatTokenService.name);
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
    const credentials = this.dataSource.getRepository(WechatCredentialCache);
    const cached = await credentials.findOne({
      select: { accessTokenCiphertext: true, expiresAt: true },
      where: { appId },
    });
    if (cached && cached.expiresAt.getTime() > Date.now() + 60_000) {
      this.logger.debug({
        event: 'wechat.token.cache_hit',
        expiresAt: cached.expiresAt.toISOString(),
      });
      return this.decrypt(cached.accessTokenCiphertext);
    }

    await credentials
      .createQueryBuilder()
      .insert()
      .values({
        appId,
        accessTokenCiphertext: '',
        expiresAt: new Date(0),
      })
      .orIgnore()
      .execute();
    const leaseResult = await this.dataSource.query<
      [{ app_id: string }[], number]
    >(
      `UPDATE wechat_credential_cache SET refresh_lease_until=now() + interval '15 seconds'
       WHERE app_id=$1 AND (refresh_lease_until IS NULL OR refresh_lease_until < now()) RETURNING app_id`,
      [appId],
    );
    if (!leaseResult[0][0]) {
      this.logger.warn({ event: 'wechat.token.refresh_busy' });
      throw new Error('WECHAT_TOKEN_REFRESH_BUSY');
    }

    try {
      this.logger.log({ event: 'wechat.token.refresh_started' });
      const fresh = await this.gateway.fetchStableAccessToken();
      const expiresAt = new Date(
        Date.now() + Math.max(60, fresh.expiresIn - 120) * 1000,
      );
      await credentials.update(
        { appId },
        {
          accessTokenCiphertext: this.encrypt(fresh.accessToken),
          expiresAt,
          refreshLeaseUntil: null,
          updatedAt: () => 'now()',
        },
      );
      this.logger.log({
        event: 'wechat.token.refresh_succeeded',
        expiresAt: expiresAt.toISOString(),
      });
      return fresh.accessToken;
    } catch (error) {
      await credentials.update({ appId }, { refreshLeaseUntil: null });
      this.logger.error({
        event: 'wechat.token.refresh_failed',
        reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      });
      throw error;
    }
  }
}
