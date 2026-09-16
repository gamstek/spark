const WHEEL_SLOT_COUNT = 6;
const MAX_VISIBLE_PRIZES = WHEEL_SLOT_COUNT - 1;

interface PrizeOption {
  prizeLevel: string;
  name: string;
}

interface WinningPrize {
  prizeLevel: string;
  prizeName: string;
}

export interface WheelOption {
  kind: 'prize' | 'no-prize';
  label: string;
  prizeLevel: string;
  prizeName: string;
}

const noPrizeOption = (): WheelOption => ({
  kind: 'no-prize',
  label: '谢谢参与',
  prizeLevel: '',
  prizeName: '',
});

export function buildWheelOptions(
  prizes: readonly PrizeOption[],
  winner: WinningPrize | null,
): WheelOption[] {
  const visiblePrizes: WheelOption[] = prizes
    .slice(0, MAX_VISIBLE_PRIZES)
    .map((prize) => ({
      kind: 'prize',
      label: prize.prizeLevel,
      prizeLevel: prize.prizeLevel,
      prizeName: prize.name,
    }));
  const winnerIsVisible = visiblePrizes.some(
    (option) =>
      option.prizeLevel === winner?.prizeLevel &&
      option.prizeName === winner.prizeName,
  );

  if (winner && !winnerIsVisible) {
    const winningOption: WheelOption = {
      kind: 'prize',
      label: winner.prizeLevel,
      prizeLevel: winner.prizeLevel,
      prizeName: winner.prizeName,
    };
    if (visiblePrizes.length < MAX_VISIBLE_PRIZES) {
      visiblePrizes.push(winningOption);
    } else {
      visiblePrizes[MAX_VISIBLE_PRIZES - 1] = winningOption;
    }
  }

  const options = Array.from({ length: WHEEL_SLOT_COUNT }, noPrizeOption);
  visiblePrizes.forEach((prize, index) => {
    const slotIndex = Math.floor(
      (index * WHEEL_SLOT_COUNT) / visiblePrizes.length,
    );
    options[slotIndex] = prize;
  });
  return options;
}
