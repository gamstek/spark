import type { LotteryConfig } from './config.js';

export const lotteryDefaultConfig = {
  requireSubscribe: true,
  noPrizeWeight: 1,
  heroAssetId: 'configure-in-admin',
  rulesText: '填写信息后参与抽奖，每人每场活动限一次。',
} satisfies LotteryConfig;
