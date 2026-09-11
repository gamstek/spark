import 'reflect-metadata';
import { createHash } from 'node:crypto';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionService } from '../src/auth/session.service.js';
import { createHttpAdapter } from '../src/http-adapter.js';
import { ActivityEntryController } from '../src/wechat/activity-entry.controller.js';
import { WechatActivityEntryService } from '../src/wechat/activity-entry.service.js';
import { WechatCallbackController } from '../src/wechat/callback.controller.js';
import { WechatIdentityService } from '../src/wechat/wechat-identity.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createTimedPublishedActivity } from './support/fixtures.js';

const initialTime = new Date('2026-09-11T04:00:00.000Z');
const openid = 'entry-private-openid';
const signedQuery = new URLSearchParams({
  timestamp: '1789099200',
  nonce: 'entry-nonce',
  signature: createHash('sha1')
    .update('1789099200entry-callback-secretentry-nonce')
    .digest('hex'),
}).toString();

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

  function callback(event = 'subscribe', eventKey = '') {
    return app.inject({
      method: 'POST',
      url: `/api/wechat/callback?${signedQuery}`,
      headers: { 'content-type': 'text/xml' },
      payload: `<xml><ToUserName><![CDATA[official-account]]></ToUserName><FromUserName><![CDATA[${openid}]]></FromUserName><CreateTime>1789099200</CreateTime><MsgType>event</MsgType><Event>${event}</Event><EventKey>${eventKey}</EventKey></xml>`,
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

  it('keeps one user and identity across simultaneous repeated subscribe callbacks', async () => {
    await publish();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => callback()),
    );
    const tokens = responses.map((response) => {
      expect(response.statusCode).toBe(200);
      return entryToken(response.body);
    });
    expect(new Set(tokens).size).toBe(4);
    expect(
      await database.dataSource.query('SELECT id FROM user_account'),
    ).toHaveLength(1);
    const identities = await database.dataSource.query(
      'SELECT user_id, subscribed FROM wechat_identity',
    );
    expect(identities).toHaveLength(1);
    expect(identities[0].subscribed).toBe(true);
    const stored = await storedTokens();
    expect(stored).toHaveLength(4);
    expect(stored.every((row) => row.user_id === identities[0].user_id)).toBe(
      true,
    );
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
    const response = await callback('unsubscribe');
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
    const token = entryToken((await callback()).body);
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
    const token = entryToken((await callback()).body);
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
});
