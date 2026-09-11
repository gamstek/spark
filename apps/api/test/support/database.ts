import { randomUUID } from 'node:crypto';

import { DataSource, MigrationExecutor } from 'typeorm';

import { createDataSource } from '../../database/data-source.js';

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

export async function createTestDatabase(
  options: {
    throughMigration?: string;
  } = {},
): Promise<TestDatabase> {
  const url = resolveTestDatabaseUrl();

  const schema = `spark_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new DataSource({ type: 'postgres', url });
  await admin.initialize();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await admin.destroy();

  const dataSource = createDataSource({ url, schema });
  await dataSource.initialize();
  if (options.throughMigration) {
    await dataSource.transaction(async (manager) => {
      const executor = new MigrationExecutor(dataSource, manager.queryRunner);
      const migrations = await executor.getPendingMigrations();
      const boundary = migrations.findIndex(
        (migration) => migration.name === options.throughMigration,
      );
      if (boundary === -1) throw new Error('TEST_MIGRATION_BOUNDARY_NOT_FOUND');
      for (const migration of migrations.slice(0, boundary + 1))
        await executor.executeMigration(migration);
    });
  } else {
    await dataSource.runMigrations({ transaction: 'all' });
  }

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
