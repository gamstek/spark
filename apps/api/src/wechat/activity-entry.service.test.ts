import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { WechatActivityEntryToken } from '../../database/entities/index.js';
import { WechatActivityEntryService } from './activity-entry.service.js';

const now = new Date('2026-09-11T08:00:00.000Z');
const entryToken = 'plain-entry-token';
const entryHash = createHash('sha256').update(entryToken).digest('hex');

function createIssueService(activities: { id: string; code: string }[]) {
  const insert = vi.fn();
  const repository = { insert };
  const dataSource = {
    query: vi.fn().mockResolvedValue(activities),
    getRepository: vi.fn().mockReturnValue(repository),
  };
  const identities = {
    getOrCreateUser: vi.fn().mockResolvedValue({ userId: 'user-id' }),
    markSubscribed: vi.fn(),
  };
  const sessions = { create: vi.fn() };
  const service = new WechatActivityEntryService(
    dataSource as never,
    identities as never,
    sessions as never,
    'https://spark.gamstek.com',
    () => now,
    () => entryToken,
  );

  return { dataSource, identities, insert, service };
}

function createExchangeService(rows: unknown[]) {
  const query = vi.fn().mockResolvedValueOnce(rows);
  const manager = { query };
  const dataSource = {
    transaction: vi.fn(
      async (work: (transactionManager: { query: typeof query }) => unknown) =>
        work(manager),
    ),
  };
  const identities = {
    getOrCreateUser: vi.fn(),
    markSubscribed: vi.fn(),
  };
  const sessions = {
    create: vi.fn().mockResolvedValue({ token: 'session-token' }),
  };
  const service = new WechatActivityEntryService(
    dataSource as never,
    identities as never,
    sessions as never,
    'https://spark.gamstek.com',
    () => now,
    () => entryToken,
  );

  return { dataSource, manager, query, service, sessions };
}

describe('WechatActivityEntryService.issue', () => {
  it('does not insert an entry token when no published activity is active', async () => {
    const { insert, service } = createIssueService([]);

    await expect(service.issue('openid')).resolves.toEqual({
      status: 'no-active-activity',
    });

    expect(insert).not.toHaveBeenCalled();
  });

  it('does not insert an entry token when multiple published activities are active', async () => {
    const { insert, service } = createIssueService([
      { id: 'activity-one', code: 'one' },
      { id: 'activity-two', code: 'two' },
    ]);

    await expect(service.issue('openid')).resolves.toEqual({
      status: 'multiple-active-activities',
    });

    expect(insert).not.toHaveBeenCalled();
  });

  it('creates a subscribed identity and hashed short-lived entry link for one active activity', async () => {
    const { dataSource, identities, insert, service } = createIssueService([
      { id: 'activity-id', code: 'expo-2026' },
    ]);

    await expect(service.issue('openid')).resolves.toEqual({
      status: 'issued',
      activityCode: 'expo-2026',
      url: `https://spark.gamstek.com/api/activity/entry?t=${entryToken}`,
    });

    expect(identities.getOrCreateUser).toHaveBeenCalledWith('openid');
    expect(identities.markSubscribed).toHaveBeenCalledWith('openid');
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 2'),
      [now],
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: entryHash,
        userId: 'user-id',
        activityId: 'activity-id',
        expiresAt: new Date('2026-09-11T08:10:00.000Z'),
      }),
    );
    expect(insert.mock.calls[0]?.[0]?.tokenHash).toHaveLength(64);
    expect(insert.mock.calls[0]?.[0]?.tokenHash).not.toBe(entryToken);
    expect(dataSource.getRepository).toHaveBeenCalledWith(
      WechatActivityEntryToken,
    );
  });
});

