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
  const response = await fetch(`/api/${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...init.headers,
    },
  });
  if (response.status === 401) {
    location.assign('/admin/login');
    throw new Error('SESSION_EXPIRED');
  }
  if (!response.ok)
    throw new Error((await response.text()) || `HTTP_${response.status}`);
  return response.json() as Promise<T>;
}
