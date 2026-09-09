import type { StaffPrizeView, StaffRecordView } from '@spark/contracts';

/** API 业务错误：code 为契约中的错误码（如 REDEMPTION_NOT_FOUND）。 */
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
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    let code = 'INTERNAL_ERROR';
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { code?: string; message?: string };
      if (body.code) code = body.code;
      if (body.message) message = body.message;
    } catch {
      // keep defaults
    }
    throw new ApiError(code, response.status, message);
  }
  return (await response.json()) as T;
}

export interface StaffMe {
  id: string | undefined;
  role: 'STAFF';
  csrfToken: string | undefined;
  displayName: string;
}

/** 核销结果视图（lookup / confirm 共用） */
export interface RedemptionView {
  lotteryRecordId: string;
  activityId: string;
  prizeName: string;
  prizeImageUrl: string | null;
  status: StaffRecordView['status'];
  redeemEndAt: string;
  redeemedAt: string | null;
  userHint: string;
}

/** 职员核销端用到的全部后端接口。 */
export const staffApi = {
  me: () => request<StaffMe>('/api/staff/auth/me'),
  login: (username: string, password: string) =>
    request<{ id: string; role: 'STAFF'; displayName: string }>(
      '/api/staff/auth/login',
      { method: 'POST', body: { username, password } },
    ),
  logout: (csrfToken: string) =>
    request<{ success: true }>('/api/staff/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken },
      body: {},
    }),
  activities: () =>
    request<{ id: string; code: string; name: string }[]>('/api/staff/activities'),
  prizes: (activityId: string) =>
    request<StaffPrizeView[]>(
      `/api/staff/activities/${encodeURIComponent(activityId)}/prizes`,
    ),
  records: (activityId?: string) =>
    request<StaffRecordView[]>(
      `/api/staff/redemptions/records${
        activityId ? `?activityId=${encodeURIComponent(activityId)}` : ''
      }`,
    ),
  lookup: (code: string) =>
    request<RedemptionView>('/api/staff/redemptions/lookup', {
      method: 'POST',
      body: { code },
    }),
  confirm: (code: string, csrfToken: string) =>
    request<RedemptionView>('/api/staff/redemptions/confirm', {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken },
      body: { code },
    }),
};

export type RedemptionStatus = StaffRecordView['status'];
export type StaffRecord = StaffRecordView;
export type StaffPrize = StaffPrizeView;
