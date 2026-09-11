import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

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

  async getOrCreateUser(
    openid: string,
    manager?: EntityManager,
  ): Promise<{ userId: string }> {
    const operation = async (activeManager: EntityManager) => {
      await this.lockIdentity(activeManager, openid);
      return this.getOrCreateUserLocked(activeManager, openid);
    };
    return manager
      ? operation(manager)
      : this.dataSource.transaction(operation);
  }

  async applySubscriptionEvent(
    openid: string,
    subscribed: boolean,
    eventTime: Date,
    manager?: EntityManager,
    signal?: AbortSignal,
  ): Promise<{ applied: boolean; userId: string | null }> {
    const operation = async (activeManager: EntityManager) => {
      await this.lockIdentity(activeManager, openid);
      this.assertActive(signal);
      await this.getOrCreateUserLocked(activeManager, openid, signal);
      this.assertActive(signal);
      const updateResult = await activeManager.query(
        `UPDATE wechat_identity
         SET subscribed=$3,subscription_checked_at=$4
         WHERE app_id=$1 AND openid=$2
           AND (subscription_checked_at IS NULL
             OR subscription_checked_at < $4
             OR (subscription_checked_at = $4
               AND (subscribed=$3 OR $3=false)))
         RETURNING user_id AS "userId"`,
        [this.appId, openid, subscribed, eventTime],
      );
      this.assertActive(signal);
      const rows = updateResult[0] as { userId: string }[];
      if (rows[0]) return { applied: true, userId: rows[0].userId };
      const existing = await activeManager.query<{ user_id: string }[]>(
        `SELECT user_id FROM wechat_identity WHERE app_id=$1 AND openid=$2`,
        [this.appId, openid],
      );
      return { applied: false, userId: existing[0]?.user_id ?? null };
    };
    return manager
      ? operation(manager)
      : this.dataSource.transaction(operation);
  }

  private async lockIdentity(
    manager: EntityManager,
    openid: string,
  ): Promise<void> {
    await manager.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`${this.appId}:${openid}`],
    );
  }

  private async getOrCreateUserLocked(
    manager: EntityManager,
    openid: string,
    signal?: AbortSignal,
  ): Promise<{ userId: string }> {
    const identities = manager.getRepository(WechatIdentity);
    const existing = await identities.findOne({
      select: { userId: true },
      where: { appId: this.appId, openid },
    });
    this.assertActive(signal);
    if (existing) return { userId: existing.userId };
    const userId = randomUUID();
    await manager.getRepository(UserAccount).insert({ id: userId });
    this.assertActive(signal);
    await identities.insert({
      id: randomUUID(),
      userId,
      appId: this.appId,
      openid,
    });
    return { userId };
  }

  private assertActive(signal?: AbortSignal): void {
    if (signal?.aborted) throw new Error('WECHAT_CALLBACK_DEADLINE');
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
