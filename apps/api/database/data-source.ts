import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { databaseEntities } from './entities/index.js';
import { InitialSchema1788739200000 } from './migrations/1788739200000-InitialSchema.js';
import { WechatSubscriptionCache1788739201000 } from './migrations/1788739201000-WechatSubscriptionCache.js';
import { PublishingAndMedia1788739202000 } from './migrations/1788739202000-PublishingAndMedia.js';
import { DingTalkSubmissions1788739203000 } from './migrations/1788739203000-DingTalkSubmissions.js';
import { LotteryRedemptionCodes1788739204000 } from './migrations/1788739204000-LotteryRedemptionCodes.js';
import { ExportMetadata1788739205000 } from './migrations/1788739205000-ExportMetadata.js';
import { ActivityVersionPrizes1788739206000 } from './migrations/1788739206000-ActivityVersionPrizes.js';
import { LotteryNoPrizeOutcome1788739207000 } from './migrations/1788739207000-LotteryNoPrizeOutcome.js';
import { WechatActivityEntryTokens1788739208000 } from './migrations/1788739208000-WechatActivityEntryTokens.js';
import { WechatCallbackReceipts1788739209000 } from './migrations/1788739209000-WechatCallbackReceipts.js';

export function createDataSource(
  options: { url?: string; schema?: string } = {},
): DataSource {
  const schema = options.schema ?? process.env.DATABASE_SCHEMA ?? 'public';
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema))
    throw new Error('INVALID_DATABASE_SCHEMA');

  return new DataSource({
    type: 'postgres',
    url:
      options.url ??
      process.env.DATABASE_URL ??
      'postgresql://spark:spark_local@127.0.0.1:54329/spark_test',
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
      WechatCallbackReceipts1788739209000,
    ],
    entities: databaseEntities,
    synchronize: false,
    logging: false,
    extra: { options: `-c search_path=${schema}` },
  });
}

export async function initializeApplicationDataSource(
  dataSource = createDataSource(),
): Promise<DataSource> {
  try {
    await dataSource.initialize();
    if (await dataSource.showMigrations())
      throw new Error(
        'DATABASE_MIGRATIONS_PENDING: run pnpm --filter @spark/api db:migrate before starting the API',
      );
    return dataSource;
  } catch (error) {
    if (dataSource.isInitialized) await dataSource.destroy();
    throw error;
  }
}

export default createDataSource();
