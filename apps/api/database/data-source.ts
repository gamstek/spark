import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { InitialSchema1788739200000 } from './migrations/1788739200000-InitialSchema.js';
import { WechatSubscriptionCache1788739201000 } from './migrations/1788739201000-WechatSubscriptionCache.js';

export function createDataSource(options: { url?: string; schema?: string } = {}): DataSource {
  return new DataSource({
    type: 'postgres',
    url: options.url ?? process.env.DATABASE_URL ?? 'postgresql://spark:spark_local@127.0.0.1:54329/spark_test',
    schema: options.schema ?? process.env.DATABASE_SCHEMA ?? 'public',
    migrationsTableName: 'typeorm_migrations',
    migrations: [InitialSchema1788739200000, WechatSubscriptionCache1788739201000],
    entities: [],
    synchronize: false,
    logging: false,
    extra: options.schema ? { options: `-c search_path=${options.schema}` } : undefined,
  });
}

export default createDataSource();
