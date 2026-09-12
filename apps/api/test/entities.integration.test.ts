import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ActivityVersion,
  ActivityVersionPrize,
  ActivityFormSubmission,
  AdminAccount,
  ChannelVisit,
  StaffActivityPermission,
  StockAdjustment,
} from '../database/entities/index.js';
import { createAdminAccount } from '../database/seeds/admin-seed.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';

const expectedTables = [
  'activity',
  'activity_form_submission',
  'activity_participation',
  'activity_prize',
  'activity_version',
  'activity_version_prize',
  'admin_account',
  'app_session',
  'audit_event',
  'background_job',
  'channel_visit',
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

  it('fresh migrations create exactly the registered business tables', async () => {
    const rows = await database.dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema()`,
    );
    const tableNames = rows
      .map((row) => row.table_name)
      .filter((name) => name !== 'typeorm_migrations')
      .sort();
    expect(tableNames).toEqual(expectedTables);

    const participationColumns = await database.dataSource.query<
      { column_name: string }[]
    >(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema=current_schema() AND table_name='activity_participation'`,
    );
    expect(
      participationColumns.map((column) => column.column_name),
    ).not.toContain('adopted_submission_id');
  });

  it('records only the fresh self-hosted form migration chain', async () => {
    const migrations = await database.dataSource.query<{ name: string }[]>(
      `SELECT name FROM typeorm_migrations ORDER BY timestamp`,
    );
    const names = migrations.map((migration) => migration.name);

    expect(names).toEqual([
      'InitialSchema1788739200000',
      'WechatSubscriptionCache1788739201000',
      'PublishingAndMedia1788739202000',
      'LotteryRedemptionCodes1788739204000',
      'ExportMetadata1788739205000',
      'ActivityVersionPrizes1788739206000',
      'LotteryNoPrizeOutcome1788739207000',
      'WechatActivityEntryTokens1788739208000',
      'WechatCallbackReceipts1788739209000',
      'DropWechatEventActivityEntry1788739210000',
    ]);
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

    const submission = database.dataSource.getMetadata(ActivityFormSubmission);
    expect(submission.uniques.map((unique) => unique.name)).toContain(
      'activity_form_submission_participation_key',
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

  it('creates an administrator through its repository mapping', async () => {
    const created = await createAdminAccount(database.dataSource, {
      username: 'operator',
      password: 'correct horse battery staple',
    });

    const repository = database.dataSource.getRepository(AdminAccount);
    const reloaded = await repository.findOneByOrFail({ id: created.id });
    expect(reloaded).toMatchObject({
      username: 'operator',
      displayName: 'operator',
      disabledAt: null,
    });
    expect(reloaded.passwordHash).toMatch(/^scrypt\$/);

    const [persisted] = await database.dataSource.query<
      { display_name: string; password_hash: string }[]
    >(`SELECT display_name, password_hash FROM admin_account WHERE id = $1`, [
      created.id,
    ]);
    expect(persisted).toEqual({
      display_name: 'operator',
      password_hash: reloaded.passwordHash,
    });
  });
});
