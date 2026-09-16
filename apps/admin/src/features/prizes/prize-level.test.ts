import { describe, expect, it } from 'vitest';

import { getPrizeLevel } from './prize-level';

describe('automatic prize levels', () => {
  it.each([
    [0, '一等奖'],
    [1, '二等奖'],
    [2, '三等奖'],
    [3, '四等奖'],
    [9, '十等奖'],
    [10, '十一等奖'],
    [19, '二十等奖'],
  ])('maps prize index %i to %s', (index, expected) => {
    expect(getPrizeLevel(index)).toBe(expected);
  });
});
