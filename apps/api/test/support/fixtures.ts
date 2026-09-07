import { createHash, randomUUID } from 'node:crypto';

import type { DataSource } from 'typeorm';

import { hashPassword } from '../../src/auth/accounts.service.js';

export interface Scenario {
  adminId: string;
  staffId: string;
  activityId: string;
  userIds: [string, string];
  participationIds: [string, string];
  activityPrizeId: string;
  lotteryRecordId: string;
  redeemCodeHash: string;
  now: Date;
}

export async function createScenario(dataSource: DataSource, options: { now?: Date; accountPassword?: string } = {}): Promise<Scenario> {
  const now = options.now ?? new Date('2026-09-07T04:00:00.000Z');
  const adminId = randomUUID();
  const staffId = randomUUID();
  const activityId = randomUUID();
  const versionId = randomUUID();
  const userIds: [string, string] = [randomUUID(), randomUUID()];
  const participationIds: [string, string] = [randomUUID(), randomUUID()];
  const prizeId = randomUUID();
  const activityPrizeId = randomUUID();
  const lotteryRecordId = randomUUID();
  const redemptionId = randomUUID();
  const redeemCodeHash = createHash('sha256').update('fixture-redeem-code').digest('hex');
  const passwordHash = await hashPassword(options.accountPassword ?? 'fixture-password-only');

  await dataSource.transaction(async (manager) => {
    await manager.query(`INSERT INTO admin_account (id, username, password_hash, display_name) VALUES ($1, 'admin-fixture', $2, '测试管理员')`, [adminId, passwordHash]);
    await manager.query(`INSERT INTO staff_account (id, username, password_hash, display_name) VALUES ($1, 'staff-fixture', $2, '测试工作人员')`, [staffId, passwordHash]);
    for (const userId of userIds) await manager.query(`INSERT INTO user_account (id) VALUES ($1)`, [userId]);
    await manager.query(`INSERT INTO activity (id, code, name) VALUES ($1, 'expo-2026', '展会抽奖')`, [activityId]);
    await manager.query(`INSERT INTO activity_version (id, activity_id, version, status, template_id, template_version, config_schema_version, config, starts_at, ends_at, draw_ends_at, redeem_ends_at, published_at) VALUES ($1,$2,1,'PUBLISHED','exhibition-lottery',1,1,'{}',$3,$4,$4,$5,$3)`, [versionId, activityId, now, new Date(now.getTime() + 86_400_000), new Date(now.getTime() + 172_800_000)]);
    await manager.query(`UPDATE activity SET published_version_id=$1 WHERE id=$2`, [versionId, activityId]);
    await manager.query(`INSERT INTO staff_activity_permission (staff_account_id, activity_id) VALUES ($1,$2)`, [staffId, activityId]);
    for (let i = 0; i < userIds.length; i += 1) await manager.query(`INSERT INTO activity_participation (id, activity_id, user_id, lead_completed, lead_completed_at) VALUES ($1,$2,$3,true,$4)`, [participationIds[i], activityId, userIds[i], now]);
    await manager.query(`INSERT INTO prize (id, name) VALUES ($1, '一等奖')`, [prizeId]);
    await manager.query(`INSERT INTO activity_prize (id, activity_id, prize_id, total_stock, awarded_stock, weight) VALUES ($1,$2,$3,10,1,1)`, [activityPrizeId, activityId, prizeId]);
    await manager.query(`INSERT INTO lottery_record (id, activity_id, user_id, participation_id, activity_prize_id) VALUES ($1,$2,$3,$4,$5)`, [lotteryRecordId, activityId, userIds[0], participationIds[0], activityPrizeId]);
    await manager.query(`INSERT INTO redemption (id, lottery_record_id, redeem_code_hash, status, redeem_end_at) VALUES ($1,$2,$3,'WAIT_REDEEM',$4)`, [redemptionId, lotteryRecordId, redeemCodeHash, new Date(now.getTime() + 172_800_000)]);
  });

  return { adminId, staffId, activityId, userIds, participationIds, activityPrizeId, lotteryRecordId, redeemCodeHash, now };
}
