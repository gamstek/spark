import type { ActivityInfo, ActivityRuntime, WinView } from '@spark/contracts';

import type { ActivitySessionBootstrap } from './session-bootstrap';

/** API 业务错误：code 为契约中的错误码（如 OUT_OF_STOCK）。 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
};

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      ...(options.method === 'POST'
        ? { 'content-type': 'application/json' }
        : {}),
      ...options.headers,
    },
    body: options.method === 'POST' ? JSON.stringify({}) : undefined,
  });
  if (!response.ok) {
    let code = 'INTERNAL_ERROR';
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as {
        code?: string;
        message?: string;
      };
      if (body.code) code = body.code;
      if (body.message) message = body.message;
    } catch {
      // keep defaults
    }
    throw new ApiError(code, response.status, message);
  }
  return (await response.json()) as T;
}

export interface RuntimeResponse extends ActivityRuntime {
  csrfToken?: string;
}

/** 用户参与端（activity H5）用到的全部后端接口。 */
export const activityApi = {
  runtime: (code: string) =>
    request<RuntimeResponse>(
      `/api/activity/${encodeURIComponent(code)}/runtime?channel=direct`,
    ),
  info: (code: string) =>
    request<ActivityInfo>(`/api/activity/${encodeURIComponent(code)}/info`),
  bootstrapSession: (code: string, returnPath: string) =>
    request<ActivitySessionBootstrap>(
      `/api/activity/${encodeURIComponent(code)}/session?returnPath=${encodeURIComponent(returnPath)}`,
      { method: 'POST' },
    ),
  draw: (code: string, csrfToken: string) =>
    request<{ win: WinView | null }>(
      `/api/activity/${encodeURIComponent(code)}/lottery`,
      {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      },
    ),
  formLink: (code: string) =>
    request<{ url: string }>(
      `/api/activity/${encodeURIComponent(code)}/form-link`,
      {
        method: 'POST',
      },
    ),
  prizeCode: (code: string) =>
    request<{ code: string; qrUrl: string }>(
      `/api/activity/${encodeURIComponent(code)}/prize-code`,
    ),
  createSimulatedWechatSession: () =>
    request<{ authenticated: true }>('/api/wechat/oauth/simulate', {
      method: 'POST',
    }),
};
