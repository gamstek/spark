import { randomUUID } from 'node:crypto';

import { DataSource } from 'typeorm';

import { InitialSchema1788739200000 } from '../../database/migrations/1788739200000-InitialSchema.js';

export interface TestDatabase {
  dataSource: DataSource;
  close(): Promise<void>;
}

const defaultTestUrl = 'postgresql://spark:spark_local@127.0.0.1:54329/spark_test';

export async function createTestDatabase(): Promise<TestDatabase> {
  const url = process.env.TEST_DATABASE_URL ?? defaultTestUrl;
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.toLowerCase().includes('test')) throw new Error('REFUSING_NON_TEST_DATABASE');

  const schema = `spark_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new DataSource({ type: 'postgres', url });
  await admin.initialize();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await admin.destroy();

  const dataSource = new DataSource({
    type: 'postgres', url, schema, migrationsTableName: 'typeorm_migrations',
    migrations: [InitialSchema1788739200000], entities: [], synchronize: false,
  });
  await dataSource.initialize();
  await dataSource.query(`SET search_path TO "${schema}"`);
  await dataSource.runMigrations({ transaction: 'all' });

  return {
    dataSource,
    async close() {
      if (dataSource.isInitialized) await dataSource.destroy();
      if (!schema.startsWith('spark_test_')) throw new Error('REFUSING_UNSAFE_SCHEMA_DROP');
      const cleanup = new DataSource({ type: 'postgres', url });
      await cleanup.initialize();
      await cleanup.query(`DROP SCHEMA "${schema}" CASCADE`);
      await cleanup.destroy();
    },
  };
}
