import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { hashPassword } from '../auth/accounts.service.js';
@Injectable()
export class StaffService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}
  list() {
    return this.dataSource.query(
      `SELECT s.id,s.username,s.display_name,s.disabled_at,COALESCE(array_agg(p.activity_id) FILTER (WHERE p.activity_id IS NOT NULL),'{}') AS activity_ids FROM staff_account s LEFT JOIN staff_activity_permission p ON p.staff_account_id=s.id GROUP BY s.id ORDER BY s.created_at DESC`,
    );
  }
  async create(
    input: { username: string; displayName: string; password: string; activityIds: string[] },
    actorAdminId: string,
  ): Promise<{ id: string }> {
    const id = randomUUID(),
      passwordHash = await hashPassword(input.password);
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO staff_account (id,username,password_hash,display_name) VALUES ($1,$2,$3,$4)`,
        [id, input.username, passwordHash, input.displayName],
      );
      for (const activityId of input.activityIds)
        await manager.query(
          `INSERT INTO staff_activity_permission (staff_account_id,activity_id) VALUES ($1,$2)`,
          [id, activityId],
        );
      await manager.query(
        `INSERT INTO audit_event (id,actor_type,actor_id,action,resource_type,resource_id) VALUES ($1,'ADMIN',$2,'STAFF_CREATED','staff_account',$3)`,
        [randomUUID(), actorAdminId, id],
      );
    });
    return { id };
  }
  async hasActivityPermission(staffId: string, activityId: string): Promise<boolean> {
    const rows = await this.dataSource.query<{ allowed: boolean }[]>(
      `SELECT EXISTS(SELECT 1 FROM staff_activity_permission WHERE staff_account_id=$1 AND activity_id=$2) AS allowed`,
      [staffId, activityId],
    );
    return rows[0]?.allowed ?? false;
  }
  async grantActivity(staffId: string, activityId: string, actorAdminId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO staff_activity_permission (staff_account_id,activity_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [staffId, activityId],
      );
      await manager.query(
        `INSERT INTO audit_event (id,actor_type,actor_id,action,resource_type,resource_id,details) VALUES ($1,'ADMIN',$2,'STAFF_PERMISSION_GRANTED','activity',$3,$4)`,
        [randomUUID(), actorAdminId, activityId, { staffId }],
      );
    });
  }
}
