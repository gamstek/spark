import { randomInt, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { WinView } from '@spark/contracts';
import { DataSource } from 'typeorm';

import { CodeService } from '../redemptions/code.service.js';
import { chooseWeightedPrize } from './weighted-draw.js';

type ActivityRow = {
  id: string;
  starts_at: Date;
  draw_ends_at: Date;
  redeem_ends_at: Date;
};
type PrizeRow = {
  id: string;
  remaining_stock: number;
  weight: string;
  prize_name: string;
  prize_image_url: string | null;
};
type WinRow = {
  id: string;
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
    private readonly now: () => Date = () => new Date(),
    private readonly randomInteger: (
      maxExclusive: number,
    ) => number = randomInt,
  ) {}

  async draw(userId: string, activityCode: string): Promise<WinView> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.drawOnce(userId, activityCode);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (!code || !retryableCodes.has(code) || attempt >= 2) throw error;
      }
    }
  }

  private async drawOnce(
    userId: string,
    activityCode: string,
  ): Promise<WinView> {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const activities = await manager.query<ActivityRow[]>(
        `SELECT a.id,v.starts_at,v.draw_ends_at,v.redeem_ends_at FROM activity a JOIN activity_version v ON v.id=a.published_version_id WHERE a.code=$1`,
        [activityCode],
      );
      const activity = activities[0];
      if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
      const prizes = await manager.query<PrizeRow[]>(
        `SELECT ap.id,ap.total_stock-ap.awarded_stock AS remaining_stock,vp.weight,vp.prize_name,vp.prize_image_url
         FROM activity_version_prize vp JOIN activity_prize ap ON ap.id=vp.activity_prize_id
         WHERE vp.activity_version_id=(SELECT published_version_id FROM activity WHERE id=$1)
         ORDER BY ap.id FOR UPDATE OF ap`,
        [activity.id],
      );
      const participations = await manager.query<
        { id: string; lead_completed: boolean }[]
      >(
        `SELECT id,lead_completed FROM activity_participation WHERE activity_id=$1 AND user_id=$2 FOR UPDATE`,
        [activity.id, userId],
      );
      const existing = await manager.query<WinRow[]>(
        `SELECT l.id,l.prize_name,l.prize_image_url,l.redeem_end_at,r.status FROM lottery_record l JOIN redemption r ON r.lottery_record_id=l.id WHERE l.activity_id=$1 AND l.user_id=$2`,
        [activity.id, userId],
      );
      if (existing[0]) return this.toView(existing[0]);
      const participation = participations[0];
      if (!participation?.lead_completed) throw new Error('LEAD_REQUIRED');
      const subscribed = await manager.query<{ subscribed: boolean }[]>(
        `SELECT subscribed FROM wechat_identity WHERE user_id=$1 AND subscribed=true LIMIT 1`,
        [userId],
      );
      if (!subscribed[0]) throw new Error('SUBSCRIPTION_REQUIRED');
      const now = this.now();
      if (
        now < new Date(activity.starts_at) ||
        now >= new Date(activity.draw_ends_at)
      )
        throw new Error('ACTIVITY_ENDED');
      const selected = chooseWeightedPrize(
        prizes.map((prize) => ({
          id: prize.id,
          remainingStock: Number(prize.remaining_stock),
          weight: Number(prize.weight),
        })),
        this.randomInteger,
      );
      if (!selected) throw new Error('OUT_OF_STOCK');
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
        `INSERT INTO lottery_record (id,activity_id,user_id,participation_id,activity_prize_id,prize_name,prize_image_url,redeem_end_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          lotteryId,
          activity.id,
          userId,
          participation.id,
          prize.id,
          prize.prize_name,
          prize.prize_image_url,
          activity.redeem_ends_at,
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
      return this.toView({
        id: lotteryId,
        prize_name: prize.prize_name,
        prize_image_url: prize.prize_image_url,
        redeem_end_at: activity.redeem_ends_at,
        status: 'WAIT_REDEEM',
      });
    });
  }

  private toView(row: WinRow): WinView {
    const image = row.prize_image_url;
    return {
      id: row.id,
      prizeName: row.prize_name,
      prizeImageUrl: image
        ? new URL(
            image,
            process.env.PUBLIC_ORIGIN ?? 'http://localhost:4173',
          ).toString()
        : null,
      redeemEndAt: new Date(row.redeem_end_at).toISOString(),
      redemptionStatus: row.status,
    };
  }
}
