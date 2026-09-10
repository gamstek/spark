import type { StaffRecord } from '../lib/api';
import { StatusTag } from './status-tag';

function timeText(record: StaffRecord): string {
  const iso = record.redeemedAt ?? record.wonAt;
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function ListRow({ record }: { record: StaffRecord }) {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex h-[34.5px] w-[34.5px] shrink-0 items-center justify-center rounded-full bg-[#DDE3FF] text-[14px] text-blue">
        {record.name.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-ink">
          {record.name} {record.phone}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-ink/70">
          奖品：{record.prizeName}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[12px] text-sub">{timeText(record)}</span>
        <StatusTag status={record.status} />
      </div>
    </div>
  );
}
