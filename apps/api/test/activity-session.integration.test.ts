import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

import { AppSession, UserAccount } from '../database/entities/index.js';
import { ActivitySessionController } from '../src/auth/activity-session.controller.js';
import { SessionService } from '../src/auth/session.service.js';
import { OAuthStateService } from '../src/wechat/oauth-state.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario } from './support/fixtures.js';

describe('anonymous session persistence', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
    await createScenario(database.dataSource);
  });
  afterAll(async () => database.close());

  it('rolls back the anonymous user when session persistence fails', async () => {
    const dataSource = database.dataSource;
    const usersBefore = await dataSource.getRepository(UserAccount).count();
    const sessionsBefore = await dataSource.getRepository(AppSession).count();
    const controller = new ActivitySessionController(
      dataSource,
      new SessionService(dataSource, 'test-csrf-secret'),
      new OAuthStateService(dataSource, 'test-oauth-secret'),
      'anonymous',
    );
    const reply = { header: vi.fn().mockReturnThis(), send: vi.fn() };
    await dataSource.query(
      `ALTER TABLE app_session ADD CONSTRAINT reject_anonymous_session CHECK (role <> 'ACTIVITY')`,
    );
    try {
      await expect(
        controller.create(
          'expo-2026',
          undefined,
          { id: 'rollback-test' } as never,
          reply as never,
        ),
      ).rejects.toThrow('reject_anonymous_session');
      expect(await dataSource.getRepository(UserAccount).count()).toBe(
        usersBefore,
      );
      expect(await dataSource.getRepository(AppSession).count()).toBe(
        sessionsBefore,
      );
      expect(reply.header).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    } finally {
      await dataSource.query(
        `ALTER TABLE app_session DROP CONSTRAINT reject_anonymous_session`,
      );
    }
  });

  it('commits a usable session and its anonymous user together', async () => {
    const dataSource = database.dataSource;
    const usersBefore = await dataSource.getRepository(UserAccount).count();
    const sessionsBefore = await dataSource.getRepository(AppSession).count();
    const sessions = new SessionService(dataSource, 'test-csrf-secret');
    const controller = new ActivitySessionController(
      dataSource,
      sessions,
      new OAuthStateService(dataSource, 'test-oauth-secret'),
      'anonymous',
    );
    const reply = {
      header: vi.fn().mockReturnThis(),
      send: vi.fn((value: unknown) => value),
    };
    await expect(
      controller.create(
        'expo-2026',
        undefined,
        { id: 'commit-test' } as never,
        reply as never,
      ),
    ).resolves.toEqual({ authenticated: true });
    const cookie = reply.header.mock.calls[0]?.[1] as string;
    const token = cookie.match(/^spark_activity=([^;]+)/)?.[1];
    expect(token).toBeDefined();
    const session = await sessions.resolve(token!, 'ACTIVITY');
    expect(session?.role).toBe('ACTIVITY');
    expect(
      await dataSource
        .getRepository(UserAccount)
        .findOneByOrFail({ id: session!.subjectId }),
    ).toBeDefined();
    expect(await dataSource.getRepository(UserAccount).count()).toBe(
      usersBefore + 1,
    );
    expect(await dataSource.getRepository(AppSession).count()).toBe(
      sessionsBefore + 1,
    );
    expect(
      await dataSource.query('SELECT 1 FROM wechat_identity WHERE user_id=$1', [
        session!.subjectId,
      ]),
    ).toEqual([]);
  });
});
