import type { RedemptionStatus } from '@spark/contracts';
import { STATUS_VIEW } from '../lib/tokens';

export function StatusTag({ status }: { status: RedemptionStatus }) {
  const v = STATUS_VIEW[status];
  return (
    <span
      className={`inline-flex h-[21px] items-center rounded-full px-2 text-[12px] leading-none ${v.bgClass} ${v.textClass}`}
    >
      {v.text}
    </span>
  );
}
