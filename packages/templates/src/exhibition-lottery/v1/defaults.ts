import type { LotteryConfig } from './config.js';

export const lotteryDefaultConfig = {
  requireSubscribe: true,
  winningProbability: 0,
  halfDayPrizeLimits: {},
  rulesText: '填写信息后参与抽奖，每人每场活动限一次。',
} satisfies LotteryConfig;
