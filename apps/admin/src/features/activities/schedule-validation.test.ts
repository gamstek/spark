import { describe, expect, it } from 'vitest';

import { getActivityScheduleError } from './schedule-validation';

describe('activity schedule validation', () => {
  const validSchedule = {
    startsAt: '2026-09-17T10:49',
    drawEndsAt: '2026-09-18T10:49',
    endsAt: '2026-09-26T10:49',
    redeemEndsAt: '2026-09-30T10:49',
  };

  it('rejects a draw deadline before the activity starts', () => {
    expect(
      getActivityScheduleError({
        ...validSchedule,
        drawEndsAt: '2026-09-15T10:49',
      }),
    ).toBe('抽奖截止时间必须晚于活动开始时间。');
  });

  it('accepts an ordered schedule', () => {
    expect(getActivityScheduleError(validSchedule)).toBeNull();
  });
});
