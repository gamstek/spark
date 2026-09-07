import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

describe('initial PostgreSQL schema', () => {
  let database: TestDatabase;
  let scenario: Scenario;

  beforeAll(async () => {
    database = await createTestDatabase();
    scenario = await createScenario(database.dataSource);
  });

  afterAll(async () => database.close());

  it('migrates an empty isolated schema', async () => {
    const rows = await database.dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`,
    );
    expect(rows.map((row) => row.table_name)).toContain('activity');
  });

  it('rejects a second participation for the same activity and user', async () => {
    await expect(database.dataSource.query(
      `INSERT INTO activity_participation (id, activity_id, user_id, lead_completed) VALUES ($1, $2, $3, false)`,
      [randomUUID(), scenario.activityId, scenario.userIds[0]],
    )).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects a second lottery record for the same activity and user', async () => {
    await expect(database.dataSource.query(
      `INSERT INTO lottery_record (id, activity_id, user_id, participation_id, activity_prize_id) VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), scenario.activityId, scenario.userIds[0], scenario.participationIds[0], scenario.activityPrizeId],
    )).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects negative or over-awarded inventory', async () => {
    await expect(database.dataSource.query(
      `UPDATE activity_prize SET awarded_stock = total_stock + 1 WHERE id = $1`, [scenario.activityPrizeId],
    )).rejects.toMatchObject({ code: '23514' });
  });

  it('keeps redemption code hashes unique', async () => {
    await expect(database.dataSource.query(
      `INSERT INTO redemption (id, lottery_record_id, redeem_code_hash, status, redeem_end_at) VALUES ($1, $2, $3, 'WAIT_REDEEM', now() + interval '1 day')`,
      [randomUUID(), scenario.lotteryRecordId, scenario.redeemCodeHash],
    )).rejects.toMatchObject({ code: '23505' });
  });
});
