import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DingTalkCallbackService } from '../src/dingtalk/callback.service.js';
import { DingTalkPrefillService } from '../src/dingtalk/prefill.service.js';
import { DingTalkSubmissionHandler } from '../src/dingtalk/submission.handler.js';
import { JobHandlers } from '../src/jobs/jobs.handlers.js';
import { JobsService } from '../src/jobs/jobs.service.js';
import { JobsWorker } from '../src/jobs/jobs.worker.js';
import { ParticipantsService } from '../src/participants/participants.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

const config = { formId: 'form-test', formUrl: 'https://alidocs.dingtalk.com/notable/share/form/test?participant=', prefillField: 'participant', fieldMapping: { participationId: '参与编号', name: '姓名', phone: '手机号' } };

describe('DingTalk form integration', () => {
  let database: TestDatabase; let scenario: Scenario; let callbacks: DingTalkCallbackService; let handlers: JobHandlers;
  beforeAll(async () => { database = await createTestDatabase(); process.env.DINGTALK_CALLBACK_SECRET = 'test-shared-secret'; });
  beforeEach(async () => {
    await database.dataSource.query(`TRUNCATE TABLE audit_event,export_job,stock_adjustment,channel_visit,redemption,lottery_record,activity_prize,prize,background_job,dingtalk_form_submission,webhook_receipt,activity_participation,staff_activity_permission,activity_version,activity,wechat_identity,user_account,app_session,oauth_state,wechat_credential_cache,staff_account,admin_account,media_asset RESTART IDENTITY CASCADE`);
    scenario = await createScenario(database.dataSource);
    await database.dataSource.query(`UPDATE activity_version SET config=$1 WHERE id=(SELECT published_version_id FROM activity WHERE id=$2)`, [config, scenario.activityId]);
    await database.dataSource.query(`UPDATE activity_participation SET lead_completed=false,lead_completed_at=NULL WHERE activity_id=$1`, [scenario.activityId]);
    handlers = new JobHandlers();
    callbacks = new DingTalkCallbackService(database.dataSource, new JobsService(database.dataSource));
    new DingTalkSubmissionHandler(database.dataSource, handlers).onModuleInit();
  });
  afterAll(async () => { delete process.env.DINGTALK_CALLBACK_SECRET; await database.close(); });

  const input = (recordId = 'record-1', participationId?: string, formId = 'form-test') => ({ formId, recordId, participationId: participationId ?? scenario.participationIds[0], fields: { name: '测试用户', phone: '13800000000' } });

  it('only replaces the configured pre-existing prefill field', async () => {
    const service = new DingTalkPrefillService(database.dataSource, new ParticipantsService(database.dataSource));
    const result = await service.createFormUrl(scenario.userIds[0], 'expo-2026');
    expect(new URL(result.url).searchParams.get('participant')).toBe(scenario.participationIds[0]);
    await database.dataSource.query(`UPDATE activity_version SET config=jsonb_set(config,'{prefillField}',$2::jsonb) WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`, [scenario.activityId, JSON.stringify('unknown')]);
    await expect(service.createFormUrl(scenario.userIds[0], 'expo-2026')).rejects.toThrow('FORM_PREFILL_SAMPLE_INVALID');
  });

  it('rejects invalid secrets, malicious ids and cross-form submissions', async () => {
    await expect(callbacks.accept(input(), 'wrong')).rejects.toThrow('CALLBACK_UNAUTHORIZED');
    await expect(callbacks.accept({ ...input(), participationId: "' OR true --" }, 'test-shared-secret')).rejects.toThrow('CALLBACK_INVALID');
    await expect(callbacks.accept(input('record-x', undefined, 'another-form'), 'test-shared-secret')).rejects.toThrow('FORM_PARTICIPATION_MISMATCH');
    expect((await database.dataSource.query(`SELECT id FROM webhook_receipt`))).toHaveLength(0);
  });

  it('reliably accepts once and does not grant eligibility before the worker runs', async () => {
    await expect(callbacks.accept(input(), 'test-shared-secret')).resolves.toEqual({ accepted: true });
    await expect(callbacks.accept(input(), 'test-shared-secret')).resolves.toEqual({ accepted: true });
    const before = await database.dataSource.query<{ lead_completed: boolean }[]>(`SELECT lead_completed FROM activity_participation WHERE id=$1`, [scenario.participationIds[0]]);
    expect(before[0]?.lead_completed).toBe(false);
    expect(await database.dataSource.query(`SELECT id FROM webhook_receipt`)).toHaveLength(1);
    expect(await database.dataSource.query(`SELECT id FROM background_job`)).toHaveLength(1);
  });

  it('returns conflict when a record id is replayed for another participant', async () => {
    await callbacks.accept(input(), 'test-shared-secret');
    await expect(callbacks.accept(input('record-1', scenario.participationIds[1]), 'test-shared-secret')).rejects.toThrow('RECORD_PARTICIPATION_CONFLICT');
  });

  it('processes submissions once, retains later records and adopts the earliest lead', async () => {
    await callbacks.accept(input('record-1'), 'test-shared-secret');
    await callbacks.accept(input('record-2'), 'test-shared-secret');
    const worker = new JobsWorker(database.dataSource, 'dingtalk-test', handlers);
    await worker.runDueJobs(new Date());
    await worker.runDueJobs(new Date());
    const submissions = await database.dataSource.query<{ record_id: string }[]>(`SELECT record_id FROM dingtalk_form_submission ORDER BY submitted_at,record_id`);
    const participation = await database.dataSource.query<{ lead_completed_at: Date | null; adopted_submission_id: string | null }[]>(`SELECT lead_completed_at,adopted_submission_id FROM activity_participation WHERE id=$1`, [scenario.participationIds[0]]);
    expect(submissions.map((row) => row.record_id)).toEqual(['record-1', 'record-2']);
    expect(participation[0]?.lead_completed_at).not.toBeNull();
    expect(participation[0]?.adopted_submission_id).not.toBeNull();
    expect(await database.dataSource.query(`SELECT id FROM lottery_record WHERE activity_id=$1 AND user_id=$2`, [scenario.activityId, scenario.userIds[1]])).toHaveLength(0);
  });

  it('can be resent after persistence failure and still records leads after the activity ends', async () => {
    const original = database.dataSource.transaction.bind(database.dataSource);
    let fail = true;
    database.dataSource.transaction = ((...args: unknown[]) => fail ? (fail = false, Promise.reject(new Error('database unavailable'))) : original(...args as Parameters<typeof original>)) as typeof database.dataSource.transaction;
    await expect(callbacks.accept(input(), 'test-shared-secret')).rejects.toThrow('CALLBACK_NOT_PERSISTED');
    await callbacks.accept(input(), 'test-shared-secret');
    database.dataSource.transaction = original;
    await database.dataSource.query(`UPDATE activity_version SET starts_at=$2,draw_ends_at=$3,ends_at=$4,redeem_ends_at=$4 WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`, [scenario.activityId, new Date('2026-09-05T00:00:00Z'), new Date('2026-09-05T12:00:00Z'), new Date('2026-09-06T00:00:00Z')]);
    await new JobsWorker(database.dataSource, 'ended-test', handlers).runDueJobs(new Date());
    const row = await database.dataSource.query<{ lead_completed: boolean }[]>(`SELECT lead_completed FROM activity_participation WHERE id=$1`, [scenario.participationIds[0]]);
    expect(row[0]?.lead_completed).toBe(true);
  });
});
