import { describe, expect, it } from 'vitest';

import {
  getActivityActions,
  getActivityStatusPresentation,
} from './activity-status';

describe('activity status presentation', () => {
  it.each([
    ['DRAFT', '草稿'],
    ['UPCOMING', '未开始'],
    ['RUNNING', '进行中'],
    ['PAUSED', '已暂停'],
    ['DRAW_ENDED', '抽奖已结束'],
    ['ENDED', '活动已结束'],
  ] as const)('maps %s to %s', (status, label) => {
    expect(getActivityStatusPresentation(status).label).toBe(label);
  });
});

describe('activity status actions', () => {
  it('allows pausing and ending the draw while running', () => {
    expect(getActivityActions('RUNNING')).toEqual({
      canPause: true,
      canResume: false,
      canEndDraw: true,
    });
  });

  it('allows resuming and ending the draw while paused', () => {
    expect(getActivityActions('PAUSED')).toEqual({
      canPause: false,
      canResume: true,
      canEndDraw: true,
    });
  });

  it('exposes no lifecycle actions after drawing ends', () => {
    expect(getActivityActions('DRAW_ENDED')).toEqual({
      canPause: false,
      canResume: false,
      canEndDraw: false,
    });
  });
});
