import { afterEach, expect, it, vi } from 'vitest';
import { api, setCsrf } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrf('');
});

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
