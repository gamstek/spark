import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { WechatIdentity } from '../../database/entities/accounts.entities.js';

import { WechatGateway } from './wechat.gateway.js';
import { WechatTokenService } from './token.service.js';
import { isDevelopmentWechatIdentity } from './development-identity.js';

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(WechatGateway) private readonly gateway: WechatGateway,
    @Inject(WechatTokenService) private readonly tokens: WechatTokenService,
  ) {}

  async isSubscribed(openid: string): Promise<boolean> {
    if (isDevelopmentWechatIdentity(openid)) return true;

    const appId = process.env.WECHAT_APP_ID ?? '';
    const identities = this.dataSource.getRepository(WechatIdentity);
    const identity = await identities.findOne({
      select: { subscribed: true, subscriptionCheckedAt: true },
      where: { appId, openid },
    });
    if (
      identity?.subscriptionCheckedAt &&
      Date.now() - identity.subscriptionCheckedAt.getTime() <= 60_000 &&
      identity.subscribed !== null
    ) {
      return identity.subscribed;
    }
    const subscribed = await this.gateway.isSubscribed(
      openid,
      await this.tokens.getAccessToken(),
    );
    await identities.update(
      { appId, openid },
      { subscribed, subscriptionCheckedAt: () => 'now()' },
    );
    return subscribed;
  }
}
