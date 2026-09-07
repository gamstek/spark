export interface WeightedPrize { id: string; remainingStock: number; weight: number }

export function chooseWeightedPrize(prizes: WeightedPrize[], randomInteger: (maxExclusive: number) => number): WeightedPrize | null {
  const eligible = prizes.filter((prize) => prize.remainingStock > 0 && Number.isFinite(prize.weight) && prize.weight > 0);
  if (eligible.length === 0) return null;
  const units = eligible.map((prize) => Math.max(1, Math.round(prize.weight * 1_000_000)));
  const total = units.reduce((sum, value) => sum + value, 0);
  let cursor = randomInteger(total);
  if (!Number.isInteger(cursor) || cursor < 0 || cursor >= total) throw new Error('INVALID_RANDOM_SOURCE');
  for (let index = 0; index < eligible.length; index += 1) {
    const unit = units[index]!;
    if (cursor < unit) return eligible[index]!;
    cursor -= unit;
  }
  return eligible.at(-1) ?? null;
}
