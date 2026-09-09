import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ReportsService } from '../src/reports/reports.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

describe('activity reporting', () => {
  let database: TestDatabase;
  let scenario: Scenario;
  beforeAll(async () => {
    database = await createTestDatabase();
    scenario = await createScenario(database.dataSource);
    await database.dataSource.query(
      `UPDATE activity_prize SET awarded_stock=3 WHERE id=$1`,
      [scenario.activityPrizeId],
    );
    await database.dataSource.query(
      `UPDATE redemption
       SET status='WAIT_REDEEM',redeem_end_at=now()+interval '1 day'
       WHERE lottery_record_id=$1`,
      [scenario.lotteryRecordId],
    );
    for (const status of ['REDEEMED', 'EXPIRED']) {
      const userId = randomUUID(),
        participationId = randomUUID(),
        lotteryId = randomUUID();
      await database.dataSource.query(
        `INSERT INTO user_account (id) VALUES ($1)`,
        [userId],
      );
      await database.dataSource.query(
        `INSERT INTO activity_participation (id,activity_id,user_id,lead_completed) VALUES ($1,$2,$3,true)`,
        [participationId, scenario.activityId, userId],
      );
      await database.dataSource.query(
        `INSERT INTO lottery_record (id,activity_id,user_id,participation_id,activity_prize_id,prize_name,redeem_end_at) VALUES ($1,$2,$3,$4,$5,'一等奖',$6)`,
        [
          lotteryId,
          scenario.activityId,
          userId,
          participationId,
          scenario.activityPrizeId,
          new Date(scenario.now.getTime() + 86_400_000),
        ],
      );
      await database.dataSource.query(
        `INSERT INTO redemption (id,lottery_record_id,redeem_code_hash,status,redeem_end_at,redeemed_at) VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          randomUUID(),
          lotteryId,
          randomUUID(),
          status,
          new Date(scenario.now.getTime() + 86_400_000),
          status === 'REDEEMED' ? scenario.now : null,
        ],
      );
    }
    await database.dataSource.query(
      `INSERT INTO channel_visit (id,activity_id,user_id,channel_code,visited_at) VALUES ($1,$2,$3,'first',$4),($5,$2,$3,'later',$6),($7,$2,$8,'second',$4)`,
      [
        randomUUID(),
        scenario.activityId,
        scenario.userIds[0],
        scenario.now,
        randomUUID(),
        new Date(scenario.now.getTime() + 1000),
        randomUUID(),
        scenario.userIds[1],
      ],
    );
  });
  afterAll(async () => database.close());
  it('keeps inventory and redemption totals consistent', async () => {
    const report = await new ReportsService(database.dataSource).get(
      scenario.activityId,
    );
    expect(report.awarded).toBe(
      report.pending + report.redeemed + report.expired,
    );
    expect(report.available).toBe(report.totalStock - report.awarded);
    expect(report).toMatchObject({
      pending: 1,
      redeemed: 1,
      expired: 1,
      visits: 3,
      uniqueVisitors: 2,
    });
  });
  it('counts a visitor once and attributes only the first channel', async () => {
    const report = await new ReportsService(database.dataSource).get(
      scenario.activityId,
    );
    expect(report.channels).toEqual([
      { code: 'first', visitors: 1 },
      { code: 'second', visitors: 1 },
    ]);
  });
});
