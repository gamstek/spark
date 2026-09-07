import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ParticipantsService } from '../src/participants/participants.service.js';
import { RuntimeService } from '../src/runtime/runtime.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

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

  it('returns an existing prize before evaluating remaining inventory', async () => {
    const runtime = new RuntimeService(
      database.dataSource,
      new ParticipantsService(database.dataSource),
      { isSubscribed: async () => true } as never,
      () => new Date(scenario.now.getTime() + 1_000),
    );
    const result = await runtime.get(scenario.userIds[0], 'expo-2026');
    expect(result.nextStep).toBe('PRIZE');
    expect(result.win?.id).toBe(scenario.lotteryRecordId);
  });
});
