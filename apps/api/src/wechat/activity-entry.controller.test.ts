import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityEntryController } from './activity-entry.controller.js';

function setup(result: unknown) {
  const entries = { exchange: vi.fn().mockResolvedValue(result) };
  const reply = {
    header: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    redirect: vi.fn((url: string) => url),
  };
  const controller = new ActivityEntryController(entries as never);
  return { entries, reply, controller };
}

describe('ActivityEntryController', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['test', ''],
    ['production', '; Secure'],
  ])(
    'sets the seven-day activity cookie in %s and redirects to a single encoded segment',
    async (environment, secure) => {
      vi.stubEnv('NODE_ENV', environment);
      const { entries, reply, controller } = setup({
        status: 'exchanged',
        activityCode: '展会/a?b#c',
        sessionToken: 'session-token',
      });
      expect(await controller.enter('entry-token', reply as never)).toBe(
        '/activity/%E5%B1%95%E4%BC%9A%2Fa%3Fb%23c',
      );
      expect(entries.exchange).toHaveBeenCalledExactlyOnceWith('entry-token');
      expect(reply.status).toHaveBeenCalledWith(302);
      expect(reply.header).toHaveBeenCalledWith(
        'Set-Cookie',
        `spark_activity=session-token; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`,
      );
    },
  );

  it.each([
    ['expo/a?b', '/activity/expo%2Fa%3Fb?entryError=invalid'],
    [null, '/activity/entry-error'],
  ])(
    'redirects invalid tokens without a session cookie (%s)',
    async (activityCode, path) => {
      const { reply, controller } = setup({ status: 'invalid', activityCode });
      expect(await controller.enter('invalid-token', reply as never)).toBe(
        path,
      );
      expect(
        reply.header.mock.calls.some(([name]) => name === 'Set-Cookie'),
      ).toBe(false);
      expect(reply.status).toHaveBeenCalledWith(302);
    },
  );

  it.each([undefined, ['one', 'two']])(
    'normalizes missing or repeated token parameters to an invalid token',
    async (token) => {
      const { entries, reply, controller } = setup({
        status: 'invalid',
        activityCode: null,
      });
      expect(await controller.enter(token, reply as never)).toBe(
        '/activity/entry-error',
      );
      expect(entries.exchange).toHaveBeenCalledExactlyOnceWith('');
    },
  );
});
