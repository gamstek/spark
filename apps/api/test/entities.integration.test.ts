import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ActivityVersion,
  ActivityVersionPrize,
  ChannelVisit,
  StaffActivityPermission,
  StockAdjustment,
  WebhookReceipt,
} from '../database/entities/index.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';

const expectedTables = [
  'activity',
  'activity_participation',
  'activity_prize',
  'activity_version',
  'activity_version_prize',
  'admin_account',
  'app_session',
  'audit_event',
  'background_job',
  'channel_visit',
  'dingtalk_form_submission',
  'export_job',
  'lottery_record',
  'media_asset',
  'oauth_state',
  'prize',
  'redemption',
  'staff_account',
  'staff_activity_permission',
  'stock_adjustment',
  'user_account',
  'webhook_receipt',
  'wechat_credential_cache',
  'wechat_identity',
];

describe('TypeORM entity metadata', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.close();
  });

  it('registers every migrated business table', () => {
    const tableNames = database.dataSource.entityMetadatas
      .map((metadata) => metadata.tableName)
      .sort();

    expect(tableNames).toEqual(expectedTables);
  });

  it('models critical migrated columns, keys, and indexes', () => {
    const activityVersion = database.dataSource.getMetadata(ActivityVersion);
    expect(
      activityVersion.columns.map((column) => column.databaseName).sort(),
    ).toEqual([
      'activity_id',
      'activity_name',
      'config',
      'config_schema_version',
      'created_at',
      'draw_ends_at',
      'ends_at',
      'id',
      'published_at',
      'redeem_ends_at',
      'starts_at',
      'status',
      'template_id',
      'template_version',
      'version',
    ]);

    const versionPrize = database.dataSource.getMetadata(ActivityVersionPrize);
    const weight = versionPrize.findColumnWithPropertyName('weight');
    expect(weight).toMatchObject({
      databaseName: 'weight',
      precision: 12,
      scale: 6,
      type: 'numeric',
    });

    const staffPermission = database.dataSource.getMetadata(
      StaffActivityPermission,
    );
    expect(
      staffPermission.primaryColumns.map((column) => column.databaseName),
    ).toEqual(['staff_account_id', 'activity_id']);

    const webhookReceipt = database.dataSource.getMetadata(WebhookReceipt);
    expect(webhookReceipt.uniques.map((unique) => unique.name)).toContain(
      'webhook_receipt_form_record_key',
    );

    const channelVisit = database.dataSource.getMetadata(ChannelVisit);
    expect(channelVisit.indices.map((index) => index.name)).toContain(
      'channel_visit_activity_time_idx',
    );

    const stockAdjustment = database.dataSource.getMetadata(StockAdjustment);
    expect(stockAdjustment.indices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'stock_adjustment_operation_idx',
          isUnique: true,
          where: 'operation_id IS NOT NULL',
        }),
      ]),
    );
  });
});
