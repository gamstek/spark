const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const HALF_DAY_MS = 12 * 60 * 60 * 1000;
const PROBABILITY_SCALE = 1_000_000;

export function isWinningRoll(
  probability: number,
  randomInteger: (maxExclusive: number) => number,
): boolean {
  if (!Number.isFinite(probability) || probability <= 0) return false;
  if (probability >= 100) return true;
  return randomInteger(PROBABILITY_SCALE) < probability * 10_000;
}

export function getShanghaiHalfDayWindow(now: Date): {
  startsAt: Date;
  endsAt: Date;
} {
  const shanghaiTime = now.getTime() + SHANGHAI_OFFSET_MS;
  const startsAtShanghai = Math.floor(shanghaiTime / HALF_DAY_MS) * HALF_DAY_MS;
  return {
    startsAt: new Date(startsAtShanghai - SHANGHAI_OFFSET_MS),
    endsAt: new Date(startsAtShanghai + HALF_DAY_MS - SHANGHAI_OFFSET_MS),
  };
}

export function underHalfDayLimit(limit: number, awarded: number): boolean {
  return Number.isSafeInteger(limit) && limit > 0 && awarded < limit;
}
