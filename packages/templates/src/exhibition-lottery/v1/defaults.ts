import type { LotteryConfig } from './config.js';

export const lotteryDefaultConfig = {
  formId: 'configure-in-admin',
  formUrl: 'https://alidocs.dingtalk.com/notable/share/form/configure-in-admin',
  prefillField: 'participationId',
  fieldMapping: {
    participationId: '参与记录ID',
    name: '姓名',
    phone: '手机号',
  },
  requireSubscribe: true,
  heroAssetId: 'configure-in-admin',
  rulesText: '填写信息后参与抽奖，每人每场活动限一次。',
} satisfies LotteryConfig;
