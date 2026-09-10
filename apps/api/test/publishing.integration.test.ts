import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ActivitiesService } from '../src/activities/activities.service.js';
import { PublishService } from '../src/activities/publish.service.js';
import { MediaService } from '../src/media/media.service.js';
import { PrizesService } from '../src/prizes/prizes.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

const validConfig = {
  formId: 'ding-form',
  formUrl: 'https://alidocs.dingtalk.com/notable/share/form/example',
  prefillField: 'participationId',
  fieldMapping: {
    participationId: '参与记录ID',
    name: '姓名',
    phone: '手机号',
  },
  requireSubscribe: true,
  noPrizeWeight: 1,
  heroAssetId: 'hero-asset',
  rulesText: '活动规则',
};

describe('activity publishing and mutable inventory', () => {
  let database: TestDatabase;
  let scenario: Scenario;
  let draftVersionId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    scenario = await createScenario(database.dataSource);
    draftVersionId = randomUUID();
    await database.dataSource.query(
      `INSERT INTO activity_version (id, activity_id, version, status, template_id, template_version, config_schema_version, config, starts_at, ends_at, draw_ends_at, redeem_ends_at)
       VALUES ($1,$2,2,'DRAFT','exhibition-lottery',1,1,$3,$4,$5,$5,$6)`,
      [
        draftVersionId,
        scenario.activityId,
        validConfig,
        new Date(scenario.now.getTime() + 3_600_000),
        new Date(scenario.now.getTime() + 86_400_000),
        new Date(scenario.now.getTime() + 172_800_000),
      ],
    );
    await database.dataSource.query(
      `UPDATE activity SET draft_version_id=$1, revision=0 WHERE id=$2`,
      [draftVersionId, scenario.activityId],
    );
    await database.dataSource.query(
      `UPDATE activity_version SET starts_at=$2 WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId, new Date(scenario.now.getTime() + 1_800_000)],
    );
  });

  afterAll(async () => database.close());

  it('rejects a stale editor revision', async () => {
    const activities = new ActivitiesService(
      database.dataSource,
      () => scenario.now,
    );
    await expect(
      activities.updateDraft(scenario.activityId, 0, { name: '编辑一' }),
    ).resolves.toMatchObject({ revision: 1 });
    await expect(
      activities.updateDraft(scenario.activityId, 0, { name: '编辑二' }),
    ).rejects.toThrow('VERSION_CONFLICT');
  });

  it('locks activity configuration after the published activity starts', async () => {
    await database.dataSource.query(
      `UPDATE activity_version SET starts_at=$2 WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId, scenario.now],
    );
    const activities = new ActivitiesService(
      database.dataSource,
      () => new Date(scenario.now.getTime() + 1),
    );
    await expect(
      activities.updateDraft(scenario.activityId, 1, { config: validConfig }),
    ).rejects.toThrow('ACTIVITY_LOCKED');
  });

  it('publishes validated snapshots that ignore later prize library edits', async () => {
    await database.dataSource.query(
      `UPDATE activity_version SET starts_at=$2 WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId, new Date(scenario.now.getTime() + 1_800_000)],
    );
    await database.dataSource.query(
      `UPDATE activity_version SET starts_at=$2, draw_ends_at=$3, ends_at=$3, redeem_ends_at=$4 WHERE id=$1`,
      [
        draftVersionId,
        new Date(scenario.now.getTime() + 3_600_000),
        new Date(scenario.now.getTime() + 86_400_000),
        new Date(scenario.now.getTime() + 172_800_000),
      ],
    );
    const published = await new PublishService(
      database.dataSource,
      () => scenario.now,
    ).publish(scenario.activityId, 1, scenario.adminId);
    const snapshot = await database.dataSource.query<{ prize_name: string }[]>(
      `SELECT prize_name FROM activity_prize WHERE id=$1`,
      [scenario.activityPrizeId],
    );
    await database.dataSource.query(
      `UPDATE prize SET name='后来修改的名称' WHERE id=(SELECT prize_id FROM activity_prize WHERE id=$1)`,
      [scenario.activityPrizeId],
    );
    const after = await database.dataSource.query<{ prize_name: string }[]>(
      `SELECT prize_name FROM activity_prize WHERE id=$1`,
      [scenario.activityPrizeId],
    );
    expect(published.version).toBe(2);
    expect(snapshot[0]?.prize_name).toBe('一等奖');
    expect(after[0]?.prize_name).toBe('一等奖');
  });

  it('adds stock once per operation id and can end a draw early', async () => {
    const prizes = new PrizesService(database.dataSource);
    const operationId = randomUUID();
    await prizes.addStock(
      scenario.activityPrizeId,
      3,
      operationId,
      scenario.adminId,
    );
    await prizes.addStock(
      scenario.activityPrizeId,
      3,
      operationId,
      scenario.adminId,
    );
    const stock = await database.dataSource.query<{ total_stock: number }[]>(
      `SELECT total_stock FROM activity_prize WHERE id=$1`,
      [scenario.activityPrizeId],
    );
    expect(stock[0]?.total_stock).toBe(13);
    const activeNow = new Date(scenario.now.getTime() + 2 * 3_600_000);
    const publishing = new PublishService(database.dataSource, () => activeNow);
    await publishing.endDraw(scenario.activityId, scenario.adminId);
    const rows = await database.dataSource.query<{ draw_ends_at: Date }[]>(
      `SELECT draw_ends_at FROM activity_version WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId],
    );
    expect(new Date(rows[0]?.draw_ends_at ?? 0)).toEqual(activeNow);
    await expect(
      publishing.endDraw(scenario.activityId, scenario.adminId),
    ).rejects.toThrow('DRAW_NOT_ACTIVE');
  });

  it('accepts real PNG bytes and rejects disguised or oversized media', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spark-media-'));
    try {
      const media = new MediaService(database.dataSource, root);
      const png = Buffer.from(
        '89504e470d0a1a0a0000000d4948445200000001000000010806000000',
        'hex',
      );
      const saved = await media.save({ bytes: png, originalName: 'hero.png' });
      expect((await readFile(saved.absolutePath)).equals(png)).toBe(true);
      await expect(
        media.save({ bytes: Buffer.from('<svg/>'), originalName: 'fake.png' }),
      ).rejects.toThrow('UNSUPPORTED_MEDIA');
      await expect(
        media.save({
          bytes: Buffer.alloc(5 * 1024 * 1024 + 1),
          originalName: 'large.png',
        }),
      ).rejects.toThrow('MEDIA_TOO_LARGE');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
