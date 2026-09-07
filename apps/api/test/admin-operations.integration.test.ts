import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ActivitiesService } from '../src/activities/activities.service.js';
import { PrizesService } from '../src/prizes/prizes.service.js';
import { StaffService } from '../src/staff/staff.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';
const config = {
  formId: 'form-admin',
  formUrl: 'https://alidocs.dingtalk.com/notable/share/form/example?participant=',
  prefillField: 'participant',
  fieldMapping: { participationId: '参与编号', name: '姓名', phone: '手机号' },
  requireSubscribe: true,
  heroAssetId: 'hero',
  rulesText: '规则',
};
describe('admin operations', () => {
  let database: TestDatabase;
  let scenario: Scenario;
  beforeAll(async () => {
    database = await createTestDatabase();
    scenario = await createScenario(database.dataSource);
  });
  afterAll(async () => database.close());
  it('creates a draft using only a supported template version', async () => {
    const service = new ActivitiesService(database.dataSource);
    await expect(
      service.create({
        code: 'new-campaign',
        name: '新活动',
        templateId: 'exhibition-lottery',
        templateVersion: 99,
        config,
        startsAt: '2026-09-08T00:00:00Z',
        drawEndsAt: '2026-09-09T00:00:00Z',
        endsAt: '2026-09-10T00:00:00Z',
        redeemEndsAt: '2026-09-11T00:00:00Z',
      }),
    ).rejects.toThrow('UNSUPPORTED_TEMPLATE');
    const created = await service.create({
      code: 'new-campaign',
      name: '新活动',
      templateId: 'exhibition-lottery',
      templateVersion: 1,
      config,
      startsAt: '2026-09-08T00:00:00Z',
      drawEndsAt: '2026-09-09T00:00:00Z',
      endsAt: '2026-09-10T00:00:00Z',
      redeemEndsAt: '2026-09-11T00:00:00Z',
    });
    expect(((await service.get(created.id)) as { revision: number }).revision).toBe(0);
  });
  it('creates prizes and only adds positive inventory idempotently', async () => {
    const service = new PrizesService(database.dataSource);
    const prize = await service.create(scenario.activityId, {
      name: '纪念奖',
      totalStock: 0,
      weight: 1,
    });
    const operationId = randomUUID();
    await service.addStock(prize.id, 2, operationId, scenario.adminId);
    await service.addStock(prize.id, 2, operationId, scenario.adminId);
    expect(
      ((await service.list(scenario.activityId)) as { id: string; total_stock: number }[]).find(
        (x) => x.id === prize.id,
      )?.total_stock,
    ).toBe(2);
    await expect(service.addStock(prize.id, -1, randomUUID(), scenario.adminId)).rejects.toThrow(
      'INVALID_STOCK_QUANTITY',
    );
  });
  it('creates staff with scoped activity access and a hashed password', async () => {
    const service = new StaffService(database.dataSource);
    const created = await service.create(
      {
        username: 'operator-new',
        displayName: '新工作人员',
        password: 'temporary-password',
        activityIds: [scenario.activityId],
      },
      scenario.adminId,
    );
    const rows = (await service.list()) as { id: string; activity_ids: string[] }[];
    expect(rows.find((x) => x.id === created.id)?.activity_ids).toContain(scenario.activityId);
    const stored = await database.dataSource.query<{ password_hash: string }[]>(
      `SELECT password_hash FROM staff_account WHERE id=$1`,
      [created.id],
    );
    expect(stored[0]?.password_hash).not.toContain('temporary-password');
  });
});
