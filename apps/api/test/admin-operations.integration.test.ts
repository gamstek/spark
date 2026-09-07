import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ActivitiesService } from '../src/activities/activities.service.js';
import { PublishService } from '../src/activities/publish.service.js';
import { AccountsService } from '../src/auth/accounts.service.js';
import { SessionService } from '../src/auth/session.service.js';
import { PrizesService } from '../src/prizes/prizes.service.js';
import { StaffService } from '../src/staff/staff.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';
const config = {
  formId: 'form-admin',
  formUrl:
    'https://alidocs.dingtalk.com/notable/share/form/example?participant=',
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
      name: '新活动',
      templateId: 'exhibition-lottery',
      templateVersion: 1,
      config,
      startsAt: '2026-09-08T00:00:00Z',
      drawEndsAt: '2026-09-09T00:00:00Z',
      endsAt: '2026-09-10T00:00:00Z',
      redeemEndsAt: '2026-09-11T00:00:00Z',
    });
    const detail = (await service.get(created.id)) as {
      revision: number;
      code: string;
    };
    expect(detail.revision).toBe(0);
    expect(detail.code).toMatch(/^[a-z0-9]{10}$/);
  });
  it('creates prizes and only adds positive inventory idempotently', async () => {
    const activity = await new ActivitiesService(database.dataSource).create({
      name: 'Future campaign',
      templateId: 'exhibition-lottery',
      templateVersion: 1,
      config,
      startsAt: '2099-09-08T00:00:00Z',
      drawEndsAt: '2099-09-09T00:00:00Z',
      endsAt: '2099-09-10T00:00:00Z',
      redeemEndsAt: '2099-09-11T00:00:00Z',
    });
    const service = new PrizesService(database.dataSource);
    const prize = await service.create(activity.id, {
      name: '纪念奖',
      totalStock: 0,
      weight: 1,
    });
    const operationId = randomUUID();
    await service.addStock(prize.id, 2, operationId, scenario.adminId);
    await service.addStock(prize.id, 2, operationId, scenario.adminId);
    expect(
      (
        (await service.list(activity.id)) as {
          id: string;
          total_stock: number;
        }[]
      ).find((x) => x.id === prize.id)?.total_stock,
    ).toBe(2);
    await expect(
      service.addStock(prize.id, -1, randomUUID(), scenario.adminId),
    ).rejects.toThrow('INVALID_STOCK_QUANTITY');
  });
  it('rejects adding a prize after the published activity starts', async () => {
    await expect(
      new PrizesService(database.dataSource).create(scenario.activityId, {
        name: 'Too late',
        totalStock: 1,
        weight: 1,
      }),
    ).rejects.toThrow('ACTIVITY_STARTED');
  });
  it('creates a new draft from an immutable published snapshot before start', async () => {
    const activities = new ActivitiesService(database.dataSource);
    const prizes = new PrizesService(database.dataSource);
    const activity = await activities.create({
      name: 'Versioned campaign',
      templateId: 'exhibition-lottery',
      templateVersion: 1,
      config,
      startsAt: '2099-10-01T00:00:00Z',
      drawEndsAt: '2099-10-02T00:00:00Z',
      endsAt: '2099-10-03T00:00:00Z',
      redeemEndsAt: '2099-10-04T00:00:00Z',
    });
    await prizes.create(activity.id, {
      name: 'Published prize',
      totalStock: 1,
      weight: 1,
    });
    await new PublishService(database.dataSource).publish(
      activity.id,
      0,
      scenario.adminId,
    );
    const published = (await activities.get(activity.id)) as {
      published_version_id: string;
    };
    await prizes.create(activity.id, {
      name: 'Next prize',
      totalStock: 1,
      weight: 1,
    });

    const updated = await activities.updateDraft(activity.id, 1, {
      name: 'Version two',
    });
    const detail = (await activities.get(activity.id)) as {
      draft_version_id: string;
      version: number;
    };
    expect(updated.revision).toBe(2);
    expect(detail.version).toBe(2);
    expect(
      await database.dataSource.query(
        `SELECT 1 FROM activity_version_prize WHERE activity_version_id=$1`,
        [published.published_version_id],
      ),
    ).toHaveLength(1);
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
    const rows = (await service.list()) as {
      id: string;
      activity_ids: string[];
    }[];
    expect(rows.find((x) => x.id === created.id)?.activity_ids).toContain(
      scenario.activityId,
    );
    const stored = await database.dataSource.query<{ password_hash: string }[]>(
      `SELECT password_hash FROM staff_account WHERE id=$1`,
      [created.id],
    );
    expect(stored[0]?.password_hash).not.toContain('temporary-password');

    const sessions = new SessionService(database.dataSource, 'test-secret');
    const session = await sessions.create('STAFF', created.id);
    await service.update(
      created.id,
      { displayName: 'Updated operator', activityIds: [] },
      scenario.adminId,
    );
    await expect(
      service.hasActivityPermission(created.id, scenario.activityId),
    ).resolves.toBe(false);
    await service.resetPassword(
      created.id,
      'replacement-password',
      scenario.adminId,
    );
    await expect(sessions.resolve(session.token, 'STAFF')).resolves.toBeNull();

    const accounts = new AccountsService(database.dataSource);
    await expect(
      accounts.authenticate('STAFF', 'operator-new', 'temporary-password'),
    ).resolves.toBeNull();
    await expect(
      accounts.authenticate('STAFF', 'operator-new', 'replacement-password'),
    ).resolves.toMatchObject({ id: created.id });

    await service.setDisabled(created.id, true, scenario.adminId);
    const updated = (await service.list()) as {
      id: string;
      display_name: string;
      disabled_at: Date | null;
      activity_ids: string[];
    }[];
    expect(updated.find((row) => row.id === created.id)).toMatchObject({
      display_name: 'Updated operator',
      activity_ids: [],
    });
    expect(
      updated.find((row) => row.id === created.id)?.disabled_at,
    ).not.toBeNull();
    await expect(
      accounts.authenticate('STAFF', 'operator-new', 'replacement-password'),
    ).resolves.toBeNull();

    const auditActions = await database.dataSource.query<{ action: string }[]>(
      `SELECT action FROM audit_event WHERE resource_id=$1`,
      [created.id],
    );
    expect(auditActions.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        'STAFF_CREATED',
        'STAFF_UPDATED',
        'STAFF_PASSWORD_RESET',
        'STAFF_DISABLED',
      ]),
    );
  });
});
