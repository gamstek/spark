import type { StaffRecord } from '../lib/api';
import { StatusTag } from './status-tag';

function timeText(record: StaffRecord): string {
  const iso = record.redeemedAt ?? record.wonAt;
  const date = new Date(iso);
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const today =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return today
    ? `今天 ${time}`
    : `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`;
}

export function ListRow({ record }: { record: StaffRecord }) {
  return (
    <div className="flex items-center gap-2.5 px-1.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dfe5ff] text-blue">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5 fill-current"
        >
          <circle
            cx="12"
            cy="8"
            r="4"
          />
          <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0H4.8Z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-sub">
          <span className="shrink-0 text-[13px] text-ink">{record.name}</span>
          <span className="truncate">{record.phone}</span>
          <span className="ml-auto shrink-0">{timeText(record)}</span>
          <StatusTag status={record.status} />
        </div>
        <p className="mt-1 truncate text-[12px] text-ink/70">
          奖品：{record.prizeName}
        </p>
      </div>
    </div>
  );
}
