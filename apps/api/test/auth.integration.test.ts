import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AccountsService, hashPassword } from '../src/auth/accounts.service.js';
import { AdminAuthController } from '../src/auth/auth.controller.js';
import { validateCsrf } from '../src/auth/csrf.guard.js';
import { SessionService } from '../src/auth/session.service.js';
import { StaffService } from '../src/staff/staff.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

describe('administrator and staff authentication', () => {
  let database: TestDatabase;
  let scenario: Scenario;
  let accounts: AccountsService;
  let sessions: SessionService;

  beforeAll(async () => {
    database = await createTestDatabase();
    scenario = await createScenario(database.dataSource, { accountPassword: 'Correct Horse Battery 42' });
    accounts = new AccountsService(database.dataSource);
    sessions = new SessionService(database.dataSource, 'test-csrf-secret');
  });

  afterAll(async () => database.close());

  it('rejects cross-role login and a wrong password', async () => {
    await expect(accounts.authenticate('ADMIN', 'staff-fixture', 'Correct Horse Battery 42')).resolves.toBeNull();
    await expect(accounts.authenticate('STAFF', 'staff-fixture', 'wrong-password')).resolves.toBeNull();
  });

  it('stores opaque hashes and resolves only the requested role', async () => {
    const created = await sessions.create('ADMIN', scenario.adminId);
    const stored = await database.dataSource.query<{ session_hash: string }[]>(`SELECT session_hash FROM app_session WHERE admin_account_id=$1`, [scenario.adminId]);
    expect(stored[0]?.session_hash).not.toBe(created.token);
    await expect(sessions.resolve(created.token, 'ADMIN')).resolves.toMatchObject({ subjectId: scenario.adminId, role: 'ADMIN' });
    await expect(sessions.resolve(created.token, 'STAFF')).resolves.toBeNull();
  });

  it('creates new tokens and revokes all sessions when an account is disabled', async () => {
    const first = await sessions.create('STAFF', scenario.staffId);
    const second = await sessions.create('STAFF', scenario.staffId);
    expect(second.token).not.toBe(first.token);
    await accounts.disable('STAFF', scenario.staffId, scenario.adminId);
    await sessions.revokeAccount('STAFF', scenario.staffId);
    await expect(sessions.resolve(first.token, 'STAFF')).resolves.toBeNull();
    await expect(sessions.resolve(second.token, 'STAFF')).resolves.toBeNull();
  });

  it('rejects an expired session', async () => {
    const session = await sessions.create('ADMIN', scenario.adminId);
    await database.dataSource.query(`UPDATE app_session SET expires_at=now() - interval '1 second' WHERE admin_account_id=$1`, [scenario.adminId]);
    await expect(sessions.resolve(session.token, 'ADMIN')).resolves.toBeNull();
  });

  it('rejects missing CSRF and forged origins', async () => {
    const session = await sessions.create('ADMIN', scenario.adminId);
    expect(() => validateCsrf({ origin: 'https://spark.example.com', expectedOrigin: 'https://spark.example.com', suppliedToken: undefined, sessionToken: session.token, secret: 'test-csrf-secret' })).toThrow('CSRF_INVALID');
    expect(() => validateCsrf({ origin: 'https://evil.example', expectedOrigin: 'https://spark.example.com', suppliedToken: session.csrfToken, sessionToken: session.token, secret: 'test-csrf-secret' })).toThrow('ORIGIN_INVALID');
    expect(() => validateCsrf({ origin: 'https://spark.example.com', expectedOrigin: 'https://spark.example.com', suppliedToken: session.csrfToken, sessionToken: session.token, secret: 'test-csrf-secret' })).not.toThrow();
  });

  it('keeps staff activity authorization separate from login', async () => {
    const staff = new StaffService(database.dataSource);
    await expect(staff.hasActivityPermission(scenario.staffId, scenario.activityId)).resolves.toBe(true);
    await expect(staff.hasActivityPermission(scenario.staffId, randomUUID())).resolves.toBe(false);
  });

  it('uses salted password hashes', async () => {
    const first = await hashPassword('same password');
    const second = await hashPassword('same password');
    expect(first).not.toBe(second);
  });

  it('sets a production host-only cookie without returning secrets, rotates login, and logs out', async () => {
    const controller = new AdminAuthController(accounts, sessions);
    const headers = new Map<string, string>();
    const reply = { header(name: string, value: string) { headers.set(name, value); return this; } };
    const previousEnvironment = process.env.NODE_ENV;
    const previousOrigin = process.env.PUBLIC_ORIGIN;
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_ORIGIN = 'https://spark.example.com';
    try {
      const firstBody = await controller.loginRoute(
        { username: 'admin-fixture', password: 'Correct Horse Battery 42' },
        { headers: { origin: 'https://spark.example.com' } } as never, reply as never,
      );
      expect(firstBody).not.toHaveProperty('token');
      expect(firstBody).not.toHaveProperty('csrfToken');
      const firstCookie = headers.get('Set-Cookie') ?? '';
      expect(firstCookie).toContain('HttpOnly');
      expect(firstCookie).toContain('Secure');
      expect(firstCookie).toContain('SameSite=Lax');
      expect(firstCookie).not.toContain('Domain=');
      const firstToken = firstCookie.match(/^spark_admin=([^;]+)/)?.[1] ?? '';

      await controller.loginRoute(
        { username: 'admin-fixture', password: 'Correct Horse Battery 42' },
        { headers: { origin: 'https://spark.example.com', cookie: `spark_admin=${firstToken}` } } as never, reply as never,
      );
      await expect(sessions.resolve(firstToken, 'ADMIN')).resolves.toBeNull();
      const secondToken = headers.get('Set-Cookie')?.match(/^spark_admin=([^;]+)/)?.[1] ?? '';
      await controller.logoutRoute({ sessionToken: secondToken } as never, reply as never);
      await expect(sessions.resolve(secondToken, 'ADMIN')).resolves.toBeNull();
      expect(headers.get('Set-Cookie')).toContain('Max-Age=0');
    } finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
      if (previousOrigin === undefined) delete process.env.PUBLIC_ORIGIN;
      else process.env.PUBLIC_ORIGIN = previousOrigin;
    }
  });
});
