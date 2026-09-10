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
      await manager.query(`INSERT INTO prize (id,name) VALUES ($1,$2)`, [
        prizeId,
        input.name.trim(),
      ]);
      await manager.query(
        `INSERT INTO activity_prize (id,activity_id,prize_id,total_stock,weight,prize_level,prize_name) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          activityId,
          prizeId,
          input.totalStock,
          input.weight,
          input.prizeLevel.trim(),
          input.name.trim(),
        ],
      );
    });
    return { id };
  }
  async updateNoPrizeWeight(
    activityId: string,
    noPrizeWeight: number,
  ): Promise<{ noPrizeWeight: number }> {
    if (!Number.isFinite(noPrizeWeight) || noPrizeWeight < 0)
      throw new Error('INVALID_NO_PRIZE_WEIGHT');
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
         SET config=jsonb_set(config,'{noPrizeWeight}',to_jsonb($2::double precision),true)
         WHERE id=$1`,
        [versionId, noPrizeWeight],
      );
    });
    return { noPrizeWeight };
  }
  async addStock(
    activityPrizeId: string,
    quantity: number,
    operationId: string,
    adminId: string,
  ): Promise<void> {
    if (!Number.isSafeInteger(quantity) || quantity <= 0)
      throw new Error('INVALID_STOCK_QUANTITY');
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT id FROM activity_prize WHERE id=$1 FOR UPDATE`,
        [activityPrizeId],
      );
      const duplicate = await manager.query(
        `SELECT 1 FROM stock_adjustment WHERE operation_id=$1`,
        [operationId],
      );
      if (duplicate[0]) return;
      await manager.query(
        `UPDATE activity_prize SET total_stock=total_stock+$2 WHERE id=$1`,
        [activityPrizeId, quantity],
      );
      await manager.query(
        `INSERT INTO stock_adjustment (id,activity_prize_id,quantity,reason,admin_account_id,operation_id) VALUES ($1,$2,$3,'ADMIN_ADD_STOCK',$4,$5)`,
        [randomUUID(), activityPrizeId, quantity, adminId, operationId],
      );
    });
  }
}
