import 'reflect-metadata';

import { MODULE_METADATA } from '@nestjs/common/constants';
import { DataSource } from 'typeorm';
import { afterEach, describe, expect, it } from 'vitest';

import { createDataSource } from '../database/data-source.js';
import { AppModule } from '../src/app.module.js';
import { createTestDatabase } from './support/database.js';

type ApplicationDataSourceProvider = {
  provide: typeof DataSource;
  useFactory: (dataSource?: DataSource) => Promise<DataSource>;
};

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDatabaseSchema = process.env.DATABASE_SCHEMA;

function restoreEnvironmentVariable(
  name: 'DATABASE_URL' | 'DATABASE_SCHEMA',
  value: string | undefined,
) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function getApplicationDataSourceProvider(): ApplicationDataSourceProvider {
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    AppModule,
  ) as unknown[];
  const provider = providers.find(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'provide' in candidate &&
      candidate.provide === DataSource,
  );
  if (
    typeof provider !== 'object' ||
    provider === null ||
    !('useFactory' in provider) ||
    typeof provider.useFactory !== 'function'
  )
    throw new Error('DATASOURCE_PROVIDER_NOT_FOUND');
  return provider as ApplicationDataSourceProvider;
}

async function currentSchema(dataSource: DataSource): Promise<string> {
  const rows = await dataSource.query<{ schema: string }[]>(
    `SELECT current_schema() AS schema`,
  );
  return rows[0]!.schema;
}

function connectionTarget(dataSource: DataSource): {
  url: string;
  schema: string;
} {
  const options = dataSource.options;
  if (options.type !== 'postgres')
    throw new Error('TEST_DATABASE_TARGET_NOT_POSTGRES');
  if (typeof options.url !== 'string' || typeof options.schema !== 'string')
    throw new Error('TEST_DATABASE_TARGET_NOT_FOUND');
  return { url: options.url, schema: options.schema };
}

describe('application database startup', () => {
  afterEach(() => {
    restoreEnvironmentVariable('DATABASE_URL', originalDatabaseUrl);
    restoreEnvironmentVariable('DATABASE_SCHEMA', originalDatabaseSchema);
  });

  it('uses an explicit schema as the PostgreSQL search path', async () => {
    const database = await createTestDatabase();
    const { url, schema } = connectionTarget(database.dataSource);
    const candidate = createDataSource({ url, schema });
    try {
      await candidate.initialize();
      await expect(currentSchema(candidate)).resolves.toBe(schema);
    } finally {
      if (candidate.isInitialized) await candidate.destroy();
      await database.close();
    }
  });

  it('uses a safe environment schema as the PostgreSQL search path', async () => {
    const database = await createTestDatabase();
    const { url, schema } = connectionTarget(database.dataSource);
    process.env.DATABASE_URL = url;
    process.env.DATABASE_SCHEMA = schema;
    const candidate = createDataSource();
    try {
      await candidate.initialize();
      await expect(currentSchema(candidate)).resolves.toBe(schema);
    } finally {
      if (candidate.isInitialized) await candidate.destroy();
      await database.close();
    }
  });

  it('rejects unsafe schema identifiers before connecting', () => {
    expect(() => createDataSource({ schema: 'public;drop_schema' })).toThrow(
      'INVALID_DATABASE_SCHEMA',
    );
    process.env.DATABASE_SCHEMA = 'public,other';
    expect(() => createDataSource()).toThrow('INVALID_DATABASE_SCHEMA');
    expect(() => createDataSource({ schema: 'a'.repeat(64) })).toThrow(
      'INVALID_DATABASE_SCHEMA',
    );
  });

  it('rejects a pending migration before startup and closes its connection', async () => {
    const database = await createTestDatabase();
    const { url, schema } = connectionTarget(database.dataSource);
    await database.dataSource.undoLastMigration({ transaction: 'all' });
    process.env.DATABASE_URL = url;
    process.env.DATABASE_SCHEMA = schema;
    const candidate = createDataSource({ url, schema });
    const provider = getApplicationDataSourceProvider();
    let started: DataSource | undefined;
    let startupError: unknown;
    try {
      try {
        started = await provider.useFactory(candidate);
      } catch (error) {
        startupError = error;
      }
      expect(startupError).toMatchObject({
        message: expect.stringMatching(
          /DATABASE_MIGRATIONS_PENDING.*db:migrate/,
        ),
      });
      expect(candidate.isInitialized).toBe(false);
    } finally {
      if (started?.isInitialized) await started.destroy();
      if (candidate.isInitialized) await candidate.destroy();
      await database.dataSource.runMigrations({ transaction: 'all' });
      await database.close();
    }
  });

  it('starts with the production provider on a fully migrated schema', async () => {
    const database = await createTestDatabase();
    const { url, schema } = connectionTarget(database.dataSource);
    process.env.DATABASE_URL = url;
    process.env.DATABASE_SCHEMA = schema;
    const candidate = createDataSource({ url, schema });
    const provider = getApplicationDataSourceProvider();
    let started: DataSource | undefined;
    try {
      started = await provider.useFactory(candidate);
      expect(started.isInitialized).toBe(true);
      await expect(currentSchema(started)).resolves.toBe(schema);
      await expect(started.showMigrations()).resolves.toBe(false);
    } finally {
      if (started?.isInitialized) await started.destroy();
      if (candidate.isInitialized) await candidate.destroy();
      await database.close();
    }
  });
});
