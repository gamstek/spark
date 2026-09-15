import {
  AdminActivityDetailSchema,
  AdminActivityListSchema,
} from '@spark/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ActivitiesService } from '../src/activities/activities.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

describe('admin activity wire contracts', () => {
  let database: TestDatabase;
  let scenario: Scenario;
  beforeAll(async () => {
    database = await createTestDatabase();
    scenario = await createScenario(database.dataSource);
  });
  afterAll(async () => database.close());

  it('parses actual list and detail responses after HTTP date serialization', async () => {
    const service = new ActivitiesService(database.dataSource, {
      now: () => scenario.now,
    });
    const list = AdminActivityListSchema.parse(
      JSON.parse(JSON.stringify(await service.list())),
    );
    const detail = AdminActivityDetailSchema.parse(
      JSON.parse(JSON.stringify(await service.get(scenario.activityId))),
    );
    expect(list[0]).toMatchObject({
      id: scenario.activityId,
      status: 'RUNNING',
      serverNow: '2026-09-07T04:00:00.000Z',
    });
    expect(detail).toMatchObject({
      ...list[0],
      version: 1,
      template_id: 'exhibition-lottery',
      template_version: 1,
    });
  });
});
