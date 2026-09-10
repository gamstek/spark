import { SLICES } from '../lib/assets';
import type { StaffActivity } from '../lib/runtime';

function dateRange(activity: StaffActivity): string {
  const parts = (iso: string) =>
    new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date(iso))
      .reduce<Record<string, string>>((result, part) => {
        result[part.type] = part.value;
        return result;
      }, {});
  const start = parts(activity.startsAt);
  const end = parts(activity.endsAt);
  return `${start.year}.${start.month}.${start.day} - ${end.month}.${end.day}`;
}

export function ActivityCard({ activity }: { activity: StaffActivity | null }) {
  return (
    <div className="relative h-[109px] overflow-hidden rounded-[14px]">
      <img
        src={SLICES.home.activityCard}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="relative flex h-full flex-col justify-center pr-10 pl-[128px] text-left text-white">
        <p className="line-clamp-2 text-[16px] leading-6 font-medium">
          {activity?.name ?? '暂无可核销活动'}
        </p>
        {activity && (
          <p className="mt-1 text-[14px] text-white/85">
            {dateRange(activity)}
          </p>
        )}
        <svg
          viewBox="0 0 24 24"
          className="absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 text-white/90"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>
    </div>
  );
}
