import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class StaffService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async hasActivityPermission(staffId: string, activityId: string): Promise<boolean> {
    const rows = await this.dataSource.query<{ allowed: boolean }[]>(
      `SELECT EXISTS(SELECT 1 FROM staff_activity_permission WHERE staff_account_id=$1 AND activity_id=$2) AS allowed`, [staffId, activityId],
    );
    return rows[0]?.allowed ?? false;
  }

  async grantActivity(staffId: string, activityId: string, actorAdminId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`INSERT INTO staff_activity_permission (staff_account_id, activity_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [staffId, activityId]);
      await manager.query(`INSERT INTO audit_event (id, actor_type, actor_id, action, resource_type, resource_id, details) VALUES ($1,'ADMIN',$2,'STAFF_PERMISSION_GRANTED','activity',$3,$4)`, [randomUUID(), actorAdminId, activityId, { staffId }]);
    });
  }
}
