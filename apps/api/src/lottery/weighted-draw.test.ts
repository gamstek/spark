import { describe, expect, it } from 'vitest';

import { chooseWeightedPrize } from './weighted-draw.js';

describe('random prize allocation', () => {
  it('gives each remaining item the same chance instead of each prize tier', () => {
    const prizes = [
      { id: 'grand', remainingStock: 1, weight: 1 },
      { id: 'regular', remainingStock: 99, weight: 1 },
    ];
    const outcomes = Array.from(
      { length: 100 },
      (_, index) =>
        chooseWeightedPrize(prizes, (total) =>
          Math.floor((index * total) / 100),
        )?.id,
    );
    expect(outcomes.filter((id) => id === 'grand')).toHaveLength(1);
    expect(outcomes.filter((id) => id === 'regular')).toHaveLength(99);
  });

  it('can select any stocked tier on the very first draw regardless of list order', () => {
    const prizes = [
      { id: 'grand', remainingStock: 1, weight: 1 },
      { id: 'regular', remainingStock: 99, weight: 1 },
    ];
    for (const ordered of [prizes, [...prizes].reverse()]) {
      expect(
        chooseWeightedPrize(ordered, (total) => Math.floor(total / 2))?.id,
      ).toBe('regular');
    }
  });

  it('preserves explicit weights while accounting for remaining stock', () => {
    const prizes = [
      { id: 'a', remainingStock: 2, weight: 3 },
      { id: 'b', remainingStock: 6, weight: 1 },
    ];
    expect(
      chooseWeightedPrize(prizes, (total) => Math.floor(total / 2) - 1)?.id,
    ).toBe('a');
    expect(
      chooseWeightedPrize(prizes, (total) => Math.floor(total / 2))?.id,
    ).toBe('b');
  });

  it('excludes exhausted or disabled prizes and rejects invalid random output', () => {
    expect(
      chooseWeightedPrize(
        [
          { id: 'empty', remainingStock: 0, weight: 1 },
          { id: 'disabled', remainingStock: 5, weight: 0 },
        ],
        () => 0,
      ),
    ).toBeNull();
    expect(() =>
      chooseWeightedPrize(
        [{ id: 'prize', remainingStock: 1, weight: 1 }],
        (total) => total,
      ),
    ).toThrow('INVALID_RANDOM_SOURCE');
  });
});
