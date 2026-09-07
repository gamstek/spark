import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PrizesService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async addStock(activityPrizeId: string, quantity: number, operationId: string, adminId: string): Promise<void> {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('INVALID_STOCK_QUANTITY');
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT id FROM activity_prize WHERE id=$1 FOR UPDATE`, [activityPrizeId]);
      const duplicate = await manager.query(`SELECT 1 FROM stock_adjustment WHERE operation_id=$1`, [operationId]);
      if (duplicate[0]) return;
      await manager.query(`UPDATE activity_prize SET total_stock=total_stock+$2 WHERE id=$1`, [activityPrizeId, quantity]);
      await manager.query(
        `INSERT INTO stock_adjustment (id, activity_prize_id, quantity, reason, admin_account_id, operation_id) VALUES ($1,$2,$3,'ADMIN_ADD_STOCK',$4,$5)`,
        [randomUUID(), activityPrizeId, quantity, adminId, operationId],
      );
    });
  }
}
