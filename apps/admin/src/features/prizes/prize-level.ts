const prizeLevels = ['一等奖', '二等奖', '三等奖'] as const;

export function getPrizeLevel(index: number): string {
  return prizeLevels[index] ?? `第${index + 1}等奖`;
}
