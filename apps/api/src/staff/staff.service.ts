import { randomUUID } from 'node:crypto';

import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  AppSession,
  AuditEvent,
  StaffAccount,
  StaffActivityPermission,
} from '../../database/entities/index.js';
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
    input: {
      username: string;
      displayName: string;
      password: string;
      activityIds: string[];
    },
    actorAdminId: string,
  ): Promise<{ id: string }> {
    const id = randomUUID(),
      passwordHash = await hashPassword(input.password);
    try {
      await this.dataSource.transaction(async (manager) => {
        const exists = await manager
          .getRepository(StaffAccount)
          .existsBy({ username: input.username });
        if (exists) throw new ConflictException('RECORD_CONFLICT');
        await manager.getRepository(StaffAccount).insert({
          id,
          username: input.username,
          passwordHash,
          displayName: input.displayName,
          disabledAt: null,
        });
        const permissionRepository = manager.getRepository(
          StaffActivityPermission,
        );
        for (const activityId of input.activityIds) {
          await permissionRepository.insert({
            staffAccountId: id,
            activityId,
          });
        }
        await manager.getRepository(AuditEvent).insert({
          id: randomUUID(),
          actorType: 'ADMIN',
          actorId: actorAdminId,
          action: 'STAFF_CREATED',
          resourceType: 'staff_account',
          resourceId: id,
        });
      });
    } catch (error) {
      // 并发创建同名账号时由唯一约束兜底，同样映射为 409 业务冲突
      if ((error as { code?: string }).code === '23505')
        throw new ConflictException('RECORD_CONFLICT');
      throw error;
    }
    return { id };
  }
  async hasActivityPermission(
    staffId: string,
    activityId: string,
  ): Promise<boolean> {
    return this.dataSource.getRepository(StaffActivityPermission).existsBy({
      staffAccountId: staffId,
      activityId,
    });
  }
  async grantActivity(
    staffId: string,
    activityId: string,
    actorAdminId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(StaffActivityPermission)
        .createQueryBuilder()
        .insert()
        .values({ staffAccountId: staffId, activityId })
        .orIgnore()
        .execute();
      await manager.getRepository(AuditEvent).insert({
        id: randomUUID(),
        actorType: 'ADMIN',
        actorId: actorAdminId,
        action: 'STAFF_PERMISSION_GRANTED',
        resourceType: 'activity',
        resourceId: activityId,
        details: { staffId },
      });
    });
  }
  async update(
    staffId: string,
    input: { displayName: string; activityIds: string[] },
    actorAdminId: string,
  ): Promise<void> {
    if (!input.displayName.trim()) throw new Error('INVALID_STAFF');
    await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(StaffAccount).update(staffId, {
        displayName: input.displayName.trim(),
      });
      if (!result.affected) throw new Error('STAFF_NOT_FOUND');
      const permissionRepository = manager.getRepository(
        StaffActivityPermission,
      );
      await permissionRepository.delete({ staffAccountId: staffId });
      for (const activityId of [...new Set(input.activityIds)]) {
        await permissionRepository.insert({
          staffAccountId: staffId,
          activityId,
        });
      }
      await manager.getRepository(AuditEvent).insert({
        id: randomUUID(),
        actorType: 'ADMIN',
        actorId: actorAdminId,
        action: 'STAFF_UPDATED',
        resourceType: 'staff_account',
        resourceId: staffId,
        details: { activityIds: input.activityIds },
      });
    });
  }
  async resetPassword(
    staffId: string,
    password: string,
    actorAdminId: string,
  ): Promise<void> {
    if (password.length < 12) throw new Error('INVALID_PASSWORD');
    const passwordHash = await hashPassword(password);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(StaffAccount).update(staffId, {
        passwordHash,
      });
      await manager.getRepository(AppSession).delete({
        role: 'STAFF',
        staffAccountId: staffId,
      });
      await manager.getRepository(AuditEvent).insert({
        id: randomUUID(),
        actorType: 'ADMIN',
        actorId: actorAdminId,
        action: 'STAFF_PASSWORD_RESET',
        resourceType: 'staff_account',
        resourceId: staffId,
      });
    });
  }
  async setDisabled(
    staffId: string,
    disabled: boolean,
    actorAdminId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(StaffAccount).update(staffId, {
        disabledAt: disabled ? () => 'now()' : null,
      });
      if (disabled) {
        await manager.getRepository(AppSession).delete({
          role: 'STAFF',
          staffAccountId: staffId,
        });
      }
      await manager.getRepository(AuditEvent).insert({
        id: randomUUID(),
        actorType: 'ADMIN',
        actorId: actorAdminId,
        action: disabled ? 'STAFF_DISABLED' : 'STAFF_ENABLED',
        resourceType: 'staff_account',
        resourceId: staffId,
        details: { disabled },
      });
    });
  }
}
