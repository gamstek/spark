import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  ActivityInfo,
  ActivityRuntime,
  RuntimeStep,
  WinView,
} from '@spark/contracts';
import { DataSource } from 'typeorm';

import { ChannelVisit, WechatIdentity } from '../../database/entities/index.js';

import { ParticipantsService } from '../participants/participants.service.js';
import { SubscriptionService } from '../wechat/subscription.service.js';

type RuntimeRow = {
  id: string;
  template_id: string;
  template_version: number;
  config: {
    requireSubscribe?: boolean;
    noPrizeWeight?: number;
    rulesText?: string;
  };
  starts_at: Date;
  draw_ends_at: Date;
  ends_at: Date;
};

@Injectable()
export class RuntimeService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(ParticipantsService)
    private readonly participants: ParticipantsService,
    @Inject(SubscriptionService)
    private readonly subscriptions: SubscriptionService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async get(
    userId: string,
    activityCode: string,
    channel = 'direct',
    recordVisit = true,
    origin = 'http://localhost',
  ): Promise<ActivityRuntime> {
    const rows = await this.dataSource.query<RuntimeRow[]>(
      `SELECT a.id,v.template_id,v.template_version,v.config,v.starts_at,v.draw_ends_at,v.ends_at
       FROM activity a JOIN activity_version v ON v.id=a.published_version_id WHERE a.code=$1`,
      [activityCode],
    );
    const activity = rows[0];
    if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
    const participation = await this.participants.getOrCreate(
      userId,
      activity.id,
    );

    if (recordVisit) {
      const safeChannel = /^[a-zA-Z0-9_-]{1,64}$/.test(channel)
        ? channel
        : 'direct';
      await this.dataSource.getRepository(ChannelVisit).insert({
        id: randomUUID(),
        activityId: activity.id,
        userId,
        channelCode: safeChannel,
      });
    }

    const now = this.clock();
    let nextStep: RuntimeStep;
    let win: WinView | null = null;
    if (now < new Date(activity.starts_at)) {
      nextStep = 'NOT_STARTED';
    } else {
      win = await this.getWin(activity.id, userId, now, origin);
      if (win) {
        nextStep =
          win.redemptionStatus === 'REDEEMED'
            ? 'REDEEMED'
            : win.redemptionStatus === 'EXPIRED'
              ? 'EXPIRED'
              : 'PRIZE';
      } else if (participation.drawnAt) {
        nextStep = 'NO_PRIZE';
      } else if (
        now >= new Date(activity.ends_at) ||
        now >= new Date(activity.draw_ends_at)
      ) {
        nextStep = 'ENDED';
      } else if (
        activity.config.requireSubscribe &&
        !(await this.isSubscribed(userId))
      ) {
        nextStep = 'SUBSCRIBE';
      } else {
        const state = await this.dataSource.query<
          { lead_completed: boolean; available: number }[]
        >(
          `SELECT p.lead_completed,
             COALESCE((SELECT sum(ap.total_stock-ap.awarded_stock) FROM activity_version_prize vp
               JOIN activity_prize ap ON ap.id=vp.activity_prize_id
               WHERE vp.activity_version_id=(SELECT published_version_id FROM activity WHERE id=$2)),0)::int AS available
           FROM activity_participation p WHERE p.id=$1`,
          [participation.id, activity.id],
        );
        nextStep = !state[0]?.lead_completed
          ? 'FORM'
          : (state[0]?.available ?? 0) <= 0
            ? Number(activity.config.noPrizeWeight ?? 0) > 0
              ? 'LOTTERY'
              : 'OUT_OF_STOCK'
            : 'LOTTERY';
      }
    }

    return {
      activityCode,
      templateId: activity.template_id,
      templateVersion: activity.template_version,
      participationId: participation.id,
      nextStep,
      win,
    };
  }

  private absoluteUrl(url: string | null, origin: string): string | null {
    return url ? new URL(url, origin).toString() : null;
  }

  /** Display data for the participant H5: name, time window, rules, prize wall. */
  async getInfo(
    activityCode: string,
    origin = 'http://localhost',
  ): Promise<ActivityInfo> {
    const rows = await this.dataSource.query<
      {
        code: string;
        name: string;
        starts_at: Date;
        ends_at: Date;
        draw_ends_at: Date;
        config: { rulesText?: string; noPrizeWeight?: number };
      }[]
    >(
      `SELECT a.code,a.name,v.starts_at,v.ends_at,v.draw_ends_at,v.config
       FROM activity a JOIN activity_version v ON v.id=a.published_version_id WHERE a.code=$1`,
      [activityCode],
    );
    const activity = rows[0];
    if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
    const prizes = await this.dataSource.query<
      {
        prize_level: string;
        prize_name: string;
        prize_image_url: string | null;
      }[]
    >(
      `SELECT vp.prize_level,vp.prize_name,COALESCE(vp.prize_image_url,ap.prize_image_url) AS prize_image_url
       FROM activity_version_prize vp JOIN activity_prize ap ON ap.id=vp.activity_prize_id
       WHERE vp.activity_version_id=(SELECT published_version_id FROM activity WHERE code=$1)
       ORDER BY ap.created_at,ap.id`,
      [activityCode],
    );
    return {
      code: activity.code,
      name: activity.name,
      startsAt: new Date(activity.starts_at).toISOString(),
      endsAt: new Date(activity.ends_at).toISOString(),
      drawEndsAt: new Date(activity.draw_ends_at).toISOString(),
      rulesText: activity.config.rulesText ?? '',
      noPrizeWeight: Number(activity.config.noPrizeWeight ?? 0),
      prizes: prizes.map((prize) => ({
        prizeLevel: prize.prize_level,
        name: prize.prize_name,
        imageUrl: this.absoluteUrl(prize.prize_image_url, origin),
      })),
    };
  }

  private async isSubscribed(userId: string): Promise<boolean> {
    const identity = await this.dataSource
      .getRepository(WechatIdentity)
      .findOne({
        select: { openid: true },
        where: { userId, appId: process.env.WECHAT_APP_ID ?? '' },
      });
    return identity ? this.subscriptions.isSubscribed(identity.openid) : false;
  }

  private async getWin(
    activityId: string,
    userId: string,
    now: Date,
    origin: string,
  ): Promise<WinView | null> {
    await this.dataSource.query(
      `UPDATE redemption r SET status='EXPIRED' FROM lottery_record l
       WHERE r.lottery_record_id=l.id AND l.activity_id=$1 AND l.user_id=$2
         AND r.status='WAIT_REDEEM' AND r.redeem_end_at<=$3`,
      [activityId, userId, now],
    );
    const rows = await this.dataSource.query<
      {
        id: string;
        prize_level: string;
        prize_name: string;
        prize_image_url: string | null;
        redeem_end_at: Date;
        status: WinView['redemptionStatus'];
      }[]
    >(
      `SELECT l.id,COALESCE(l.prize_level,ap.prize_level) AS prize_level,
         COALESCE(l.prize_name,ap.prize_name) AS prize_name,
         COALESCE(l.prize_image_url,ap.prize_image_url) AS prize_image_url,
         r.redeem_end_at,r.status
       FROM lottery_record l JOIN activity_prize ap ON ap.id=l.activity_prize_id
       JOIN redemption r ON r.lottery_record_id=l.id
       WHERE l.activity_id=$1 AND l.user_id=$2`,
      [activityId, userId],
    );
    const row = rows[0];
    return row
      ? {
          id: row.id,
          prizeLevel: row.prize_level,
          prizeName: row.prize_name,
          prizeImageUrl: this.absoluteUrl(row.prize_image_url, origin),
          redeemEndAt: new Date(row.redeem_end_at).toISOString(),
          redemptionStatus: row.status,
        }
      : null;
  }
}
