import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, setCsrf } from './api';

it('does not declare JSON for bodyless logout and preserves CSRF', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"success":true}'));
  vi.stubGlobal('fetch', fetchMock);
  setCsrf('session-csrf');
  await api('admin/auth/logout', { method: 'POST' });
  const request = fetchMock.mock.calls[0]![1] as RequestInit;
  const headers = new Headers(request.headers);
  expect(headers.has('content-type')).toBe(false);
  expect(headers.get('x-csrf-token')).toBe('session-csrf');
  expect(request.credentials).toBe('include');
});

it('declares JSON for a serialized payload and accepts Headers overrides', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  await api('admin/auth/login', {
    method: 'POST',
    body: '{"username":"admin"}',
    headers: new Headers({ 'x-request-id': 'test' }),
  });
  const headers = new Headers(fetchMock.mock.calls[0]![1].headers);
  expect(headers.get('content-type')).toBe('application/json');
  expect(headers.get('x-request-id')).toBe('test');
});

const activity = {
  id: 'activity-1',
  name: '展会活动',
  code: 'expo',
  revision: 1,
  published_version_id: 'version-1',
  draft_version_id: null,
  paused_at: null,
  starts_at: '2026-09-15T00:00:00.000Z',
  draw_ends_at: '2026-09-16T00:00:00.000Z',
  ends_at: '2026-09-17T00:00:00.000Z',
  status: 'RUNNING',
  serverNow: '2026-09-15T08:00:00.000Z',
  version: 1,
  template_id: 'exhibition-lottery',
  template_version: 1,
  config: {},
  redeem_ends_at: '2026-09-18T00:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrf('');
});

describe('admin activity response parsing', () => {
  it.each(['admin/activities', 'admin/activities/activity-1'])(
    'rejects missing lifecycle state from %s before consumers see it',
    async (path) => {
      const malformed = { ...activity, status: undefined };
      vi.stubGlobal('fetch', async () =>
        Response.json(path === 'admin/activities' ? [malformed] : malformed),
      );
      await expect(api(path)).rejects.toThrow();
    },
  );

  it.each([
    ['status', 'PUBLISHED'],
    ['serverNow', undefined],
    ['serverNow', 'not-a-date'],
  ])('rejects invalid %s in an activity detail', async (field, value) => {
    vi.stubGlobal('fetch', async () =>
      Response.json({ ...activity, [field]: value }),
    );
    await expect(api('admin/activities/activity-1')).rejects.toThrow();
  });

  it('returns a validated detail without renaming schedule fields', async () => {
    vi.stubGlobal('fetch', async () => Response.json(activity));
    await expect(api('admin/activities/activity-1')).resolves.toEqual(activity);
  });

  it('keeps creation and child endpoint response contracts unchanged', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ id: 'created' }));
    await expect(api('admin/activities', { method: 'POST' })).resolves.toEqual({
      id: 'created',
    });
    vi.stubGlobal('fetch', async () => Response.json({ participants: 3 }));
    await expect(api('admin/activities/activity-1/report')).resolves.toEqual({
      participants: 3,
    });
  });
});
