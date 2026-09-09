import type { RedemptionStatus } from '@spark/contracts';

/** 核销状态 → 胶囊文案/配色（55×21，同色文字，淡色底） */
export const STATUS_VIEW: Record<
  RedemptionStatus,
  { text: string; textClass: string; bgClass: string }
> = {
  WAIT_REDEEM: {
    text: '待核销',
    textClass: 'text-wait',
    bgClass: 'bg-[#FFD07F]/40',
  },
  REDEEMED: { text: '已核销', textClass: 'text-green', bgClass: 'bg-green/15' },
  EXPIRED: {
    text: '已过期',
    textClass: 'text-sub',
    bgClass: 'bg-[#ADADAD]/30',
  },
};
