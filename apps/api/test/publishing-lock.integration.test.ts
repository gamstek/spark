import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { Module, type Provider } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PublishService } from '../src/activities/publish.service.js';
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
  heroAssetId: 'hero-asset',
  rulesText: '活动规则',
};

describe('activity publishing lock', () => {
  let database: TestDatabase;
  let scenario: Scenario;
  let draftVersionId: string;
  let publishedVersionId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    scenario = await createScenario(database.dataSource);
    draftVersionId = randomUUID();
    const published = await database.dataSource.query<
      { published_version_id: string }[]
    >(`SELECT published_version_id FROM activity WHERE id=$1`, [
      scenario.activityId,
    ]);
    publishedVersionId = published[0]!.published_version_id;
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
      `UPDATE activity SET draft_version_id=$1, revision=4 WHERE id=$2`,
      [draftVersionId, scenario.activityId],
    );
  });

  afterAll(async () => database.close());

  it('assembles the publishing service through the production module provider', async () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AppModule,
    ) as unknown[];
    const publishProvider = providers.find(
      (provider) =>
        provider === PublishService ||
        (typeof provider === 'object' &&
          provider !== null &&
          'provide' in provider &&
          provider.provide === PublishService),
    );
    expect(publishProvider).toBeDefined();

    const originalParameterTypes = Reflect.getMetadata(
      'design:paramtypes',
      PublishService,
    );
    // Vitest omits decorator metadata that the production TypeScript build emits.
    Reflect.defineMetadata(
      'design:paramtypes',
      [DataSource, Function],
      PublishService,
    );
    class PublishAssemblyModule {}
    Module({
      providers: [
        { provide: DataSource, useValue: database.dataSource },
        publishProvider as Provider,
      ],
    })(PublishAssemblyModule);

    try {
      const context = await NestFactory.createApplicationContext(
        PublishAssemblyModule,
        { abortOnError: false, logger: false },
      );
      expect(context.get(PublishService)).toBeInstanceOf(PublishService);
      await context.close();
    } finally {
      if (originalParameterTypes === undefined)
        Reflect.deleteMetadata('design:paramtypes', PublishService);
      else
        Reflect.defineMetadata(
          'design:paramtypes',
          originalParameterTypes,
          PublishService,
        );
    }
  });

  it('rejects a saved draft at the published activity start without partial writes', async () => {
    await expect(
      new PublishService(database.dataSource, () => scenario.now).publish(
        scenario.activityId,
        4,
        scenario.adminId,
      ),
    ).rejects.toThrow('ACTIVITY_LOCKED');

    const activity = await database.dataSource.query<
      {
        draft_version_id: string | null;
        published_version_id: string | null;
        revision: number;
      }[]
    >(
      `SELECT draft_version_id, published_version_id, revision FROM activity WHERE id=$1`,
      [scenario.activityId],
    );
    const versions = await database.dataSource.query<
      { id: string; status: string }[]
    >(`SELECT id, status FROM activity_version WHERE id IN ($1, $2)`, [
      publishedVersionId,
      draftVersionId,
    ]);
    const audits = await database.dataSource.query<{ action: string }[]>(
      `SELECT action FROM audit_event WHERE resource_id=$1 AND action='ACTIVITY_PUBLISHED'`,
      [scenario.activityId],
    );

    expect(activity[0]).toEqual({
      draft_version_id: draftVersionId,
      published_version_id: publishedVersionId,
      revision: 4,
    });
    expect(versions).toEqual(
      expect.arrayContaining([
        { id: publishedVersionId, status: 'PUBLISHED' },
        { id: draftVersionId, status: 'DRAFT' },
      ]),
    );
    expect(audits).toEqual([]);
  });
});
