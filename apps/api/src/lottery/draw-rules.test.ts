import { describe, expect, it } from 'vitest';

import {
  getShanghaiHalfDayWindow,
  isWinningRoll,
  underHalfDayLimit,
} from './draw-rules.js';

describe('lottery draw rules', () => {
  it('defaults to no win when probability is zero', () => {
    expect(isWinningRoll(0, () => 0)).toBe(false);
  });

  it('uses percentage boundaries without rounding drift', () => {
    expect(isWinningRoll(25, () => 249_999)).toBe(true);
    expect(isWinningRoll(25, () => 250_000)).toBe(false);
  });

  it('splits half days at noon in Asia/Shanghai', () => {
    expect(
      getShanghaiHalfDayWindow(new Date('2026-09-15T03:59:59.000Z')),
    ).toEqual({
      startsAt: new Date('2026-09-14T16:00:00.000Z'),
      endsAt: new Date('2026-09-15T04:00:00.000Z'),
    });
    expect(
      getShanghaiHalfDayWindow(new Date('2026-09-15T04:00:00.000Z')),
    ).toEqual({
      startsAt: new Date('2026-09-15T04:00:00.000Z'),
      endsAt: new Date('2026-09-15T16:00:00.000Z'),
    });
  });

  it('excludes a prize once its half-day limit is reached', () => {
    expect(underHalfDayLimit(1, 0)).toBe(true);
    expect(underHalfDayLimit(1, 1)).toBe(false);
    expect(underHalfDayLimit(0, 0)).toBe(false);
  });
});
