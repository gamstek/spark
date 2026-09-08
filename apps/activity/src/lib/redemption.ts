import type { RedemptionStatusSchema, WinView } from '@spark/contracts';
import type { z } from 'zod';

export type RedemptionStatus = z.infer<typeof RedemptionStatusSchema>;

export interface DemoWin {
  levelName: string;
  prizeName: string;
  redemptionStatus: RedemptionStatus;
  redeemEndAt: string;
}

export const WIN: WinView & { levelName: string } = {
  id: 'demo-win-1',
  levelName: '三等奖',
  prizeName: '定制手机支架',
  prizeImageUrl: null,
  redeemEndAt: '2026-09-16T23:59:59+08:00',
  redemptionStatus: 'WAIT_REDEEM',
};

export const REDEMPTION = {
  code: '836 215',
  /** 前后端核销二维码内容，Demo 用自身 URL 占位 */
  qrContent: `https://localhost/activity/demo?redeem=836215`,
  claimHint: '请出示二维码给工作人员核销',
};
