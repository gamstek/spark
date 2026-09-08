import type { RedemptionStatus } from '../lib/redemption';

const STATUS: Record<RedemptionStatus, { text: string; className: string }> = {
  WAIT_REDEEM: { text: '待核销', className: 'bg-wait/15 text-wait' },
  REDEEMED: { text: '已兑奖', className: 'bg-sub/15 text-sub' },
  EXPIRED: { text: '已过期', className: 'bg-brand/15 text-brand' },
};

export function StatusTag({ status }: { status: RedemptionStatus }) {
  const s = STATUS[status];
  if (!s) return null;
  return (
    <span
      className={`inline-flex h-[21px] items-center rounded-full px-2 text-[12px] leading-none ${s.className}`}
    >
      {s.text}
    </span>
  );
}
