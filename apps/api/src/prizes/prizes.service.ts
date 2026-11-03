import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
@Injectable()
export class PrizesService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}
  list(activityId: string) {
    return this.dataSource.query(
      `SELECT ap.id,ap.prize_id,ap.prize_level,ap.prize_name,ap.prize_image_url,ap.total_stock,ap.awarded_stock,ap.weight FROM activity_prize ap WHERE ap.activity_id=$1 ORDER BY ap.created_at`,
      [activityId],
    );
  }
  async create(
    activityId: string,
    input: {
      prizeLevel: string;
      name: string;
      imageAssetId?: string | null;
      totalStock: number;
      weight: number;
    },
  ): Promise<{ id: string }> {
    if (
      !input.prizeLevel?.trim() ||
      input.prizeLevel.trim().length > 40 ||
      !input.name?.trim() ||
      input.name.trim().length > 120 ||
      !Number.isSafeInteger(input.totalStock) ||
      input.totalStock < 0 ||
      !Number.isFinite(input.weight) ||
      input.weight <= 0
    )
      throw new Error('INVALID_PRIZE');
    const prizeId = randomUUID(),
      id = randomUUID();
    await this.dataSource.transaction(async (manager) => {
      const started = await manager.query(
        `SELECT 1 FROM activity a JOIN activity_version v ON v.id=a.published_version_id WHERE a.id=$1 AND v.starts_at<=now()`,
        [activityId],
      );
      if (started[0]) throw new Error('ACTIVITY_STARTED');
      let prizeImageUrl: string | null = null;
      if (input.imageAssetId) {
        const media = await manager.query<{ storage_key: string }[]>(
          `SELECT storage_key FROM media_asset WHERE id=$1`,
          [input.imageAssetId],
        );
        if (!media[0]) throw new Error('INVALID_PRIZE');
        prizeImageUrl = `/media/${media[0].storage_key}`;
      }
      await manager.query(
        `INSERT INTO prize (id,name,image_asset_id) VALUES ($1,$2,$3)`,
        [prizeId, input.name.trim(), input.imageAssetId ?? null],
      );
      await manager.query(
        `INSERT INTO activity_prize (id,activity_id,prize_id,total_stock,weight,prize_level,prize_name,prize_image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          activityId,
          prizeId,
          input.totalStock,
          input.weight,
          input.prizeLevel.trim(),
          input.name.trim(),
          prizeImageUrl,
        ],
      );
    });
    return { id };
  }
  async updateDrawRules(
    activityId: string,
    winningProbability: number,
    halfDayPrizeLimits: Record<string, number>,
  ): Promise<{
    winningProbability: number;
    halfDayPrizeLimits: Record<string, number>;
  }> {
    if (
      !Number.isFinite(winningProbability) ||
      winningProbability < 0 ||
      winningProbability > 100 ||
      Object.values(halfDayPrizeLimits).some(
        (limit) => !Number.isSafeInteger(limit) || limit < 0,
      )
    )
      throw new Error('INVALID_DRAW_RULES');
    await this.dataSource.transaction(async (manager) => {
      const activities = await manager.query<
        {
          draft_version_id: string | null;
          published_version_id: string | null;
          starts_at: Date | null;
        }[]
      >(
        `SELECT a.draft_version_id,a.published_version_id,published.starts_at
         FROM activity a
         LEFT JOIN activity_version published ON published.id=a.published_version_id
         WHERE a.id=$1
         FOR UPDATE OF a`,
        [activityId],
      );
      const activity = activities[0];
      if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
      const hasStarted = Boolean(
        activity.starts_at && new Date(activity.starts_at) <= new Date(),
      );
      const versionId = hasStarted
        ? activity.published_version_id
        : (activity.draft_version_id ?? activity.published_version_id);
      if (!versionId) throw new Error('DRAFT_NOT_FOUND');
      await manager.query(
        `UPDATE activity_version
         SET config=jsonb_set(
           jsonb_set(config,'{winningProbability}',to_jsonb($2::double precision),true),
           '{halfDayPrizeLimits}',
           $3::jsonb,
           true
         )
         WHERE id=$1`,
        [versionId, winningProbability, JSON.stringify(halfDayPrizeLimits)],
      );
    });
    return { winningProbability, halfDayPrizeLimits };
  }
  async addStock(
    activityPrizeId: string,
    quantity: number,
    operationId: string,
    adminId: string,
  ): Promise<void> {
    if (!Number.isSafeInteger(quantity) || quantity <= 0)
      throw new Error('INVALID_STOCK_QUANTITY');
    await this.adjustStock(activityPrizeId, quantity, operationId, adminId);
  }
  async adjustStock(
    activityPrizeId: string,
    quantity: number,
    operationId: string,
    adminId: string,
  ): Promise<void> {
    if (
      !Number.isSafeInteger(quantity) ||
      quantity === 0 ||
      Math.abs(quantity) > 2_147_483_647
    )
      throw new Error('INVALID_STOCK_QUANTITY');
    if (
      typeof operationId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        operationId,
      )
    )
      throw new Error('INVALID_STOCK_OPERATION');
    await this.dataSource.transaction(async (manager) => {
      const [prize] = await manager.query<
        { total_stock: number; awarded_stock: number }[]
      >(
        `SELECT total_stock,awarded_stock FROM activity_prize WHERE id=$1 FOR UPDATE`,
        [activityPrizeId],
      );
      if (!prize) throw new Error('PRIZE_NOT_FOUND');
      const [duplicate] = await manager.query<
        {
          activity_prize_id: string;
          quantity: number;
          admin_account_id: string;
        }[]
      >(
        `SELECT activity_prize_id,quantity,admin_account_id FROM stock_adjustment WHERE operation_id=$1`,
        [operationId],
      );
      if (duplicate) {
        if (
          duplicate.activity_prize_id !== activityPrizeId ||
          duplicate.quantity !== quantity ||
          duplicate.admin_account_id !== adminId
        )
          throw new Error('STOCK_OPERATION_CONFLICT');
        return;
      }
      const totalStock = prize.total_stock + quantity;
      if (totalStock < prize.awarded_stock)
        throw new Error('STOCK_BELOW_AWARDED');
      if (totalStock > 2_147_483_647) throw new Error('INVALID_STOCK_QUANTITY');
      await manager.query(
        `UPDATE activity_prize SET total_stock=total_stock+$2 WHERE id=$1`,
        [activityPrizeId, quantity],
      );
      await manager.query(
        `INSERT INTO stock_adjustment (id,activity_prize_id,quantity,reason,admin_account_id,operation_id) VALUES ($1,$2,$3,'ADMIN_ADJUST_STOCK',$4,$5)`,
        [randomUUID(), activityPrizeId, quantity, adminId, operationId],
      );
    });
  }
}
