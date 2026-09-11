import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { Activity, UserAccount } from '../../database/entities/index.js';
import {
  readActivityIdentityMode,
  type ActivityIdentityMode,
} from './activity-identity-mode.js';
import { ActivitySessionController } from './activity-session.controller.js';
import { OAuthStateService } from '../wechat/oauth-state.service.js';

function createController(
  mode: ActivityIdentityMode,
  activity: { id: string; code: string } | null = {
    id: 'activity-id',
    code: 'expo-2026',
  },
) {
  const findOne = vi.fn().mockResolvedValue(activity);
  const insert = vi.fn().mockResolvedValue(undefined);
  const activities = { findOne };
  const users = { insert };
  const dataSource = {
    getRepository: vi.fn((entity) =>
      entity === Activity ? activities : users,
    ),
  };
  const sessions = {
    create: vi.fn().mockResolvedValue({ token: 'activity-session-token' }),
  };
  const states = new OAuthStateService({} as never, 'test-secret');
  const reply = {
    header: vi.fn().mockReturnThis(),
    send: vi.fn((value: unknown) => value),
  };
  const controller = new ActivitySessionController(
    dataSource as never,
    sessions as never,
    states as never,
    mode,
  );

  return { controller, dataSource, findOne, insert, reply, sessions, states };
}

describe('readActivityIdentityMode', () => {
  it.each([
    [undefined, 'anonymous'],
    ['anonymous', 'anonymous'],
    ['wechat', 'wechat'],
  ] as const)('reads %s as %s', (value, expected) => {
    expect(readActivityIdentityMode(value)).toBe(expected);
  });

  it('rejects an unsupported identity mode', () => {
    expect(() => readActivityIdentityMode('callback')).toThrow(
      'ACTIVITY_IDENTITY_MODE_INVALID',
    );
  });
});

describe('OAuthStateService.validateReturnPath', () => {
  const states = new OAuthStateService({} as never, 'test-secret');

  it('allows activity child paths with encoded safe query values', () => {
    expect(() =>
      states.validateReturnPath(
        '/activity/expo-2026/rules?source=qr%20code&ref=landing',
      ),
    ).not.toThrow();
  });

  it.each([
    '/activity/expo-2026/rules?source=qr code',
    '//example.com/activity/expo-2026',
  ])('rejects unsafe return paths (%s)', (returnPath) => {
    expect(() => states.validateReturnPath(returnPath)).toThrow(
      'RETURN_PATH_INVALID',
    );
  });
});

describe('ActivitySessionController', () => {
  it('creates an anonymous activity session for a published activity', async () => {
    const { controller, dataSource, findOne, insert, reply, sessions } =
      createController('anonymous');

    await expect(
      controller.create(
        'expo-2026',
        '/activity/expo-2026',
        { id: 'request-id' } as never,
        reply as never,
      ),
    ).resolves.toEqual({ authenticated: true });

    expect(findOne).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith({ id: expect.any(String) });
    const userId = insert.mock.calls[0]?.[0]?.id;
    expect(sessions.create).toHaveBeenCalledWith('ACTIVITY', userId);
    expect(reply.header).toHaveBeenCalledWith(
      'Set-Cookie',
      'spark_activity=activity-session-token; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800',
    );
    expect(dataSource.getRepository).toHaveBeenCalledWith(Activity);
    expect(dataSource.getRepository).toHaveBeenCalledWith(UserAccount);
  });

  it('redirects WeChat sessions without creating a user', async () => {
    const { controller, dataSource, insert, reply, sessions } =
      createController('wechat');

    await expect(
      controller.create(
        'expo-2026',
        '/activity/expo-2026?source=qr%20code',
        { id: 'request-id' } as never,
        reply as never,
      ),
    ).resolves.toEqual({
      authenticated: false,
      redirectUrl:
        '/api/wechat/oauth/start?returnPath=%2Factivity%2Fexpo-2026%3Fsource%3Dqr%2520code',
    });

    expect(insert).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
    expect(reply.header).not.toHaveBeenCalled();
    expect(dataSource.getRepository).toHaveBeenCalledWith(Activity);
    expect(dataSource.getRepository).not.toHaveBeenCalledWith(UserAccount);
  });

  it('allows a return path within the activity', async () => {
    const { controller, insert, reply, sessions } = createController('wechat');

    await expect(
      controller.create(
        'expo-2026',
        '/activity/expo-2026/rules',
        { id: 'request-id' } as never,
        reply as never,
      ),
    ).resolves.toEqual({
      authenticated: false,
      redirectUrl:
        '/api/wechat/oauth/start?returnPath=%2Factivity%2Fexpo-2026%2Frules',
    });

    expect(insert).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejects a session bootstrap for an unpublished activity', async () => {
    const { controller, insert, reply, sessions } = createController(
      'anonymous',
      null,
    );

    await expect(
      controller.create(
        'expo-2026',
        '/activity/expo-2026',
        { id: 'request-id' } as never,
        reply as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(insert).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
    expect(reply.header).not.toHaveBeenCalled();
  });

  it('rejects a return path outside the activity', async () => {
    const { controller, findOne, insert, reply, sessions } =
      createController('anonymous');

    await expect(
      controller.create(
        'expo-2026',
        '/activity/other',
        { id: 'request-id' } as never,
        reply as never,
      ),
    ).rejects.toThrow('RETURN_PATH_INVALID');

    expect(findOne).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(sessions.create).not.toHaveBeenCalled();
    expect(reply.header).not.toHaveBeenCalled();
  });
});
