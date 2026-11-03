import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ActivitiesService } from '../src/activities/activities.service.js';
import { PublishService } from '../src/activities/publish.service.js';
import type { Clock } from '../src/common/clock.js';
import { MediaService } from '../src/media/media.service.js';
import { PrizesService } from '../src/prizes/prizes.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

const fixedClock = (now: Date): Clock => ({ now: () => now });

const validConfig = {
  requireSubscribe: true,
  winningProbability: 0,
  halfDayPrizeLimits: {},
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
      fixedClock(scenario.now),
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
    const publishing = new PublishService(
      database.dataSource,
      fixedClock(activeNow),
    );
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

  it('pauses and resumes an active draw without changing its schedule', async () => {
    const activeNow = new Date(scenario.now.getTime() + 2 * 3_600_000);
    const publishing = new PublishService(
      database.dataSource,
      fixedClock(activeNow),
    );
    await database.dataSource.query(
      `UPDATE activity_version SET draw_ends_at=$2,ends_at=GREATEST(ends_at,$2) WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId, new Date(activeNow.getTime() + 3_600_000)],
    );
    const before = await database.dataSource.query<{ draw_ends_at: Date }[]>(
      `SELECT draw_ends_at FROM activity_version WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId],
    );

    await publishing.pause(scenario.activityId, scenario.adminId);
    await expect(
      publishing.pause(scenario.activityId, scenario.adminId),
    ).rejects.toThrow('ACTIVITY_ALREADY_PAUSED');
    await publishing.resume(scenario.activityId, scenario.adminId);

    const activity = await database.dataSource.query<
      { paused_at: Date | null }[]
    >(`SELECT paused_at FROM activity WHERE id=$1`, [scenario.activityId]);
    const after = await database.dataSource.query<{ draw_ends_at: Date }[]>(
      `SELECT draw_ends_at FROM activity_version WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId],
    );
    const audits = await database.dataSource.query<{ action: string }[]>(
      `SELECT action FROM audit_event WHERE resource_id=$1 AND action IN ('ACTIVITY_PAUSED','ACTIVITY_RESUMED') ORDER BY created_at`,
      [scenario.activityId],
    );

    expect(activity[0]?.paused_at).toBeNull();
    expect(after[0]?.draw_ends_at).toEqual(before[0]?.draw_ends_at);
    expect(audits.map((row) => row.action)).toEqual([
      'ACTIVITY_PAUSED',
      'ACTIVITY_RESUMED',
    ]);
  });

  it('allows pause at the exact start boundary', async () => {
    const startsAt = new Date(scenario.now.getTime() + 3 * 3_600_000);
    await database.dataSource.query(
      `UPDATE activity SET paused_at=NULL WHERE id=$1`,
      [scenario.activityId],
    );
    await database.dataSource.query(
      `UPDATE activity_version
       SET starts_at=$2,draw_ends_at=$3,ends_at=$4
       WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [
        scenario.activityId,
        startsAt,
        new Date(startsAt.getTime() + 3_600_000),
        new Date(startsAt.getTime() + 7_200_000),
      ],
    );
    const publishing = new PublishService(
      database.dataSource,
      fixedClock(startsAt),
    );

    await expect(
      publishing.pause(scenario.activityId, scenario.adminId),
    ).resolves.toBeUndefined();
  });

  it('rejects resume at the exact draw deadline as not running', async () => {
    const drawEndsAt = new Date(scenario.now.getTime() + 4 * 3_600_000);
    await database.dataSource.query(
      `UPDATE activity SET paused_at=$2 WHERE id=$1`,
      [scenario.activityId, scenario.now],
    );
    await database.dataSource.query(
      `UPDATE activity_version
       SET starts_at=$2,draw_ends_at=$3,ends_at=$4
       WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [
        scenario.activityId,
        new Date(scenario.now.getTime() + 3 * 3_600_000),
        drawEndsAt,
        new Date(drawEndsAt.getTime() + 3_600_000),
      ],
    );
    const publishing = new PublishService(
      database.dataSource,
      fixedClock(drawEndsAt),
    );

    await expect(
      publishing.resume(scenario.activityId, scenario.adminId),
    ).rejects.toThrow('ACTIVITY_NOT_RUNNING');
  });

  it('compresses historical uploaded images in place without changing their URLs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spark-media-'));
    try {
      const { default: sharp } = await import('sharp');
      const bytes = await sharp({
        create: {
          width: 1800,
          height: 900,
          channels: 3,
          background: '#e84356',
        },
      })
        .png({ compressionLevel: 0 })
        .toBuffer();
      const id = randomUUID();
      const storageKey = `${randomUUID()}.png`;
      const path = join(root, storageKey);
      await writeFile(path, bytes);
      await database.dataSource.query(
        `INSERT INTO media_asset (id,storage_key,mime_type,byte_size) VALUES ($1,$2,'image/png',$3)`,
        [id, storageKey, bytes.length],
      );
      const service = new MediaService(database.dataSource, root);
      const preview = await service.optimizeStoredAsset(id);
      expect(preview.after).toBeLessThan(preview.before / 10);
      expect((await readFile(path)).length).toBe(bytes.length);
      const result = await service.optimizeStoredAsset(id, true);
      expect((await readFile(path)).length).toBe(result.after);
      const [asset] = await database.dataSource.query(
        `SELECT storage_key,mime_type,byte_size FROM media_asset WHERE id=$1`,
        [id],
      );
      expect(asset).toMatchObject({
        storage_key: storageKey,
        mime_type: 'image/png',
        byte_size: String(result.after),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(['jpeg', 'webp'] as const)(
    'preserves the %s format when compressing uploaded prize images',
    async (format) => {
      const root = await mkdtemp(join(tmpdir(), 'spark-media-'));
      try {
        const { default: sharp } = await import('sharp');
        const bytes = await sharp({
          create: {
            width: 1800,
            height: 900,
            channels: 3,
            background: '#e84356',
          },
        })
          .toFormat(format, { quality: 100 })
          .toBuffer();
        const saved = await new MediaService(database.dataSource, root).save({
          bytes,
          originalName: `prize.${format}`,
        });
        const compressed = await readFile(saved.absolutePath);
        expect(compressed.length).toBeLessThanOrEqual(bytes.length);
        expect((await sharp(compressed).metadata()).format).toBe(format);
        expect(saved.storageKey).toMatch(
          format === 'jpeg' ? /\.jpg$/ : /\.webp$/,
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it('compresses real PNG uploads and rejects disguised, truncated or oversized media', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spark-media-'));
    try {
      const media = new MediaService(database.dataSource, root);
      const { default: sharp } = await import('sharp');
      const png = await sharp({
        create: {
          width: 1800,
          height: 900,
          channels: 3,
          background: '#f13c45',
        },
      })
        .png({ compressionLevel: 0 })
        .toBuffer();
      const saved = await media.save({ bytes: png, originalName: 'hero.png' });
      const compressed = await readFile(saved.absolutePath);
      expect(compressed.length).toBeLessThan(png.length / 10);
      expect(saved.storageKey).toMatch(/\.png$/);
      expect(await sharp(compressed).metadata()).toMatchObject({
        format: 'png',
        width: 1280,
        height: 640,
      });
      const [asset] = await database.dataSource.query(
        `SELECT mime_type,byte_size FROM media_asset WHERE id=$1`,
        [saved.id],
      );
      expect(asset).toMatchObject({
        mime_type: 'image/png',
        byte_size: String(compressed.length),
      });
      await expect(
        media.save({
          bytes: png.subarray(0, 24),
          originalName: 'truncated.png',
        }),
      ).rejects.toThrow('UNSUPPORTED_MEDIA');
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
