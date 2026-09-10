import type { RuntimeStep } from '@spark/contracts';

/**
 * Demo 状态机推进表：DIRECT 为正式步骤（经页面 CTA 触发），
 * FREE 为 dev 工具栏自由跳转分支。真实合法性由后端保证，这里仅约束 Demo。
 */
export const TRANSITIONS: Record<RuntimeStep, RuntimeStep[]> = {
  NOT_STARTED: ['SUBSCRIBE'],
  SUBSCRIBE: ['FORM'],
  FORM: ['WAITING_FORM'],
  WAITING_FORM: ['LOTTERY'],
  LOTTERY: ['PRIZE', 'OUT_OF_STOCK'],
  OUT_OF_STOCK: ['LOTTERY'],
  PRIZE: ['REDEEMED'],
  REDEEMED: [],
  EXPIRED: [],
  ENDED: [],
};

/** dev 工具栏展示顺序与中文标签 */
export const STEP_LABELS: { step: RuntimeStep; label: string }[] = [
  { step: 'NOT_STARTED', label: '首页' },
  { step: 'SUBSCRIBE', label: '扫码关注' },
  { step: 'FORM', label: '填写信息' },
  { step: 'WAITING_FORM', label: '提交成功' },
  { step: 'LOTTERY', label: '抽奖中' },
  { step: 'PRIZE', label: '恭喜中奖' },
  { step: 'REDEEMED', label: '我的奖品' },
  { step: 'EXPIRED', label: '已过期' },
  { step: 'OUT_OF_STOCK', label: '奖品告罄' },
  { step: 'ENDED', label: '已结束' },
];
