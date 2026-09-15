import { randomInt, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  deriveActivityStatus,
  type ActivityStatus,
  type WinView,
} from '@spark/contracts';
import { DataSource } from 'typeorm';

import type { ActivityIdentityMode } from '../auth/activity-identity-mode.js';
import { APP_CLOCK, type Clock, systemClock } from '../common/clock.js';
import { CodeService } from '../redemptions/code.service.js';
import {
  getShanghaiHalfDayWindow,
  isWinningRoll,
  underHalfDayLimit,
} from './draw-rules.js';
import { chooseWeightedPrize } from './weighted-draw.js';

type ActivityRow = {
  id: string;
  published_version_id: string;
  paused_at: Date | null;
  starts_at: Date;
  draw_ends_at: Date;
  ends_at: Date;
  redeem_ends_at: Date;
  config: {
    winningProbability?: number;
    halfDayPrizeLimits?: Record<string, number>;
    requireSubscribe?: boolean;
  };
};
type PrizeRow = {
  id: string;
  remaining_stock: number;
  weight: string;
  prize_level: string;
  prize_name: string;
  prize_image_url: string | null;
};
type WinRow = {
  id: string;
  prize_level: string;
  prize_name: string;
  prize_image_url: string | null;
  redeem_end_at: Date;
  status: WinView['redemptionStatus'];
};