describe('WechatActivityEntryService.exchange', () => {
  it('returns invalid without creating a session for an unknown token', async () => {
    const { service, sessions } = createExchangeService([]);

    await expect(service.exchange(entryToken)).resolves.toEqual({
      status: 'invalid',
      activityCode: null,
    });

    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('returns invalid without creating a session for an expired token', async () => {
    const { service, sessions } = createExchangeService([
      {
        id: 'entry-id',
        user_id: 'user-id',
        activity_code: 'expo-2026',
        expires_at: new Date('2026-09-11T07:59:59.999Z'),
        consumed_at: null,
      },
    ]);

    await expect(service.exchange(entryToken)).resolves.toEqual({
      status: 'invalid',
      activityCode: 'expo-2026',
    });

    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('returns invalid without creating a session for a consumed token', async () => {
    const { service, sessions } = createExchangeService([
      {
        id: 'entry-id',
        user_id: 'user-id',
        activity_code: 'expo-2026',
        expires_at: new Date('2026-09-11T08:10:00.000Z'),
        consumed_at: now,
      },
    ]);

    await expect(service.exchange(entryToken)).resolves.toEqual({
      status: 'invalid',
      activityCode: 'expo-2026',
    });

    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('locks, consumes, and exchanges a valid token using its transaction manager', async () => {
    const { manager, query, service, sessions } = createExchangeService([
      {
        id: 'entry-id',
        user_id: 'user-id',
        activity_code: 'expo-2026',
        expires_at: new Date('2026-09-11T08:10:00.000Z'),
        consumed_at: null,
      },
    ]);

    await expect(service.exchange(entryToken)).resolves.toEqual({
      status: 'exchanged',
      activityCode: 'expo-2026',
      sessionToken: 'session-token',
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FOR UPDATE'),
      [entryHash],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SET consumed_at=$2'),
      ['entry-id', now],
    );
    expect(sessions.create).toHaveBeenCalledWith(
      'ACTIVITY',
      'user-id',
      manager,
    );
  });

  it('uses one transaction-time instant for expiry and consumption', async () => {
    const transactionTime = new Date('2026-09-11T08:00:00.000Z');
    const laterTime = new Date('2026-09-11T08:00:01.000Z');
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'entry-id',
          user_id: 'user-id',
          activity_code: 'expo-2026',
          expires_at: new Date('2026-09-11T08:10:00.000Z'),
          consumed_at: null,
        },
      ])
      .mockResolvedValueOnce([]);
    const manager = { query };
    const dataSource = {
      transaction: vi.fn(
        async (
          work: (transactionManager: { query: typeof query }) => unknown,
        ) => work(manager),
      ),
    };
    const clock = vi
      .fn()
      .mockReturnValueOnce(transactionTime)
      .mockReturnValue(laterTime);
    const service = new WechatActivityEntryService(
      dataSource as never,
      { getOrCreateUser: vi.fn(), markSubscribed: vi.fn() } as never,
      {
        create: vi.fn().mockResolvedValue({ token: 'session-token' }),
      } as never,
      'https://spark.gamstek.com',
      clock,
      () => entryToken,
    );

    await service.exchange(entryToken);

    expect(query).toHaveBeenNthCalledWith(2, expect.any(String), [
      'entry-id',
      transactionTime,
    ]);
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it('rejects the second exchange after the first transaction consumes the token', async () => {
    let consumedAt: Date | null = null;
    const row = {
      id: 'entry-id',
      user_id: 'user-id',
      activity_code: 'expo-2026',
      expires_at: new Date('2026-09-11T08:10:00.000Z'),
      get consumed_at() {
        return consumedAt;
      },
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT')) return [row];
      consumedAt = now;
      return [];
    });
    const manager = { query };
    const dataSource = {
      transaction: vi.fn(
        async (
          work: (transactionManager: { query: typeof query }) => unknown,
        ) => work(manager),
      ),
    };
    const sessions = {
      create: vi.fn().mockResolvedValue({ token: 'session-token' }),
    };
    const service = new WechatActivityEntryService(
      dataSource as never,
      { getOrCreateUser: vi.fn(), markSubscribed: vi.fn() } as never,
      sessions as never,
      'https://spark.gamstek.com',
      () => now,
      () => entryToken,
    );

    await expect(service.exchange(entryToken)).resolves.toMatchObject({
      status: 'exchanged',
    });
    await expect(service.exchange(entryToken)).resolves.toEqual({
      status: 'invalid',
      activityCode: 'expo-2026',
    });

    expect(sessions.create).toHaveBeenCalledTimes(1);
  });

  it('rejects empty and implausibly long tokens before opening a transaction', async () => {
    const { dataSource, service } = createExchangeService([]);

    await expect(service.exchange('')).resolves.toEqual({
      status: 'invalid',
      activityCode: null,
    });
    await expect(service.exchange('x'.repeat(513))).resolves.toEqual({
      status: 'invalid',
      activityCode: null,
    });

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
