import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class WechatIdentityService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource, private readonly appId = process.env.WECHAT_APP_ID ?? '') {}

  async getOrCreateUser(openid: string): Promise<{ userId: string }> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`${this.appId}:${openid}`]);
      const existing = await manager.query<{ user_id: string }[]>(`SELECT user_id FROM wechat_identity WHERE app_id=$1 AND openid=$2`, [this.appId, openid]);
      if (existing[0]) return { userId: existing[0].user_id };
      const userId = randomUUID();
      await manager.query(`INSERT INTO user_account (id) VALUES ($1)`, [userId]);
      await manager.query(`INSERT INTO wechat_identity (id, user_id, app_id, openid) VALUES ($1,$2,$3,$4)`, [randomUUID(), userId, this.appId, openid]);
      return { userId };
    });
  }
}
