import { SLICES } from '../lib/assets';
import type { StaffActivity } from '../lib/runtime';

export function ActivityCard({ activity }: { activity: StaffActivity | null }) {
  return (
    <div className="relative h-[109px] overflow-hidden rounded-[14px]">
      <img
        src={SLICES.home.activityCard}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="relative flex h-full flex-col justify-center px-4 text-white">
        <p className="text-[16px] font-medium">
          {activity?.name ?? '暂无可核销活动'}
        </p>
        {activity && (
          <p className="mt-2 text-[14px] text-white/80">活动编号 {activity.code}</p>
        )}
        <svg
          viewBox="0 0 24 24"
          className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/70"
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
