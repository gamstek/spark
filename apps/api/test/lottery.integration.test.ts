import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LotteryService } from '../src/lottery/lottery.service.js';
import { chooseWeightedPrize } from '../src/lottery/weighted-draw.js';
import { CodeService } from '../src/redemptions/code.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

describe('atomic lottery and inventory', () => {
  let database: TestDatabase;
  let scenario: Scenario;
  let codes: CodeService;
  beforeAll(async () => {
    database = await createTestDatabase();
    process.env.REDEEM_CODE_ACTIVE_KEY_ID = 'test-key';
    process.env.REDEEM_CODE_KEYS = JSON.stringify({
      'test-key': Buffer.alloc(32, 7).toString('base64'),
    });
    codes = new CodeService();
  });
  beforeEach(async () => {
    await database.dataSource.query(
      `TRUNCATE TABLE audit_event,export_job,stock_adjustment,channel_visit,redemption,lottery_record,activity_prize,prize,background_job,dingtalk_form_submission,webhook_receipt,activity_participation,staff_activity_permission,activity_version,activity,wechat_identity,user_account,app_session,oauth_state,wechat_credential_cache,staff_account,admin_account,media_asset RESTART IDENTITY CASCADE`,
    );
    scenario = await createScenario(database.dataSource);
    await database.dataSource.query(`DELETE FROM redemption`);
    await database.dataSource.query(`DELETE FROM lottery_record`);
    await database.dataSource.query(
      `UPDATE activity_prize SET total_stock=1,awarded_stock=0 WHERE activity_id=$1`,
      [scenario.activityId],
    );
    for (let index = 0; index < scenario.userIds.length; index += 1) {
      await database.dataSource.query(
        `INSERT INTO wechat_identity (id,user_id,app_id,openid,subscribed,subscription_checked_at) VALUES ($1,$2,'test-app',$3,true,now())`,
        [randomUUID(), scenario.userIds[index], `openid-${index}`],
      );
    }
  });
  afterAll(async () => {
    delete process.env.REDEEM_CODE_ACTIVE_KEY_ID;
    delete process.env.REDEEM_CODE_KEYS;
    await database.close();
  });

  const service = (now = scenario.now, codeService = codes) =>
    new LotteryService(
      database.dataSource,
      codeService,
      () => now,
      () => 0,
    );

  it('allows only one of two users to win the last item', async () => {
    const results = await Promise.allSettled(
      scenario.userIds.map((user) => service().draw(user, 'expo-2026')),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({
      reason: expect.objectContaining({ message: 'OUT_OF_STOCK' }),
    });
    expect(
      (
        await database.dataSource.query<{ remaining: number }[]>(
          `SELECT total_stock-awarded_stock AS remaining FROM activity_prize WHERE activity_id=$1`,
          [scenario.activityId],
        )
      )[0]?.remaining,
    ).toBe(0);
    expect(
      await database.dataSource.query(
        `SELECT id FROM lottery_record WHERE activity_id=$1`,
        [scenario.activityId],
      ),
    ).toHaveLength(1);
  });

  it('returns the same result for simultaneous draws by one user', async () => {
    const [first, second] = await Promise.all([
      service().draw(scenario.userIds[0], 'expo-2026'),
      service().draw(scenario.userIds[0], 'expo-2026'),
    ]);
    expect(first.id).toBe(second.id);
    expect(
      await database.dataSource.query(`SELECT id FROM lottery_record`),
    ).toHaveLength(1);
  });

  it('does not consume eligibility when empty and succeeds after stock is added', async () => {
    await database.dataSource.query(
      `UPDATE activity_prize SET total_stock=0 WHERE activity_id=$1`,
      [scenario.activityId],
    );
    await expect(
      service().draw(scenario.userIds[0], 'expo-2026'),
    ).rejects.toThrow('OUT_OF_STOCK');
    await database.dataSource.query(
      `UPDATE activity_prize SET total_stock=1 WHERE activity_id=$1`,
      [scenario.activityId],
    );
    await expect(
      service().draw(scenario.userIds[0], 'expo-2026'),
    ).resolves.toMatchObject({ prizeName: '一等奖' });
  });

  it('requires both completed lead data and a current subscription', async () => {
    await database.dataSource.query(
      `UPDATE activity_participation SET lead_completed=false WHERE user_id=$1`,
      [scenario.userIds[0]],
    );
    await expect(
      service().draw(scenario.userIds[0], 'expo-2026'),
    ).rejects.toThrow('LEAD_REQUIRED');
    await database.dataSource.query(
      `UPDATE activity_participation SET lead_completed=true WHERE user_id=$1`,
      [scenario.userIds[0]],
    );
    await database.dataSource.query(
      `UPDATE wechat_identity SET subscribed=false WHERE user_id=$1`,
      [scenario.userIds[0]],
    );
    await expect(
      service().draw(scenario.userIds[0], 'expo-2026'),
    ).rejects.toThrow('SUBSCRIPTION_REQUIRED');
    expect(
      (
        await database.dataSource.query<{ awarded_stock: number }[]>(
          `SELECT awarded_stock FROM activity_prize WHERE activity_id=$1`,
          [scenario.activityId],
        )
      )[0]?.awarded_stock,
    ).toBe(0);
  });

  it('returns an existing win after the draw has ended', async () => {
    const first = await service().draw(scenario.userIds[0], 'expo-2026');
    await expect(
      service(new Date(scenario.now.getTime() + 90_000_000)).draw(
        scenario.userIds[0],
        'expo-2026',
      ),
    ).resolves.toEqual(first);
    await expect(
      service(new Date(scenario.now.getTime() + 90_000_000)).draw(
        scenario.userIds[1],
        'expo-2026',
      ),
    ).rejects.toThrow('ACTIVITY_ENDED');
  });

  it('rolls stock back when creating the win fails', async () => {
    const brokenCodes = {
      create: () => {
        throw new Error('CODE_FAILURE');
      },
      restore: codes.restore.bind(codes),
    } as CodeService;
    await expect(
      service(scenario.now, brokenCodes).draw(scenario.userIds[0], 'expo-2026'),
    ).rejects.toThrow('CODE_FAILURE');
    expect(
      (
        await database.dataSource.query<{ awarded_stock: number }[]>(
          `SELECT awarded_stock FROM activity_prize WHERE activity_id=$1`,
          [scenario.activityId],
        )
      )[0]?.awarded_stock,
    ).toBe(0);
    expect(
      await database.dataSource.query(`SELECT id FROM lottery_record`),
    ).toHaveLength(0);
  });

  it('excludes zero-stock prizes from weighted selection', () => {
    expect(
      chooseWeightedPrize(
        [
          { id: 'empty', remainingStock: 0, weight: 999 },
          { id: 'available', remainingStock: 1, weight: 1 },
        ],
        () => 0,
      )?.id,
    ).toBe('available');
  });

  it('encrypts a random redemption code with authentication', () => {
    const created = codes.create();
    expect(codes.restore(created.encryptedCode, created.keyId)).toHaveLength(
      24,
    );
    const damagedBytes = Buffer.from(created.encryptedCode, 'base64url');
    const last = damagedBytes.length - 1;
    damagedBytes[last] = damagedBytes[last]! ^ 1;
    expect(() =>
      codes.restore(damagedBytes.toString('base64url'), created.keyId),
    ).toThrow();
    expect(created.encryptedCode).not.toContain(
      codes.restore(created.encryptedCode, created.keyId),
    );
  });
});
