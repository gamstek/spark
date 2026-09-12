import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { expect, it } from 'vitest';
import type { ActivityFormSubmissionInput } from '@spark/contracts';
import { MigrationExecutor } from 'typeorm';

import { ActivityFormService } from '../src/activity-form/activity-form.service.js';
import { ExportsService } from '../src/exports/exports.service.js';
import { JobsService } from '../src/jobs/jobs.service.js';
import { MaintenanceService } from '../src/maintenance/maintenance.service.js';
import { createTestDatabase } from './support/database.js';
import { createScenario } from './support/fixtures.js';

const execFileAsync = promisify(execFile);

const validForm: ActivityFormSubmissionInput = {
  name: '迁移后报名用户',
  organization: '星火科技',
  department: '研发部',
  jobTitle: '研究员',
  phone: '13800138000',
  email: 'migrated@example.com',
  researchAreas: ['life_sciences'],
  instrumentInterests: ['mass_spectrometry'],
  visitPurposes: ['new_products'],
  followUpPreferences: ['product_pdf'],
  contactPreference: 'call_welcome',
  onsiteAvailability: 'available',
  privacyAccepted: true,
};

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
    await source.transaction(async (manager) => {
      const executor = new MigrationExecutor(source, manager.queryRunner);
      const [dropMigration] = await executor.getPendingMigrations();
      expect(dropMigration?.name).toBe(
        'DropWechatEventActivityEntry1788739210000',
      );
      await executor.executeMigration(dropMigration!);
    });
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

it('upgrades legacy form storage without losing unrelated activity data', async () => {
  const database = await createTestDatabase({
    throughMigration: 'DropWechatEventActivityEntry1788739210000',
  });
  const source = database.dataSource;
  try {
    const scenario = await createScenario(source);
    const adoptedSubmissionId = randomUUID();
    await source.query(
      `INSERT INTO dingtalk_form_submission (id,form_id,record_id,participation_id,fields,submitted_at)
       VALUES ($1,'legacy-form','legacy-record',$2,$3,$4)`,
      [
        adoptedSubmissionId,
        scenario.participationIds[0],
        { name: '旧报名答案' },
        scenario.now,
      ],
    );
    await source.query(
      `UPDATE activity_participation SET adopted_submission_id=$1 WHERE id=$2`,
      [adoptedSubmissionId, scenario.participationIds[0]],
    );
    await source.query(
      `INSERT INTO webhook_receipt (id,form_id,record_id,participation_id,payload)
       VALUES ($1,'legacy-form','callback-record',$2,$3)`,
      [randomUUID(), scenario.participationIds[0], { callback: 'legacy' }],
    );
    await source.query(
      `UPDATE activity_version
       SET config=$1
       WHERE id=(SELECT published_version_id FROM activity WHERE id=$2)`,
      [
        {
          requireSubscribe: false,
          noPrizeWeight: 0.1,
          heroAssetId: null,
          rulesText: '保留的活动规则',
          formId: 'legacy-form',
          formUrl: 'https://legacy.example/form',
          prefillField: 'name',
          fieldMapping: { name: '姓名' },
        },
        scenario.activityId,
      ],
    );

    expect(await source.showMigrations()).toBe(true);
    await source.runMigrations();

    const tableNames = (
      await source.query<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema()`,
      )
    ).map((row) => row.table_name);
    expect(tableNames).toContain('activity_form_submission');
    expect(tableNames).not.toContain('dingtalk_form_submission');
    expect(tableNames).not.toContain('webhook_receipt');

    expect(
      await source.query(`SELECT id FROM activity WHERE id=$1`, [
        scenario.activityId,
      ]),
    ).toEqual([{ id: scenario.activityId }]);
    expect(
      await source.query(`SELECT id FROM activity_participation WHERE id=$1`, [
        scenario.participationIds[0],
      ]),
    ).toEqual([{ id: scenario.participationIds[0] }]);
    expect(
      await source.query(
        `SELECT lead_completed,lead_completed_at FROM activity_participation WHERE id=$1`,
        [scenario.participationIds[0]],
      ),
    ).toEqual([{ lead_completed: false, lead_completed_at: null }]);
    expect(
      await source.query(
        `SELECT lead_completed FROM activity_participation WHERE id=$1`,
        [scenario.participationIds[1]],
      ),
    ).toEqual([{ lead_completed: true }]);
    expect(
      await source.query<{ config: Record<string, unknown> }[]>(
        `SELECT config FROM activity_version WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
        [scenario.activityId],
      ),
    ).toEqual([
      {
        config: {
          requireSubscribe: false,
          noPrizeWeight: 0.1,
          heroAssetId: null,
          rulesText: '保留的活动规则',
        },
      },
    ]);
    await expect(
      new ActivityFormService(source, () => scenario.now).submit(
        scenario.userIds[0],
        'expo-2026',
        validForm,
      ),
    ).resolves.toEqual({ submitted: true });
    expect(
      await source.query(
        `SELECT id FROM activity_form_submission WHERE participation_id=$1`,
        [scenario.participationIds[0]],
      ),
    ).toHaveLength(1);
    expect(
      await source.query(
        `SELECT name FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 1`,
      ),
    ).toEqual([{ name: 'ReplaceDingTalkFormStorage1788739211000' }]);
  } finally {
    await database.close();
  }
});
