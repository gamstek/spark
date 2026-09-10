import { useRuntime } from '../hooks/use-runtime';
import { PageHeader } from '../components/page-header';
import { useDocumentTitle } from '../hooks/use-document-title';

const PRIZE_BADGE_COLORS = [
  'bg-[#ff5a70]',
  'bg-[#ffc51b]',
  'bg-[#a9c1d1]',
  'bg-[#62b4e6]',
];

function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function formatChineseDateRange(
  startsAt: string,
  endsAt: string,
  fallback: string,
) {
  const start = parseCalendarDate(startsAt);
  const end = parseCalendarDate(endsAt);
  if (!start || !end) return fallback;

  const startLabel = `${start.year}年${start.month}月${start.day}日`;
  const endLabel =
    start.year === end.year
      ? `${end.month}月${end.day}日`
      : `${end.year}年${end.month}月${end.day}日`;
  return `${startLabel} — ${endLabel}`;
}

export function ActivityInfoPage() {
  const { activity, closeView } = useRuntime();
  useDocumentTitle(activity.title, '活动说明');

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-[#f5f6fa] text-ink">
      <PageHeader
        title="活动说明"
        onBack={closeView}
        position="sticky"
      />

      <div className="px-[18px] pt-6 pb-12">
        <section aria-labelledby="prize-introduction-title">
          <h2
            id="prize-introduction-title"
            className="text-[20px] leading-7 font-medium"
          >
            奖品介绍
          </h2>
          <ol className="mt-4 space-y-2.5">
            {activity.prizes.map((prize, index) => (
              <li
                key={`${prize.name}-${index}`}
                className="flex min-h-[70px] items-center gap-2.5 rounded-xl bg-white px-[18px] py-3 shadow-[0_1px_2px_rgba(20,38,63,0.02)]"
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-medium text-white ${PRIZE_BADGE_COLORS[Math.min(index, PRIZE_BADGE_COLORS.length - 1)]}`}
                >
                  {index + 1}
                </span>
                <span className="text-[16px]">奖品</span>
                <span className="ml-auto min-w-0 pl-4 text-right text-[16px] leading-6">
                  {prize.name}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="mt-6"
          aria-labelledby="activity-time-title"
        >
          <h2
            id="activity-time-title"
            className="text-[20px] leading-7 font-medium"
          >
            活动时间
          </h2>
          <p className="mt-4 text-[16px] leading-7">
            {formatChineseDateRange(
              activity.startsAt,
              activity.endsAt,
              activity.dates,
            )}
          </p>
        </section>

        <section
          className="mt-6"
          aria-labelledby="activity-rules-title"
        >
          <h2
            id="activity-rules-title"
            className="text-[20px] leading-7 font-medium"
          >
            活动规则
          </h2>
          <p className="mt-4 whitespace-pre-wrap text-[16px] leading-7">
            {activity.rulesText}
          </p>
        </section>
      </div>
    </main>
  );
}
