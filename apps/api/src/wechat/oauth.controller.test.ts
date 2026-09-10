import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OAuthController } from './oauth.controller.js';

describe('OAuthController simulated login', () => {
  const previousEnvironment = process.env.NODE_ENV;

  afterEach(() => {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  });

  it('creates a subscribed activity session in development', async () => {
    process.env.NODE_ENV = 'development';
    const identities = {
      getOrCreateUser: vi.fn().mockResolvedValue({ userId: 'user-1' }),
      markSubscribed: vi.fn().mockResolvedValue(undefined),
    };
    const sessions = {
      create: vi.fn().mockResolvedValue({ token: 'session-token' }),
    };
    const headers = new Map<string, string>();
    const reply = {
      header: vi.fn((name: string, value: string) => {
        headers.set(name, value);
        return reply;
      }),
      send: vi.fn((body: unknown) => body),
    };
    const controller = new OAuthController(
      { validateReturnPath: vi.fn() } as never,
      {} as never,
      identities as never,
      sessions as never,
    );

    await controller.simulate(reply as never);

    expect(identities.markSubscribed).toHaveBeenCalledWith(
      'development-wechat-user',
    );
    expect(sessions.create).toHaveBeenCalledWith('ACTIVITY', 'user-1');
    expect(headers.get('Set-Cookie')).toContain('spark_activity=session-token');
    expect(reply.send).toHaveBeenCalledWith({ authenticated: true });
  });

  it('is unavailable outside development', async () => {
    process.env.NODE_ENV = 'production';
    const controller = new OAuthController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(controller.simulate({} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('builds the OAuth callback from the current public request', async () => {
    const states = {
      issue: vi.fn().mockResolvedValue({
        browserNonce: 'nonce',
        state: 'signed-state',
      }),
    };
    const reply = {
      header: vi.fn().mockReturnThis(),
      redirect: vi.fn((url: string) => url),
    };
    const controller = new OAuthController(
      states as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await controller.start(
      '/activity/expo',
      {
        protocol: 'https',
        headers: { host: 'spark.gamstek.com' },
      } as never,
      reply as never,
    );

    const redirect = new URL(reply.redirect.mock.calls[0]![0]);
    expect(redirect.searchParams.get('redirect_uri')).toBe(
      'https://spark.gamstek.com/api/wechat/oauth/callback',
    );
  });
});
