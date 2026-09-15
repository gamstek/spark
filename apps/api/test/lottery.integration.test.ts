import { randomUUID } from 'node:crypto';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { DataSource } from 'typeorm';

import type { Clock } from '../src/common/clock.js';
import { LotteryService } from '../src/lottery/lottery.service.js';
import { chooseWeightedPrize } from '../src/lottery/weighted-draw.js';
import { CodeService } from '../src/redemptions/code.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';
import { waitForBlockedQuery } from './support/locks.js';

const fixedClock = (now: Date): Clock => ({ now: () => now });

function forbidWechatIdentityAccess(dataSource: DataSource): () => void {
  const createQueryRunner = dataSource.createQueryRunner.bind(dataSource);
  const spy = vi
    .spyOn(dataSource, 'createQueryRunner')
    .mockImplementation((mode) => {
      const queryRunner = createQueryRunner(mode);
      const query = queryRunner.query.bind(queryRunner);
      queryRunner.query = (async (
        queryText: string,
        parameters?: unknown,
        useStructuredResult?: boolean,
      ) => {
        if (/\bwechat_identity\b/i.test(queryText))
          throw new Error('UNEXPECTED_WECHAT_IDENTITY_ACCESS');
        return useStructuredResult
          ? query(queryText, parameters as never, true)
          : query(queryText, parameters as never);
      }) as typeof queryRunner.query;
      return queryRunner;
    });
  return () => spy.mockRestore();
}

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
      `TRUNCATE TABLE audit_event,export_job,stock_adjustment,channel_visit,redemption,lottery_record,activity_prize,prize,background_job,activity_form_submission,activity_participation,staff_activity_permission,activity_version,activity,wechat_identity,user_account,app_session,oauth_state,wechat_credential_cache,staff_account,admin_account,media_asset RESTART IDENTITY CASCADE`,
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

  const service = (
    now = scenario.now,
    codeService = codes,
    identityMode: 'anonymous' | 'wechat' = 'wechat',
  ) =>
    new LotteryService(
      database.dataSource,
      codeService,
      identityMode,
      fixedClock(now),
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
    expect(first?.id).toBe(second?.id);
    expect(
      await database.dataSource.query(`SELECT id FROM lottery_record`),
    ).toHaveLength(1);
  });

  it('records a no-prize result and does not allow another draw', async () => {
    await database.dataSource.query(
      `UPDATE activity_version SET config=config || '{"winningProbability":0}'::jsonb WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId],
    );
    const noPrizeService = new LotteryService(
      database.dataSource,
      codes,
      'wechat',
      fixedClock(scenario.now),
      (maxExclusive) => maxExclusive - 1,
    );

    await expect(
      noPrizeService.draw(scenario.userIds[0], 'expo-2026'),
    ).resolves.toBeNull();
    await expect(
      noPrizeService.draw(scenario.userIds[0], 'expo-2026'),
    ).resolves.toBeNull();
    expect(
      await database.dataSource.query(`SELECT id FROM lottery_record`),
    ).toHaveLength(0);
    const participation = await database.dataSource.query<
      { drawn_at: Date | null }[]
    >(`SELECT drawn_at FROM activity_participation WHERE user_id=$1`, [
      scenario.userIds[0],
    ]);
    expect(participation[0]?.drawn_at).toBeInstanceOf(Date);
  });

  it('rejects a draw while the activity is paused', async () => {
    await expect(
      service().draw(scenario.userIds[0], 'expo-2026'),
    ).resolves.toMatchObject({ prizeLevel: '一等奖' });
    await database.dataSource.query(
      `UPDATE activity SET paused_at=$2 WHERE id=$1`,
      [scenario.activityId, scenario.now],
    );

    try {
      await expect(
        service().draw(scenario.userIds[0], 'expo-2026'),
      ).rejects.toThrow('ACTIVITY_PAUSED');
    } finally {
      await database.dataSource.query(
        `UPDATE activity SET paused_at=NULL WHERE id=$1`,
        [scenario.activityId],
      );
    }
  });

  it('rejects a paused draw at the exact draw deadline as not running', async () => {
    await database.dataSource.query(
      `UPDATE activity SET paused_at=$2 WHERE id=$1`,
      [scenario.activityId, scenario.now],
    );

    await expect(
      service(new Date(scenario.now.getTime() + 86_400_000)).draw(
        scenario.userIds[0],
        'expo-2026',
      ),
    ).rejects.toThrow('ACTIVITY_NOT_RUNNING');
  });

  it.each(['activity_prize', 'activity_participation'] as const)(
    'rejects a draw that waits on %s until its draw deadline',
    async (table) => {
      const drawEndsAt = new Date(scenario.now.getTime() + 86_400_000);
      let currentTime = new Date(drawEndsAt.getTime() - 1);
      const clock: Clock = { now: vi.fn(() => currentTime) };
      const blocker = database.dataSource.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      const [backend] = await blocker.manager.query<{ pid: number }[]>(
        `SELECT pg_backend_pid() AS pid`,
      );
      await blocker.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [
        table === 'activity_prize'
          ? scenario.activityPrizeId
          : scenario.participationIds[0],
      ]);
      const result = Promise.allSettled([
        new LotteryService(
          database.dataSource,
          codes,
          'wechat',
          clock,
          () => 0,
        ).draw(scenario.userIds[0], 'expo-2026'),
      ]);
      try {
        await waitForBlockedQuery(database.dataSource, backend!.pid);
        currentTime = drawEndsAt;
        await blocker.commitTransaction();
        expect(await result).toMatchObject([
          { status: 'rejected', reason: { message: 'ACTIVITY_NOT_RUNNING' } },
        ]);
        expect(clock.now).toHaveBeenCalledTimes(1);
        expect(
          await database.dataSource.query(`SELECT id FROM lottery_record`),
        ).toEqual([]);
        const [participation] = await database.dataSource.query<
          { drawn_at: Date | null }[]
        >(`SELECT drawn_at FROM activity_participation WHERE id=$1`, [
          scenario.participationIds[0],
        ]);
        expect(participation?.drawn_at).toBeNull();
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await result;
        await blocker.release();
      }
    },
  );

  it('uses the post-lock Shanghai half-day and timestamp for a waiting draw', async () => {
    const noon = scenario.now;
    const beforeNoon = new Date(noon.getTime() - 1);
    await database.dataSource.query(
      `UPDATE activity_prize SET total_stock=2 WHERE id=$1`,
      [scenario.activityPrizeId],
    );
    await database.dataSource.query(
      `UPDATE activity_version SET starts_at=$2,
       config=jsonb_set(config,'{halfDayPrizeLimits}',jsonb_build_object($3::text,1),true)
       WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [
        scenario.activityId,
        new Date(noon.getTime() - 3_600_000),
        scenario.activityPrizeId,
      ],
    );
    await expect(
      service(beforeNoon).draw(scenario.userIds[0], 'expo-2026'),
    ).resolves.toMatchObject({ prizeLevel: '一等奖' });
    let currentTime = beforeNoon;
    const clock: Clock = { now: vi.fn(() => currentTime) };
    const blocker = database.dataSource.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction();
    const [backend] = await blocker.manager.query<{ pid: number }[]>(
      `SELECT pg_backend_pid() AS pid`,
    );
    await blocker.query(
      `SELECT id FROM activity_prize WHERE id=$1 FOR UPDATE`,
      [scenario.activityPrizeId],
    );
    const result = Promise.allSettled([
      new LotteryService(
        database.dataSource,
        codes,
        'wechat',
        clock,
        () => 0,
      ).draw(scenario.userIds[1], 'expo-2026'),
    ]);
    try {
      await waitForBlockedQuery(database.dataSource, backend!.pid);
      currentTime = noon;
      await blocker.commitTransaction();
      expect(await result).toMatchObject([
        { status: 'fulfilled', value: { prizeLevel: '一等奖' } },
      ]);
      const [record] = await database.dataSource.query<
        { created_at: Date; drawn_at: Date; updated_at: Date }[]
      >(
        `SELECT l.created_at,p.drawn_at,p.updated_at FROM lottery_record l
         JOIN activity_participation p ON p.id=l.participation_id WHERE l.user_id=$1`,
        [scenario.userIds[1]],
      );
      expect(record).toEqual({
        created_at: noon,
        drawn_at: noon,
        updated_at: noon,
      });
      expect(clock.now).toHaveBeenCalledTimes(1);
    } finally {
      if (blocker.isTransactionActive) await blocker.rollbackTransaction();
      await result;
      await blocker.release();
    }
  });

  it('stops awarding a prize after its Shanghai half-day limit is reached', async () => {
    await database.dataSource.query(
      `UPDATE activity_prize SET total_stock=2 WHERE id=$1`,
      [scenario.activityPrizeId],
    );
    await database.dataSource.query(
      `UPDATE activity_version
       SET config=jsonb_set(config,'{halfDayPrizeLimits}',jsonb_build_object($2::text,1),true)
       WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId, scenario.activityPrizeId],
    );

    await expect(
      service().draw(scenario.userIds[0], 'expo-2026'),
    ).resolves.toMatchObject({ prizeLevel: '一等奖' });
    await expect(
      service().draw(scenario.userIds[1], 'expo-2026'),
    ).resolves.toBeNull();
    expect(
      await database.dataSource.query(
        `SELECT id FROM lottery_record WHERE activity_id=$1`,
        [scenario.activityId],
      ),
    ).toHaveLength(1);
  });

  it('records a no-prize result when stock is empty and winning is not possible', async () => {
    await database.dataSource.query(
      `UPDATE activity_prize SET total_stock=0 WHERE activity_id=$1`,
      [scenario.activityId],
    );
    await database.dataSource.query(
      `UPDATE activity_version SET config=config || '{"winningProbability":0}'::jsonb WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId],
    );
    await expect(
      service().draw(scenario.userIds[0], 'expo-2026'),
    ).resolves.toBeNull();
    const [participation] = await database.dataSource.query<
      { drawn_at: Date | null }[]
    >(`SELECT drawn_at FROM activity_participation WHERE user_id=$1`, [
      scenario.userIds[0],
    ]);
    expect(participation?.drawn_at).not.toBeNull();
  });

  it('does not consume eligibility when empty and succeeds after stock is added', async () => {
    await database.dataSource.query(
      `UPDATE activity_version SET config=config || '{"winningProbability":100}'::jsonb WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId],
    );
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

  it('skips WeChat identity access for anonymous draw when subscription is required', async () => {
    await database.dataSource.query(
      `UPDATE activity_version SET config=config || '{"requireSubscribe":true}'::jsonb WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId],
    );
    const restore = forbidWechatIdentityAccess(database.dataSource);

    try {
      await expect(
        service(scenario.now, codes, 'anonymous').draw(
          scenario.userIds[0],
          'expo-2026',
        ),
      ).resolves.toBeDefined();
    } finally {
      restore();
    }
  });

  it('requires both completed lead data and a current subscription', async () => {
    await database.dataSource.query(
      `UPDATE activity_version SET config=config || '{"requireSubscribe":true}'::jsonb WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId],
    );
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
    ).rejects.toThrow('ACTIVITY_NOT_RUNNING');
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
    expect(codes.restore(created.encryptedCode, created.keyId)).toMatch(
      /^[A-HJ-NP-Z2-9]{8}$/,
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
