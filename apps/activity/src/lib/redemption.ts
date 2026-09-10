import type { WinView } from '@spark/contracts';

/** demo 预览模式的中奖数据（真实模式由 /activity/:code/runtime 返回） */
export const WIN: WinView = {
  id: '00000000-0000-4000-8000-000000000001',
  prizeName: '定制手机支架',
  prizeImageUrl: null,
  redeemEndAt: '2026-09-16T23:59:59+08:00',
  redemptionStatus: 'WAIT_REDEEM',
};
