import { describe, expect, it } from 'vitest';

import { AdminActivityDetailSchema, AdminActivityListSchema } from './index.js';

const activity = {
  id: 'activity-1',
  code: 'expo',
  name: '展会活动',
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

describe('admin activity responses', () => {
  it('parses snake-case list and detail data with authoritative lifecycle fields', () => {
    expect(AdminActivityListSchema.parse([activity])[0]).toMatchObject({
      id: 'activity-1',
      status: 'RUNNING',
      serverNow: '2026-09-15T08:00:00.000Z',
      draw_ends_at: '2026-09-16T00:00:00.000Z',
    });
    expect(AdminActivityDetailSchema.parse(activity)).toEqual(activity);
  });

  it.each([
    ['status', undefined],
    ['status', 'PUBLISHED'],
    ['status', null],
    ['serverNow', undefined],
    ['serverNow', 'invalid-time'],
    ['starts_at', undefined],
    ['draw_ends_at', 'invalid-time'],
    ['ends_at', undefined],
  ])(
    'rejects malformed %s: %s in list and detail responses',
    (field, value) => {
      const malformed = { ...activity, [field]: value };
      expect(AdminActivityListSchema.safeParse([malformed]).success).toBe(
        false,
      );
      expect(AdminActivityDetailSchema.safeParse(malformed).success).toBe(
        false,
      );
    },
  );
});
