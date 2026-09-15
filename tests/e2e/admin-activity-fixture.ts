import type { AdminActivityDetail } from '@spark/contracts';

// Lifecycle state and server time stay explicit in every response fixture.
export const adminActivityDefaults = {
  id: 'activity-1',
  code: 'expo',
  name: '展会活动',
  revision: 0,
  published_version_id: null,
  draft_version_id: null,
  paused_at: null,
  starts_at: '2020-01-01T00:00:00.000Z',
  draw_ends_at: '2099-01-02T00:00:00.000Z',
  ends_at: '2099-01-03T00:00:00.000Z',
  redeem_ends_at: '2099-01-04T00:00:00.000Z',
  version: 1,
  template_id: 'exhibition-lottery',
  template_version: 1,
  config: {},
} satisfies Omit<AdminActivityDetail, 'status' | 'serverNow'>;
