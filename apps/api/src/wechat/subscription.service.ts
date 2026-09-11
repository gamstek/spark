import { createHash } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { WechatIdentity } from '../../database/entities/accounts.entities.js';

import { WechatGateway } from './wechat.gateway.js';
import { WechatTokenService } from './token.service.js';
import { isDevelopmentWechatIdentity } from './development-identity.js';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(WechatGateway) private readonly gateway: WechatGateway,
    @Inject(WechatTokenService) private readonly tokens: WechatTokenService,
  ) {}

  async isSubscribed(openid: string): Promise<boolean> {
    const identityFingerprint = createHash('sha256')
      .update(openid)
      .digest('hex')
      .slice(0, 12);
    if (isDevelopmentWechatIdentity(openid)) {
      this.logger.debug({
        event: 'wechat.subscription.simulated',
        identityFingerprint,
      });
      return true;
    }

    const appId = process.env.WECHAT_APP_ID ?? '';
    const identities = this.dataSource.getRepository(WechatIdentity);
    this.logger.log({
      event: 'wechat.subscription.check_started',
      identityFingerprint,
    });
    try {
      const subscribed = await this.gateway.isSubscribed(
        openid,
        await this.tokens.getAccessToken(),
      );
      const updated = await identities.update(
        { appId, openid },
        { subscribed, subscriptionCheckedAt: () => 'now()' },
      );
      this.logger.log({
        event: 'wechat.subscription.check_succeeded',
        identityFingerprint,
        subscribed,
        identityUpdated: updated.affected === 1,
      });
      return subscribed;
    } catch (error) {
      this.logger.error({
        event: 'wechat.subscription.check_failed',
        identityFingerprint,
        reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      });
      throw error;
    }
  }
}
