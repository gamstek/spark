import { describe, expect, it } from 'vitest';

import { getPrizeLevel } from './prize-level';

describe('automatic prize levels', () => {
  it.each([
    [0, '一等奖'],
    [1, '二等奖'],
    [2, '三等奖'],
  ])('maps prize index %i to %s', (index, expected) => {
    expect(getPrizeLevel(index)).toBe(expected);
  });
});
