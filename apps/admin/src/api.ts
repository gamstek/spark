let csrfToken = '';
export function setCsrf(value: string) {
  csrfToken = value;
}
export async function restoreAdminSession(): Promise<void> {
  const session = await api<{ csrfToken: string }>('admin/auth/me');
  setCsrf(session.csrfToken);
}
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (
    typeof init.body === 'string' &&
    init.body.length > 0 &&
    !headers.has('Content-Type')
  )
    headers.set('Content-Type', 'application/json');
  if (csrfToken && !headers.has('x-csrf-token'))
    headers.set('x-csrf-token', csrfToken);
  const response = await fetch(`/api/${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });
  if (response.status === 401 && path !== 'admin/auth/login') {
    location.assign('/admin/login');
    throw new Error('SESSION_EXPIRED');
  }
  if (!response.ok)
    throw new Error((await response.text()) || `HTTP_${response.status}`);
  return response.json() as Promise<T>;
}
