import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CodeService } from '../src/redemptions/code.service.js';
import { RedemptionsService } from '../src/redemptions/redemptions.service.js';
import { hashPassword } from '../src/auth/accounts.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

describe('redemption recovery and atomic confirmation', () => {
  let database: TestDatabase; let scenario: Scenario; let codes: CodeService; let code: string; let secondStaffId: string;
  beforeAll(async () => {
    database = await createTestDatabase();
    process.env.REDEEM_CODE_ACTIVE_KEY_ID = 'test-key';
    process.env.REDEEM_CODE_KEYS = JSON.stringify({ 'test-key': Buffer.alloc(32, 9).toString('base64') });
    codes = new CodeService();
  });
  beforeEach(async () => {
    await database.dataSource.query(`TRUNCATE TABLE audit_event,export_job,stock_adjustment,channel_visit,redemption,lottery_record,activity_prize,prize,background_job,dingtalk_form_submission,webhook_receipt,activity_participation,staff_activity_permission,activity_version,activity,wechat_identity,user_account,app_session,oauth_state,wechat_credential_cache,staff_account,admin_account,media_asset RESTART IDENTITY CASCADE`);
    scenario = await createScenario(database.dataSource);
    const encrypted = codes.create(); code = codes.restore(encrypted.encryptedCode, encrypted.keyId);
    await database.dataSource.query(`UPDATE lottery_record SET prize_name='一等奖',prize_image_url='/media/prize.png',redeem_end_at=$2 WHERE id=$1`, [scenario.lotteryRecordId, new Date(scenario.now.getTime() + 86_400_000)]);
    await database.dataSource.query(`UPDATE redemption SET redeem_code_hash=$2,encrypted_code=$3,encryption_key_id=$4,redeem_end_at=$5 WHERE lottery_record_id=$1`, [scenario.lotteryRecordId, encrypted.hash, encrypted.encryptedCode, encrypted.keyId, new Date(scenario.now.getTime() + 86_400_000)]);
    secondStaffId = randomUUID();
    await database.dataSource.query(`INSERT INTO staff_account (id,username,password_hash,display_name) VALUES ($1,'staff-two',$2,'工作人员二')`, [secondStaffId, await hashPassword('test-only-password')]);
    await database.dataSource.query(`INSERT INTO staff_activity_permission (staff_account_id,activity_id) VALUES ($1,$2)`, [secondStaffId, scenario.activityId]);
  });
  afterAll(async () => { delete process.env.REDEEM_CODE_ACTIVE_KEY_ID; delete process.env.REDEEM_CODE_KEYS; await database.close(); });

  const service = (now = scenario.now) => new RedemptionsService(database.dataSource, codes, () => now);

  it('restores the same code for its owning user and rejects other users', async () => {
    const first = await service().getOwnCode(scenario.userIds[0], 'expo-2026');
    const second = await service().getOwnCode(scenario.userIds[0], 'expo-2026');
    expect(first).toEqual(second); expect(first.code).toBe(code); expect(first.qrUrl).toContain(encodeURIComponent(code));
    await expect(service().getOwnCode(scenario.userIds[1], 'expo-2026')).rejects.toThrow('PRIZE_CODE_NOT_FOUND');
  });

  it('lookup does not redeem and exposes only a masked identity hint', async () => {
    const result = await service().lookup(code, scenario.staffId);
    expect(result.status).toBe('WAIT_REDEEM'); expect(result.userHint).toMatch(/^用户…[\da-f]{4}$/);
    expect((await database.dataSource.query<{ redeemed_at: Date | null }[]>(`SELECT redeemed_at FROM redemption`))[0]?.redeemed_at).toBeNull();
  });

  it('allows two staff confirmations to create one transition and audit event', async () => {
    const [first, second] = await Promise.all([service().confirm(code, scenario.staffId), service().confirm(code, secondStaffId)]);
    expect(first.status).toBe('REDEEMED'); expect(second.status).toBe('REDEEMED'); expect(first.redeemedAt).toBe(second.redeemedAt);
    expect(await database.dataSource.query(`SELECT id FROM audit_event WHERE action='REDEMPTION_CONFIRMED'`)).toHaveLength(1);
  });

  it('returns the original result when confirmation is retried', async () => {
    const first = await service().confirm(code, scenario.staffId);
    const retry = await service(new Date(scenario.now.getTime() + 172_800_000)).confirm(code, secondStaffId);
    expect(retry).toEqual(first);
  });

  it('rejects missing permissions without revealing the redemption', async () => {
    const unauthorizedStaff = randomUUID();
    await database.dataSource.query(`INSERT INTO staff_account (id,username,password_hash,display_name) VALUES ($1,'no-access',$2,'无权限')`, [unauthorizedStaff, await hashPassword('test-only-password')]);
    await expect(service().lookup(code, unauthorizedStaff)).rejects.toThrow('REDEMPTION_NOT_FOUND');
    await expect(service().confirm(code, unauthorizedStaff)).rejects.toThrow('REDEMPTION_NOT_FOUND');
  });

  it('rejects the exact redemption deadline but preserves existing redeemed results', async () => {
    const deadline = new Date(scenario.now.getTime() + 86_400_000);
    await expect(service(deadline).confirm(code, scenario.staffId)).rejects.toThrow('REDEMPTION_EXPIRED');
    expect((await database.dataSource.query<{ status: string }[]>(`SELECT status FROM redemption`))[0]?.status).toBe('WAIT_REDEEM');
  });

  it('fails closed with a missing or incorrect encryption key', async () => {
    const savedKeys = process.env.REDEEM_CODE_KEYS;
    process.env.REDEEM_CODE_KEYS = JSON.stringify({ 'test-key': Buffer.alloc(32, 8).toString('base64') });
    await expect(service().getOwnCode(scenario.userIds[0], 'expo-2026')).rejects.toThrow();
    process.env.REDEEM_CODE_KEYS = savedKeys;
  });
});
