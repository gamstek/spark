import 'reflect-metadata';
import { createHash } from 'node:crypto';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionService } from '../src/auth/session.service.js';
import { createHttpAdapter } from '../src/http-adapter.js';
import { MaintenanceService } from '../src/maintenance/maintenance.service.js';
import { ActivityEntryController } from '../src/wechat/activity-entry.controller.js';
import { WechatActivityEntryService } from '../src/wechat/activity-entry.service.js';
import { WechatCallbackController } from '../src/wechat/callback.controller.js';
import { WechatCallbackReplayService } from '../src/wechat/callback-replay.service.js';
import { WechatIdentityService } from '../src/wechat/wechat-identity.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createTimedPublishedActivity } from './support/fixtures.js';

const initialTime = new Date('2026-09-11T04:00:00.000Z');
const openid = 'entry-private-openid';
function entryToken(body: string): string {
  const url = body.match(
    /https:\/\/spark\.example\/api\/activity\/entry\?t=([A-Za-z0-9_-]+)/,
  );
  expect(url, 'callback must return an entry URL').not.toBeNull();
  return url![1]!;
}

describe('WeChat callback to activity session with PostgreSQL', () => {
  let database: TestDatabase;
  let app: NestFastifyApplication;
  let entries: WechatActivityEntryService;
  let sessions: SessionService;
  let now: Date;

  beforeEach(async () => {
    vi.stubEnv('WECHAT_CALLBACK_TOKEN', 'entry-callback-secret');
    vi.setSystemTime(initialTime);
    database = await createTestDatabase();
    now = new Date(initialTime);
    const identities = new WechatIdentityService(
      database.dataSource,
      'wx-entry-app',
    );
    sessions = new SessionService(database.dataSource, 'entry-csrf-secret');
    entries = new WechatActivityEntryService(
      database.dataSource,
      identities,
      sessions,
      'https://spark.example',
      () => now,
    );
    class EntryTestModule {}
    Module({
      controllers: [WechatCallbackController, ActivityEntryController],
      providers: [
        { provide: WechatActivityEntryService, useValue: entries },
        { provide: WechatIdentityService, useValue: identities },
        {
          provide: WechatCallbackReplayService,
          useValue: new WechatCallbackReplayService(database.dataSource),
        },
      ],
    })(EntryTestModule);
    app = await NestFactory.create<NestFastifyApplication>(
      EntryTestModule,
      createHttpAdapter(),
      { logger: false, abortOnError: false },
    );
    app.setGlobalPrefix('api');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app?.close();
    await database?.close();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  function publish(
    code = 'entry-expo',
    startsAt = initialTime,
    endsAt = new Date(initialTime.getTime() + 3_600_000),
  ) {
    return createTimedPublishedActivity(database.dataSource, {
      code,
      startsAt,
      endsAt,
    });
  }

  function callback(
    event = 'subscribe',
    eventKey = '',
    createTime = Math.floor(initialTime.getTime() / 1000),
    nonce = `entry-nonce-${createTime}-${event}-${eventKey}`,
  ) {
    const timestamp = String(createTime);
    const signature = createHash('sha1')
      .update(['entry-callback-secret', timestamp, nonce].sort().join(''))
      .digest('hex');
    return app.inject({
      method: 'POST',
      url: `/api/wechat/callback?${new URLSearchParams({ timestamp, nonce, signature })}`,
      headers: { 'content-type': 'text/xml' },
      payload: `<xml><ToUserName><![CDATA[official-account]]></ToUserName><FromUserName><![CDATA[${openid}]]></FromUserName><CreateTime>${createTime}</CreateTime><MsgType>event</MsgType><Event>${event}</Event><EventKey>${eventKey}</EventKey></xml>`,
    });
  }

  function storedTokens() {
    return database.dataSource.query<
      {
        token_hash: string;
        user_id: string;
        activity_id: string;
        consumed_at: Date | null;
        expires_at: Date;
      }[]
    >('SELECT * FROM wechat_activity_entry_token');
  }

  it('issues a signed subscribe entry with one subscribed identity and only a token hash persisted', async () => {
    const { activityId } = await publish();
    const response = await callback();
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/xml');
    const token = entryToken(response.body);
    const users = await database.dataSource.query<{ id: string }[]>(
      'SELECT id FROM user_account',
    );
    const identities = await database.dataSource.query(
      'SELECT * FROM wechat_identity',
    );
    const tokens = await storedTokens();
    expect(users).toHaveLength(1);
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({
      user_id: users[0]!.id,
      app_id: 'wx-entry-app',
      openid,
      subscribed: true,
    });
    expect(identities[0].subscription_checked_at).toBeInstanceOf(Date);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      user_id: users[0]!.id,
      activity_id: activityId,
      consumed_at: null,
    });
    expect(tokens[0]!.token_hash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(tokens[0]!.token_hash).not.toContain(openid);
    expect(tokens[0]!.token_hash).not.toContain(token);
    expect(tokens[0]!.expires_at).toEqual(
      new Date(initialTime.getTime() + 600_000),
    );
  });

  it('returns the same response and side effects for simultaneous exact provider retries', async () => {
    await publish();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => callback()),
    );
    const tokens = responses.map((response) => {
      expect(response.statusCode).toBe(200);
      return entryToken(response.body);
    });
    expect(new Set(tokens).size).toBe(1);
    expect(
      await database.dataSource.query('SELECT id FROM user_account'),
    ).toHaveLength(1);
    const identities = await database.dataSource.query(
      'SELECT user_id, subscribed FROM wechat_identity',
    );
    expect(identities).toHaveLength(1);
    expect(identities[0].subscribed).toBe(true);
    const stored = await storedTokens();
    expect(stored).toHaveLength(1);
    expect(stored.every((row) => row.user_id === identities[0].user_id)).toBe(
      true,
    );
  });

  it('rejects a different body replayed with a captured signed timestamp and nonce', async () => {
    await publish();
    expect(
      (await callback('subscribe', '', undefined, 'captured-nonce')).statusCode,
    ).toBe(200);
    const replay = await callback(
      'unsubscribe',
      '',
      undefined,
      'captured-nonce',
    );
    expect(replay.statusCode).toBe(403);
    expect(
      await database.dataSource.query('SELECT subscribed FROM wechat_identity'),
    ).toEqual([{ subscribed: true }]);
  });

  it('returns success before the provider deadline and rolls back stalled callback work', async () => {
    const replays = new WechatCallbackReplayService(database.dataSource, 50);
    const startedAt = performance.now();
    const response = await replays.execute(
      {
        method: 'POST',
        timestamp: '1789099200',
        nonce: 'stalled',
        body: '<xml>stalled</xml>',
      },
      async (manager) => {
        await manager.query(`SELECT pg_sleep(0.2)`);
        await manager.query(`INSERT INTO user_account (id) VALUES ($1)`, [
          '00000000-0000-4000-8000-000000000001',
        ]);
        return {
          body: '<xml>late</xml>',
          contentType: 'text/xml; charset=utf-8',
        };
      },
    );
    expect(performance.now() - startedAt).toBeLessThan(150);
    expect(response).toEqual({
      body: 'success',
      contentType: 'text/plain; charset=utf-8',
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(
      await database.dataSource.query(
        `SELECT request_key FROM wechat_callback_receipt`,
      ),
    ).toHaveLength(0);
    expect(
      await database.dataSource.query(
        `SELECT id FROM user_account WHERE id=$1`,
        ['00000000-0000-4000-8000-000000000001'],
      ),
    ).toHaveLength(0);
  });

  it('issues an entry for CLICK/LOTTERY and ignores other menu keys', async () => {
    const { activityId } = await publish();
    const ignored = await callback('CLICK', 'OTHER');
    expect(ignored.body).toBe('success');
    expect(await storedTokens()).toHaveLength(0);
    expect(
      await database.dataSource.query('SELECT id FROM user_account'),
    ).toHaveLength(0);
    const response = await callback('CLICK', 'LOTTERY');
    const token = entryToken(response.body);
    expect(await storedTokens()).toEqual([
      expect.objectContaining({
        activity_id: activityId,
        token_hash: createHash('sha256').update(token).digest('hex'),
      }),
    ]);
    expect(
      await database.dataSource.query('SELECT subscribed FROM wechat_identity'),
    ).toEqual([{ subscribed: true }]);
  });

  it('marks an existing identity unsubscribed without creating another token or user', async () => {
    await publish();
    entryToken((await callback()).body);
    const before = await storedTokens();
    const response = await callback(
      'unsubscribe',
      '',
      Math.floor(initialTime.getTime() / 1000) + 1,
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toBe('success');
    expect(await storedTokens()).toEqual(before);
    expect(
      await database.dataSource.query('SELECT id FROM user_account'),
    ).toHaveLength(1);
    expect(
      await database.dataSource.query('SELECT subscribed FROM wechat_identity'),
    ).toEqual([{ subscribed: false }]);
  });

  it('does not let a delayed subscribe overwrite a newer unsubscribe state', async () => {
    await publish();
    const base = Math.floor(initialTime.getTime() / 1000);
    await callback('subscribe', '', base, 'subscribe-initial');
    await callback('unsubscribe', '', base + 2, 'unsubscribe-newer');
    const delayed = await callback(
      'subscribe',
      '',
      base + 1,
      'subscribe-stale',
    );
    expect(delayed.body).toBe('success');
    expect(
      await database.dataSource.query(
        'SELECT subscribed,subscription_checked_at FROM wechat_identity',
      ),
    ).toEqual([
      {
        subscribed: false,
        subscription_checked_at: new Date((base + 2) * 1000),
      },
    ]);
    expect(await storedTokens()).toHaveLength(1);
  });

  it('preserves a newer unsubscribe that arrives before the delayed subscribe', async () => {
    await publish();
    const base = Math.floor(initialTime.getTime() / 1000);
    await callback('unsubscribe', '', base + 2, 'unsubscribe-first');
    const delayed = await callback(
      'subscribe',
      '',
      base + 1,
      'subscribe-delayed',
    );
    expect(delayed.body).toBe('success');
    expect(
      await database.dataSource.query(
        'SELECT subscribed,subscription_checked_at FROM wechat_identity',
      ),
    ).toEqual([
      {
        subscribed: false,
        subscription_checked_at: new Date((base + 2) * 1000),
      },
    ]);
    expect(await storedTokens()).toHaveLength(0);
  });

  it.each(['none', 'future', 'ended'] as const)(
    'creates no token when there is no active activity: %s',
    async (kind) => {
      if (kind === 'future')
        await publish(
          'future',
          new Date(initialTime.getTime() + 1),
          new Date(initialTime.getTime() + 3_600_000),
        );
      if (kind === 'ended')
        await publish(
          'ended',
          new Date(initialTime.getTime() - 3_600_000),
          initialTime,
        );
      const response = await callback();
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('当前暂无可参与的活动');
      expect(response.body).not.toContain('/api/activity/entry');
      expect(await storedTokens()).toHaveLength(0);
      expect(
        await database.dataSource.query(
          'SELECT subscribed FROM wechat_identity',
        ),
      ).toEqual([{ subscribed: true }]);
    },
  );

  it('creates no token when two published activities are active', async () => {
    await publish('first');
    await publish('second');
    const response = await callback();
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('活动配置异常');
    expect(response.body).not.toContain('/api/activity/entry');
    expect(await storedTokens()).toHaveLength(0);
  });

  it('selects the active published activity among future and ended versions', async () => {
    await publish(
      'future',
      new Date(initialTime.getTime() + 1),
      new Date(initialTime.getTime() + 3_600_000),
    );
    await publish(
      'ended',
      new Date(initialTime.getTime() - 3_600_000),
      initialTime,
    );
    const { activityId } = await publish();
    entryToken((await callback()).body);
    expect(await storedTokens()).toEqual([
      expect.objectContaining({ activity_id: activityId }),
    ]);
  });

  it('exchanges the issued HTTP link into a persisted ACTIVITY session and rejects replay', async () => {
    await publish();
    const token = entryToken(
      (await callback('subscribe', '', undefined, 'second-entry')).body,
    );
    const response = await app.inject({
      method: 'GET',
      url: `/api/activity/entry?t=${token}`,
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/activity/entry-expo');
    const cookie = response.headers['set-cookie'];
    expect(typeof cookie).toBe('string');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    const sessionToken = (cookie as string).match(
      /^spark_activity=([^;]+)/,
    )?.[1];
    expect(sessionToken).toBeTruthy();
    const stored = await storedTokens();
    expect(stored[0]!.consumed_at).toEqual(initialTime);
    const storedSessions = await database.dataSource.query(
      'SELECT role, user_id, session_hash FROM app_session',
    );
    expect(storedSessions).toEqual([
      {
        role: 'ACTIVITY',
        user_id: stored[0]!.user_id,
        session_hash: createHash('sha256').update(sessionToken!).digest('hex'),
      },
    ]);
    await expect(
      sessions.resolve(sessionToken!, 'ACTIVITY'),
    ).resolves.toMatchObject({
      subjectId: stored[0]!.user_id,
      role: 'ACTIVITY',
    });
    await expect(entries.exchange(token)).resolves.toEqual({
      status: 'invalid',
      activityCode: 'entry-expo',
    });
    const replay = await app.inject({
      method: 'GET',
      url: `/api/activity/entry?t=${token}`,
    });
    expect(replay.statusCode).toBe(302);
    expect(replay.headers.location).toBe(
      '/activity/entry-expo?entryError=invalid',
    );
    expect(replay.headers['set-cookie']).toBeUndefined();
    expect(
      await database.dataSource.query(
        'SELECT role, user_id, session_hash FROM app_session',
      ),
    ).toEqual(storedSessions);
  });

  it('allows exactly one simultaneous exchange and persists only one new session', async () => {
    await publish();
    const firstToken = entryToken((await callback()).body);
    await expect(entries.exchange(firstToken)).resolves.toMatchObject({
      status: 'exchanged',
    });
    const before = await database.dataSource.query(
      'SELECT id FROM app_session',
    );
    const token = entryToken(
      (await callback('subscribe', '', undefined, 'parallel-entry')).body,
    );
    const results = await Promise.all([
      entries.exchange(token),
      entries.exchange(token),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      'exchanged',
      'invalid',
    ]);
    expect(
      results.every((result) => result.activityCode === 'entry-expo'),
    ).toBe(true);
    const storedSessions = await database.dataSource.query(
      'SELECT id, role, user_id FROM app_session',
    );
    expect(storedSessions).toHaveLength(before.length + 1);
    const tokens = await storedTokens();
    expect(tokens).toHaveLength(2);
    expect(
      tokens.every(
        (row) => row.consumed_at?.getTime() === initialTime.getTime(),
      ),
    ).toBe(true);
    const winner = results.find((result) => result.status === 'exchanged');
    expect(winner).toBeDefined();
    await expect(
      sessions.resolve(winner!.sessionToken, 'ACTIVITY'),
    ).resolves.toMatchObject({
      subjectId: tokens[0]!.user_id,
      role: 'ACTIVITY',
    });
  });

  it('rejects a token at its expiry boundary without consumption or session creation', async () => {
    await publish();
    const token = entryToken((await callback()).body);
    now = new Date(initialTime.getTime() + 600_000);
    await expect(entries.exchange(token)).resolves.toEqual({
      status: 'invalid',
      activityCode: 'entry-expo',
    });
    expect((await storedTokens())[0]!.consumed_at).toBeNull();
    expect(
      await database.dataSource.query('SELECT id FROM app_session'),
    ).toHaveLength(0);
  });

  it('rejects an unknown token without creating a session or revealing an activity', async () => {
    await publish();
    await expect(entries.exchange('unknown-token')).resolves.toEqual({
      status: 'invalid',
      activityCode: null,
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/activity/entry?t=unknown-token',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/activity/entry-error');
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await storedTokens()).toHaveLength(0);
    expect(
      await database.dataSource.query('SELECT id FROM app_session'),
    ).toHaveLength(0);
  });

  it('cleans expired and old consumed entries while preserving usable entries and active sessions', async () => {
    await publish();
    const hashes: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const token = entryToken(
        (await callback('subscribe', '', undefined, `cleanup-${index}`)).body,
      );
      hashes.push(createHash('sha256').update(token).digest('hex'));
    }
    const [expiredHash, oldConsumedHash, usableHash, recentConsumedHash] =
      hashes;
    await database.dataSource.query(
      `UPDATE wechat_activity_entry_token
       SET expires_at=CASE WHEN token_hash=$1 THEN now()-interval '1 second'
                           ELSE now()+interval '10 minutes' END,
           consumed_at=CASE WHEN token_hash=$2 THEN now()-interval '2 days'
                            WHEN token_hash=$3 THEN now()-interval '1 minute'
                            ELSE NULL END`,
      [expiredHash, oldConsumedHash, recentConsumedHash],
    );
    const userId = (await storedTokens())[0]!.user_id;
    const session = await sessions.create('ACTIVITY', userId);
    const beforeSessions = await database.dataSource.query(
      'SELECT id, session_hash, expires_at FROM app_session',
    );

    await new MaintenanceService(database.dataSource, 60_000).runOnce();

    expect((await storedTokens()).map((row) => row.token_hash).sort()).toEqual(
      [usableHash, recentConsumedHash].sort(),
    );
    expect(
      await database.dataSource.query(
        'SELECT id, session_hash, expires_at FROM app_session',
      ),
    ).toEqual(beforeSessions);
    await expect(
      sessions.resolve(session.token, 'ACTIVITY'),
    ).resolves.toMatchObject({
      role: 'ACTIVITY',
      subjectId: userId,
    });
  });
});
