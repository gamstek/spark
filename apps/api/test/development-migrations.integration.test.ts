import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { expect, it } from 'vitest';

import { ExportsService } from '../src/exports/exports.service.js';
import { JobsService } from '../src/jobs/jobs.service.js';
import { MaintenanceService } from '../src/maintenance/maintenance.service.js';
import { createTestDatabase } from './support/database.js';

const execFileAsync = promisify(execFile);

it('prepares an older development database before starting the API', async () => {
  const database = await createTestDatabase({
    throughMigration: 'LotteryRedemptionCodes1788739204000',
  });
  try {
    expect(
      await database.dataSource.query(
        `SELECT name FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 1`,
      ),
    ).toEqual([{ name: 'LotteryRedemptionCodes1788739204000' }]);
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

it('retires populated callback entry tables on upgrade and preserves OAuth data', async () => {
  const database = await createTestDatabase({
    throughMigration: 'WechatCallbackReceipts1788739209000',
  });
  const source = database.dataSource;
  try {
    expect(
      await source.query(
        `SELECT name FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 1`,
      ),
    ).toEqual([{ name: 'WechatCallbackReceipts1788739209000' }]);
    const userId = randomUUID();
    const activityId = randomUUID();
    await source.query(`INSERT INTO user_account (id) VALUES ($1)`, [userId]);
    await source.query(
      `INSERT INTO activity (id,code,name) VALUES ($1,'legacy-entry','Legacy entry')`,
      [activityId],
    );
    await source.query(
      `INSERT INTO wechat_identity (id,user_id,app_id,openid) VALUES ($1,$2,'retained-app','retained-openid')`,
      [randomUUID(), userId],
    );
    await source.query(
      `INSERT INTO app_session (id,session_hash,role,user_id,expires_at) VALUES ($1,'retained-session','ACTIVITY',$2,now()+interval '1 day')`,
      [randomUUID(), userId],
    );
    await source.query(
      `INSERT INTO wechat_activity_entry_token (id,token_hash,user_id,activity_id,expires_at) VALUES ($1,'legacy-token',$2,$3,now()+interval '1 hour')`,
      [randomUUID(), userId, activityId],
    );
    await source.query(
      `INSERT INTO wechat_callback_receipt (request_key,body_hash,response_body,response_content_type) VALUES ('legacy-request','legacy-body','success','text/plain')`,
    );
    const schemaShape = async () => ({
      columns: await source.query(
        `SELECT table_name,column_name,data_type,character_maximum_length,is_nullable,column_default FROM information_schema.columns WHERE table_schema=current_schema() AND table_name IN ('wechat_activity_entry_token','wechat_callback_receipt') ORDER BY table_name,ordinal_position`,
      ),
      constraints: await source.query(
        `SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND conrelid::regclass::text IN ('wechat_activity_entry_token','wechat_callback_receipt') ORDER BY conname`,
      ),
      indexes: await source.query(
        `SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=current_schema() AND tablename IN ('wechat_activity_entry_token','wechat_callback_receipt') ORDER BY indexname`,
      ),
    });
    const originalSchema = await schemaShape();
    expect(await source.showMigrations()).toBe(true);
    await source.runMigrations();
    const tables = (
      await source.query<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema()`,
      )
    ).map((row) => row.table_name);
    expect(tables).not.toContain('wechat_activity_entry_token');
    expect(tables).not.toContain('wechat_callback_receipt');
    expect(tables).toContain('wechat_identity');
    expect(tables).toContain('app_session');
    await expect(
      new MaintenanceService(source, 60_000).runOnce(),
    ).resolves.toBeUndefined();
    expect(
      await source.query(
        `SELECT user_id FROM wechat_identity WHERE openid='retained-openid'`,
      ),
    ).toEqual([{ user_id: userId }]);
    expect(
      await source.query(
        `SELECT user_id FROM app_session WHERE session_hash='retained-session'`,
      ),
    ).toEqual([{ user_id: userId }]);
    expect(
      await source.query(
        `SELECT name FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 1`,
      ),
    ).toEqual([{ name: 'DropWechatEventActivityEntry1788739210000' }]);
    await source.undoLastMigration();
    expect(await schemaShape()).toEqual(originalSchema);
    await source.runMigrations();
    expect(await source.showMigrations()).toBe(false);
  } finally {
    await database.close();
  }
});
