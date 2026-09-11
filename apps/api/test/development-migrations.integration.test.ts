import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { expect, it } from 'vitest';

import { ExportsService } from '../src/exports/exports.service.js';
import { JobsService } from '../src/jobs/jobs.service.js';
import { createTestDatabase } from './support/database.js';

const execFileAsync = promisify(execFile);

it('prepares an older development database before starting the API', async () => {
  const database = await createTestDatabase();
  try {
    await database.dataSource.undoLastMigration();
    await database.dataSource.undoLastMigration();
    await database.dataSource.undoLastMigration();
    await database.dataSource.undoLastMigration();
    const exportColumns = () =>
      database.dataSource.query<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema=current_schema() AND table_name='export_job'`,
      );
    expect(
      (await exportColumns()).map((column) => column.column_name),
    ).not.toContain('expires_at');
    expect(await database.dataSource.showMigrations()).toBe(true);

    if (database.dataSource.options.type !== 'postgres')
      throw new Error('Expected an isolated PostgreSQL test database');
    const connectionUrl = database.dataSource.options.url;
    if (!connectionUrl) throw new Error('Expected a PostgreSQL connection URL');
    const url = new URL(connectionUrl);
    const schema = database.dataSource.options.schema!;
    const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm';
    const args =
      process.platform === 'win32'
        ? ['/d', '/s', '/c', 'pnpm run predev']
        : ['run', 'predev'];
    await execFileAsync(command, args, {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: {
        ...process.env,
        DATABASE_URL: url.toString(),
        DATABASE_SCHEMA: schema,
      },
      timeout: 45_000,
    });

    expect(await database.dataSource.showMigrations()).toBe(false);
    expect((await exportColumns()).map((column) => column.column_name)).toEqual(
      expect.arrayContaining(['expires_at', 'snapshot_at', 'row_count']),
    );
    const exports = new ExportsService(
      database.dataSource,
      new JobsService(database.dataSource),
    );
    await expect(exports.cleanupExpired()).resolves.toBe(0);
  } finally {
    await database.close();
  }
}, 60_000);
