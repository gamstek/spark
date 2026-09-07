import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { WechatGateway } from './wechat.gateway.js';
import { WechatTokenService } from './token.service.js';

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(WechatGateway) private readonly gateway: WechatGateway,
    @Inject(WechatTokenService) private readonly tokens: WechatTokenService,
  ) {}

  async isSubscribed(openid: string): Promise<boolean> {
    const appId = process.env.WECHAT_APP_ID ?? '';
    const cached = await this.dataSource.query<
      { subscribed: boolean | null; subscription_checked_at: Date | null }[]
    >(
      `SELECT subscribed, subscription_checked_at FROM wechat_identity WHERE app_id=$1 AND openid=$2`,
      [appId, openid],
    );
    const identity = cached[0];
    if (
      identity?.subscription_checked_at &&
      Date.now() - new Date(identity.subscription_checked_at).getTime() <=
        60_000 &&
      identity.subscribed !== null
    ) {
      return identity.subscribed;
    }
    const subscribed = await this.gateway.isSubscribed(
      openid,
      await this.tokens.getAccessToken(),
    );
    await this.dataSource.query(
      `UPDATE wechat_identity SET subscribed=$3, subscription_checked_at=now() WHERE app_id=$1 AND openid=$2`,
      [appId, openid, subscribed],
    );
    return subscribed;
  }
}
