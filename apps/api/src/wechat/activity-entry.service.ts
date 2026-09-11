import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { WechatActivityEntryToken } from '../../database/entities/index.js';
import { SessionService } from '../auth/session.service.js';
import { WechatIdentityService } from './wechat-identity.service.js';

export type EntryIssueResult =
  | { status: 'issued'; url: string; activityCode: string }
  | { status: 'no-active-activity' }
  | { status: 'multiple-active-activities' };

export type EntryExchangeResult =
  | { status: 'exchanged'; activityCode: string; sessionToken: string }
  | { status: 'invalid'; activityCode: string | null };

type ActiveActivity = { id: string; code: string };
type EntryTokenRow = {
  id: string;
  user_id: string;
  activity_code: string;
  expires_at: Date;
  consumed_at: Date | null;
};

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class WechatActivityEntryService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(WechatIdentityService)
    private readonly identities: WechatIdentityService,
    @Inject(SessionService) private readonly sessions: SessionService,
    private readonly publicBaseUrl: string,
    private readonly now: () => Date = () => new Date(),
    private readonly randomToken: () => string = () =>
      randomBytes(32).toString('base64url'),
  ) {}

  async issue(openid: string): Promise<EntryIssueResult> {
    const { userId } = await this.identities.getOrCreateUser(openid);
    await this.identities.markSubscribed(openid);
    const now = this.now();
    const activities = await this.dataSource.query<ActiveActivity[]>(
      `SELECT activity.id,activity.code
       FROM activity
       JOIN activity_version version ON version.id=activity.published_version_id
       WHERE version.starts_at <= $1 AND $1 < version.ends_at
       LIMIT 2`,
      [now],
    );
    if (activities.length === 0) return { status: 'no-active-activity' };
    if (activities.length > 1) return { status: 'multiple-active-activities' };

    const activity = activities[0]!;
    const token = this.randomToken();
    await this.dataSource.getRepository(WechatActivityEntryToken).insert({
      id: randomUUID(),
      tokenHash: tokenHash(token),
      userId,
      activityId: activity.id,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    });
    return {
      status: 'issued',
      activityCode: activity.code,
      url: `${this.publicBaseUrl}/api/activity/entry?t=${token}`,
    };
  }

  async exchange(token: string): Promise<EntryExchangeResult> {
    if (!token || token.length > 512)
      return { status: 'invalid', activityCode: null };
    const hash = tokenHash(token);
    return this.dataSource.transaction(async (manager) => {
      const now = this.now();
      const entries = await manager.query<EntryTokenRow[]>(
        `SELECT entry.id,entry.user_id,activity.code AS activity_code,entry.expires_at,entry.consumed_at
         FROM wechat_activity_entry_token entry
         JOIN activity ON activity.id=entry.activity_id
         WHERE entry.token_hash=$1
         FOR UPDATE OF entry`,
        [hash],
      );
      const entry = entries[0];
      if (!entry) return { status: 'invalid', activityCode: null };
      if (entry.consumed_at || new Date(entry.expires_at) <= now)
        return { status: 'invalid', activityCode: entry.activity_code };

      await manager.query(
        'UPDATE wechat_activity_entry_token SET consumed_at=$2 WHERE id=$1',
        [entry.id, now],
      );
      const session = await this.sessions.create(
        'ACTIVITY',
        entry.user_id,
        manager,
      );
      return {
        status: 'exchanged',
        activityCode: entry.activity_code,
        sessionToken: session.token,
      };
    });
  }
}