const retryableCodes = new Set(['40001', '40P01']);
@Injectable()
export class LotteryService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(CodeService) private readonly codes: CodeService,
    private readonly identityMode: ActivityIdentityMode,
    @Inject(APP_CLOCK)
    private readonly clock: Clock = systemClock,
    private readonly randomInteger: (
      maxExclusive: number,
    ) => number = randomInt,
  ) {}

  async draw(
    userId: string,
    activityCode: string,
    origin = 'http://localhost',
  ): Promise<WinView | null> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.drawOnce(userId, activityCode, origin);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (!code || !retryableCodes.has(code) || attempt >= 2) throw error;
      }
    }
  }

  private async drawOnce(
    userId: string,
    activityCode: string,
    origin: string,
  ): Promise<WinView | null> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const activities = await manager.query<ActivityRow[]>(
        `SELECT a.id,a.published_version_id,a.paused_at,v.starts_at,v.draw_ends_at,v.ends_at,v.redeem_ends_at,v.config FROM activity a JOIN activity_version v ON v.id=a.published_version_id WHERE a.code=$1`,
        [activityCode],
      );
      const activity = activities[0];
      if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
      const prizes = await manager.query<PrizeRow[]>(
        `SELECT ap.id,ap.total_stock-ap.awarded_stock AS remaining_stock,vp.weight,vp.prize_level,vp.prize_name,vp.prize_image_url
         FROM activity_version_prize vp JOIN activity_prize ap ON ap.id=vp.activity_prize_id
         WHERE vp.activity_version_id=(SELECT published_version_id FROM activity WHERE id=$1)
         ORDER BY ap.id FOR UPDATE OF ap`,
        [activity.id],
      );
      const participations = await manager.query<
        { id: string; lead_completed: boolean; drawn_at: Date | null }[]
      >(
        `SELECT id,lead_completed,drawn_at FROM activity_participation WHERE activity_id=$1 AND user_id=$2 FOR UPDATE`,
        [activity.id, userId],
      );
      // Lock waits and serializable retries may cross lifecycle/quota boundaries.
      const now = this.now();
      const status = this.status(activity, now);
      if (status === 'PAUSED') throw new Error('ACTIVITY_PAUSED');
      const existing = await manager.query<WinRow[]>(
        `SELECT l.id,l.prize_level,l.prize_name,l.prize_image_url,l.redeem_end_at,r.status FROM lottery_record l JOIN redemption r ON r.lottery_record_id=l.id WHERE l.activity_id=$1 AND l.user_id=$2`,
        [activity.id, userId],
      );
      if (existing[0]) return this.toView(existing[0], origin);
      switch (status) {
        case 'RUNNING':
          break;
        default:
          throw new Error('ACTIVITY_NOT_RUNNING');
      }
      const participation = participations[0];
      if (!participation?.lead_completed) throw new Error('LEAD_REQUIRED');
      if (participation.drawn_at) return null;
      if (this.identityMode === 'wechat' && activity.config.requireSubscribe) {
        const subscribed = await manager.query<{ subscribed: boolean }[]>(
          `SELECT subscribed FROM wechat_identity WHERE user_id=$1 AND subscribed=true LIMIT 1`,
          [userId],
        );
        if (!subscribed[0]) throw new Error('SUBSCRIPTION_REQUIRED');
      }
      if (
        !isWinningRoll(
          Number(activity.config.winningProbability ?? 0),
          this.randomInteger,
        )
      ) {
        await manager.query(
          `UPDATE activity_participation SET drawn_at=$2,updated_at=$2 WHERE id=$1`,
          [participation.id, now],
        );
        return null;
      }
      const stockedPrizes = prizes.filter(
        (prize) => Number(prize.remaining_stock) > 0,
      );
      if (stockedPrizes.length === 0) throw new Error('OUT_OF_STOCK');
      const halfDay = getShanghaiHalfDayWindow(now);
      const awards = await manager.query<
        { activity_prize_id: string; awarded: number }[]
      >(
        `SELECT activity_prize_id,count(*)::integer AS awarded FROM lottery_record
         WHERE activity_id=$1 AND created_at >= $2 AND created_at < $3
         GROUP BY activity_prize_id`,
        [activity.id, halfDay.startsAt, halfDay.endsAt],
      );
      const halfDayAwards = new Map(
        awards.map((award) => [award.activity_prize_id, award.awarded]),
      );
      const limits = activity.config.halfDayPrizeLimits ?? {};
      const candidates = stockedPrizes
        .filter((prize) =>
          underHalfDayLimit(
            Number(limits[prize.id] ?? 0),
            halfDayAwards.get(prize.id) ?? 0,
          ),
        )
        .map((prize) => ({
          id: prize.id,
          remainingStock: Number(prize.remaining_stock),
          weight: Number(prize.weight),
        }));
      const selected = chooseWeightedPrize(candidates, this.randomInteger);
      await manager.query(
        `UPDATE activity_participation SET drawn_at=$2,updated_at=$2 WHERE id=$1`,
        [participation.id, now],
      );
      if (!selected) return null;
      const prize = prizes.find((candidate) => candidate.id === selected.id)!;
      const updated = await manager.query(
        `UPDATE activity_prize SET awarded_stock=awarded_stock+1 WHERE id=$1 AND awarded_stock<total_stock`,
        [prize.id],
      );
      const count =
        Array.isArray(updated) && typeof updated.at(-1) === 'number'
          ? updated.at(-1)
          : 0;
      if (count !== 1) throw new Error('OUT_OF_STOCK');
      const lotteryId = randomUUID();
      const redemptionId = randomUUID();
      const code = this.codes.create();
      await manager.query(
        `INSERT INTO lottery_record (id,activity_id,user_id,participation_id,activity_prize_id,prize_level,prize_name,prize_image_url,redeem_end_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          lotteryId,
          activity.id,
          userId,
          participation.id,
          prize.id,
          prize.prize_level,
          prize.prize_name,
          prize.prize_image_url,
          activity.redeem_ends_at,
          now,
        ],
      );
      await manager.query(
        `INSERT INTO redemption (id,lottery_record_id,redeem_code_hash,encrypted_code,encryption_key_id,status,redeem_end_at) VALUES ($1,$2,$3,$4,$5,'WAIT_REDEEM',$6)`,
        [
          redemptionId,
          lotteryId,
          code.hash,
          code.encryptedCode,
          code.keyId,
          activity.redeem_ends_at,
        ],
      );
      return this.toView(
        {
          id: lotteryId,
          prize_level: prize.prize_level,
          prize_name: prize.prize_name,
          prize_image_url: prize.prize_image_url,
          redeem_end_at: activity.redeem_ends_at,
          status: 'WAIT_REDEEM',
        },
        origin,
      );
    });
  }

  private toView(row: WinRow, origin: string): WinView {
    const image = row.prize_image_url;
    return {
      id: row.id,
      prizeLevel: row.prize_level,
      prizeName: row.prize_name,
      prizeImageUrl: image ? new URL(image, origin).toString() : null,
      redeemEndAt: new Date(row.redeem_end_at).toISOString(),
      redemptionStatus: row.status,
    };
  }

  private now(): Date {
    return this.clock.now();
  }

  private status(activity: ActivityRow, now: Date): ActivityStatus {
    return deriveActivityStatus(
      {
        publishedVersionId: activity.published_version_id,
        startsAt: new Date(activity.starts_at),
        drawEndsAt: new Date(activity.draw_ends_at),
        endsAt: new Date(activity.ends_at),
        pausedAt: activity.paused_at ? new Date(activity.paused_at) : null,
      },
      now,
    );
  }
}
