import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  UserAccount,
  WechatIdentity,
} from '../../database/entities/accounts.entities.js';

@Injectable()
export class WechatIdentityService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    private readonly appId = process.env.WECHAT_APP_ID ?? '',
  ) {}

  async getOrCreateUser(openid: string): Promise<{ userId: string }> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`${this.appId}:${openid}`],
      );
      const identities = manager.getRepository(WechatIdentity);
      const existing = await identities.findOne({
        select: { userId: true },
        where: { appId: this.appId, openid },
      });
      if (existing) return { userId: existing.userId };
      const userId = randomUUID();
      await manager.getRepository(UserAccount).insert({ id: userId });
      await identities.insert({
        id: randomUUID(),
        userId,
        appId: this.appId,
        openid,
      });
      return { userId };
    });
  }

  async markSubscribed(openid: string): Promise<void> {
    await this.dataSource
      .getRepository(WechatIdentity)
      .update(
        { appId: this.appId, openid },
        { subscribed: true, subscriptionCheckedAt: () => 'now()' },
      );
  }

  async markUnsubscribed(openid: string): Promise<void> {
    await this.dataSource
      .getRepository(WechatIdentity)
      .update(
        { appId: this.appId, openid },
        { subscribed: false, subscriptionCheckedAt: () => 'now()' },
      );
  }
}
