import { describe, expect, it, vi } from 'vitest';

import { bootstrapActivitySession } from './session-bootstrap';

describe('bootstrapActivitySession', () => {
  it('refreshes after anonymous session creation authenticates the visitor', async () => {
    const createDevelopmentSession = vi.fn();
    const createSession = vi.fn(async () => ({ authenticated: true }) as const);
    const refresh = vi.fn(async () => undefined);
    const redirect = vi.fn();

    await bootstrapActivitySession({
      simulateDevelopmentSession: false,
      createDevelopmentSession,
      createSession,
      refresh,
      redirect,
    });

    expect(refresh).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects to WeChat OAuth when the session bootstrap requires it', async () => {
    const refresh = vi.fn(async () => undefined);
    const redirect = vi.fn();

    await bootstrapActivitySession({
      simulateDevelopmentSession: false,
      createDevelopmentSession: vi.fn(),
      createSession: async () => ({
        authenticated: false,
        redirectUrl: '/api/wechat/oauth/start?returnPath=%2Factivity%2Fdemo',
      }),
      refresh,
      redirect,
    });

    expect(redirect).toHaveBeenCalledWith(
      '/api/wechat/oauth/start?returnPath=%2Factivity%2Fdemo',
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('creates a development session before refreshing when simulation is enabled', async () => {
    const calls: string[] = [];

    await bootstrapActivitySession({
      simulateDevelopmentSession: true,
      createDevelopmentSession: async () => {
        calls.push('development-session');
      },
      createSession: async () => ({ authenticated: true }),
      refresh: async () => {
        calls.push('refresh');
      },
      redirect: vi.fn(),
    });

    expect(calls).toEqual(['development-session', 'refresh']);
  });
});
