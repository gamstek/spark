import { describe, expect, it } from 'vitest';

import { buildWheelOptions } from './wheel-options';

const prizes = Array.from({ length: 6 }, (_, index) => ({
  prizeLevel: `${index + 1}等奖`,
  name: `奖品${index + 1}`,
  imageUrl: null,
}));

describe('buildWheelOptions', () => {
  it('renders configured prize levels and fills all remaining wheel slots with no-prize options', () => {
    const options = buildWheelOptions(prizes.slice(0, 2), null);

    expect(options).toHaveLength(6);
    expect(options.filter((option) => option.kind === 'prize')).toEqual([
      expect.objectContaining({ label: '1等奖' }),
      expect.objectContaining({ label: '2等奖' }),
    ]);
    expect(options.filter((option) => option.kind === 'no-prize')).toHaveLength(
      4,
    );
    expect(options.map((option) => option.label)).toEqual([
      '1等奖',
      '谢谢参与',
      '谢谢参与',
      '2等奖',
      '谢谢参与',
      '谢谢参与',
    ]);
  });

  it('shows at most the first five configured prize levels', () => {
    const options = buildWheelOptions(prizes, null);

    expect(options.map((option) => option.label)).toEqual([
      '1等奖',
      '2等奖',
      '3等奖',
      '4等奖',
      '5等奖',
      '谢谢参与',
    ]);
  });

  it('makes a hidden winning level visible before selecting its stop slot', () => {
    const hiddenWinner = {
      prizeLevel: '6等奖',
      prizeName: '奖品6',
    };
    const options = buildWheelOptions(prizes, hiddenWinner);

    expect(options.map((option) => option.label)).toEqual([
      '1等奖',
      '2等奖',
      '3等奖',
      '4等奖',
      '6等奖',
      '谢谢参与',
    ]);
    expect(
      options.findIndex(
        (option) =>
          option.prizeLevel === hiddenWinner.prizeLevel &&
          option.prizeName === hiddenWinner.prizeName,
      ),
    ).toBe(4);
  });
});
