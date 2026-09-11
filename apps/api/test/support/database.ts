import { randomUUID } from 'node:crypto';

import { DataSource } from 'typeorm';

import { databaseEntities } from '../../database/entities/index.js';
import { InitialSchema1788739200000 } from '../../database/migrations/1788739200000-InitialSchema.js';
import { WechatSubscriptionCache1788739201000 } from '../../database/migrations/1788739201000-WechatSubscriptionCache.js';
import { PublishingAndMedia1788739202000 } from '../../database/migrations/1788739202000-PublishingAndMedia.js';
import { DingTalkSubmissions1788739203000 } from '../../database/migrations/1788739203000-DingTalkSubmissions.js';
import { LotteryRedemptionCodes1788739204000 } from '../../database/migrations/1788739204000-LotteryRedemptionCodes.js';
import { ExportMetadata1788739205000 } from '../../database/migrations/1788739205000-ExportMetadata.js';
import { ActivityVersionPrizes1788739206000 } from '../../database/migrations/1788739206000-ActivityVersionPrizes.js';
import { LotteryNoPrizeOutcome1788739207000 } from '../../database/migrations/1788739207000-LotteryNoPrizeOutcome.js';
import { WechatActivityEntryTokens1788739208000 } from '../../database/migrations/1788739208000-WechatActivityEntryTokens.js';

export interface TestDatabase {
  dataSource: DataSource;
  close(): Promise<void>;
}

const defaultTestUrl =
  'postgresql://spark:spark_local@127.0.0.1:54329/spark_test';

export function resolveTestDatabaseUrl(
  environment: Record<string, string | undefined> = process.env,
): string {
  const url = environment.DATABASE_URL ?? defaultTestUrl;
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.toLowerCase().includes('test'))
    throw new Error('REFUSING_NON_TEST_DATABASE');
  return url;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const url = resolveTestDatabaseUrl();

  const schema = `spark_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new DataSource({ type: 'postgres', url });
  await admin.initialize();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await admin.destroy();

  const dataSource = new DataSource({
    type: 'postgres',
    url,
    schema,
    migrationsTableName: 'typeorm_migrations',
    migrations: [
      InitialSchema1788739200000,
      WechatSubscriptionCache1788739201000,
      PublishingAndMedia1788739202000,
      DingTalkSubmissions1788739203000,
      LotteryRedemptionCodes1788739204000,
      ExportMetadata1788739205000,
      ActivityVersionPrizes1788739206000,
      LotteryNoPrizeOutcome1788739207000,
      WechatActivityEntryTokens1788739208000,
    ],
    entities: databaseEntities,
    synchronize: false,
    extra: { options: `-c search_path=${schema}` },
  });
  await dataSource.initialize();
  await dataSource.runMigrations({ transaction: 'all' });

  return {
    dataSource,
    async close() {
      if (dataSource.isInitialized) await dataSource.destroy();
      if (!schema.startsWith('spark_test_'))
        throw new Error('REFUSING_UNSAFE_SCHEMA_DROP');
      const cleanup = new DataSource({ type: 'postgres', url });
      await cleanup.initialize();
      await cleanup.query(`DROP SCHEMA "${schema}" CASCADE`);
      await cleanup.destroy();
    },
  };
}
