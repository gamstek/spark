import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';

import { ParticipantsService } from '../src/participants/participants.service.js';
import { RuntimeService } from '../src/runtime/runtime.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

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

describe('activity runtime', () => {
  let database: TestDatabase;
  let scenario: Scenario;

  beforeAll(async () => {
    database = await createTestDatabase();
    scenario = await createScenario(database.dataSource);
  });
  afterAll(async () => database.close());

  it('records the channel and returns the next step from persisted state', async () => {
    const subscriptions = { isSubscribed: async () => true };
    const runtime = new RuntimeService(
      database.dataSource,
      new ParticipantsService(database.dataSource),
      subscriptions as never,
      'wechat',
      () => new Date(scenario.now.getTime() + 1_000),
    );

    const result = await runtime.get(
      scenario.userIds[1],
      'expo-2026',
      'poster-a',
    );
    expect(result.nextStep).toBe('LOTTERY');
    expect(result.participationId).toBe(scenario.participationIds[1]);
    expect(
      await database.dataSource.query(
        `SELECT 1 FROM channel_visit WHERE activity_id=$1 AND user_id=$2 AND channel_code='poster-a'`,
        [scenario.activityId, scenario.userIds[1]],
      ),
    ).toHaveLength(1);
  });

  it('skips WeChat identity access for anonymous runtime when subscription is required', async () => {
    await database.dataSource.query(
      `UPDATE activity_version SET config=config || '{"requireSubscribe":true}'::jsonb WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId],
    );
    const userId = randomUUID();
    await database.dataSource.query(
      `INSERT INTO user_account (id) VALUES ($1)`,
      [userId],
    );
    const runtime = new RuntimeService(
      database.dataSource,
      new ParticipantsService(database.dataSource),
      {
        isSubscribed: async () => {
          throw new Error('UNEXPECTED_WECHAT_SUBSCRIPTION_CALL');
        },
      } as never,
      'anonymous',
      () => new Date(scenario.now.getTime() + 1_000),
    );
    const restore = forbidWechatIdentityAccess(database.dataSource);

    try {
      const anonymousRuntime = await runtime.get(
        userId,
        'expo-2026',
        'direct',
        false,
      );

      expect(anonymousRuntime.nextStep).not.toBe('SUBSCRIBE');
    } finally {
      restore();
    }
  });

  it('returns SUBSCRIBE for WeChat runtime when subscription is required', async () => {
    const userId = randomUUID();
    await database.dataSource.query(
      `INSERT INTO user_account (id) VALUES ($1)`,
      [userId],
    );
    const runtime = new RuntimeService(
      database.dataSource,
      new ParticipantsService(database.dataSource),
      { isSubscribed: async () => true } as never,
      'wechat',
      () => new Date(scenario.now.getTime() + 1_000),
    );

    await expect(
      runtime.get(userId, 'expo-2026', 'direct', false),
    ).resolves.toMatchObject({
      nextStep: 'SUBSCRIBE',
    });
  });

  it('returns an existing prize before evaluating remaining inventory', async () => {
    const runtime = new RuntimeService(
      database.dataSource,
      new ParticipantsService(database.dataSource),
      { isSubscribed: async () => true } as never,
      'wechat',
      () => new Date(scenario.now.getTime() + 1_000),
    );
    const result = await runtime.get(scenario.userIds[0], 'expo-2026');
    expect(result.nextStep).toBe('PRIZE');
    expect(result.win?.id).toBe(scenario.lotteryRecordId);
  });

  it('returns a persisted no-prize result instead of another draw', async () => {
    await database.dataSource.query(
      `UPDATE activity_participation SET drawn_at=$2 WHERE id=$1`,
      [scenario.participationIds[1], scenario.now],
    );
    const runtime = new RuntimeService(
      database.dataSource,
      new ParticipantsService(database.dataSource),
      { isSubscribed: async () => true } as never,
      'wechat',
      () => new Date(scenario.now.getTime() + 1_000),
    );

    const result = await runtime.get(scenario.userIds[1], 'expo-2026');

    expect(result.nextStep).toBe('NO_PRIZE');
    expect(result.win).toBeNull();
  });

  it('returns display info with the configured rules and prize wall', async () => {
    await database.dataSource.query(
      `UPDATE activity_version SET config=$1 WHERE id=(SELECT published_version_id FROM activity WHERE code='expo-2026')`,
      [
        JSON.stringify({
          rulesText: '每人一次抽奖机会',
          requireSubscribe: false,
        }),
      ],
    );
    const runtime = new RuntimeService(
      database.dataSource,
      new ParticipantsService(database.dataSource),
      { isSubscribed: async () => true } as never,
      'wechat',
    );
    const info = await runtime.getInfo('expo-2026');
    expect(info).toMatchObject({
      code: 'expo-2026',
      name: '展会抽奖',
      rulesText: '每人一次抽奖机会',
      noPrizeWeight: 0,
    });
    expect(info.prizes).toHaveLength(1);
    expect(info.prizes[0]?.name).toBe('一等奖');
    expect(info.startsAt).toBe(new Date(scenario.now.getTime()).toISOString());
    await expect(runtime.getInfo('missing')).rejects.toThrow(
      'ACTIVITY_NOT_FOUND',
    );
  });
});
