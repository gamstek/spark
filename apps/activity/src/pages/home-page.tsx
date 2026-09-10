import { ActionButton } from '../components/action-button';
import { SLICES } from '../lib/assets';
import { useRuntime } from '../hooks/use-runtime';
import { useDocumentTitle } from '../hooks/use-document-title';

export function HomePage() {
  const { activity, participate, openView, showMyPrizes } = useRuntime();
  useDocumentTitle(activity.title, null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-white shadow-[0_0_32px_rgba(26,31,44,0.08)]">
      <img
        src={SLICES.homeBg}
        alt="幸运抽奖赢大礼活动主视觉"
        className="aspect-[3000/3008] w-full shrink-0 object-cover"
      />

      <section className="relative -mt-3 flex flex-1 flex-col items-center rounded-t-[22px] bg-white px-6 pt-7 pb-[calc(116px+env(safe-area-inset-bottom))] text-center">
        <h1 className="max-w-[340px] text-[21px] leading-[1.55] font-medium tracking-[0.01em] text-ink">
          {activity.title}
        </h1>

        <dl className="mt-4 grid grid-cols-[76px_auto] gap-x-2 gap-y-1 text-[15px] leading-7 text-ink">
          <div className="contents">
            <dt className="text-right">活动时间：</dt>
            <dd className="text-left">{activity.dates}</dd>
          </div>
          {activity.organizer ? (
            <div className="contents">
              <dt className="text-right">主办方：</dt>
              <dd className="text-left">{activity.organizer}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-5 w-full max-w-[344px]">
          <ActionButton
            onClick={() => void participate()}
            className="mx-auto h-14 max-w-none border border-[#ff7180] bg-[linear-gradient(90deg,#ff3f43_0%,#d70e21_100%)] text-[20px] font-medium shadow-[0_5px_12px_rgba(207,16,44,0.24)]"
          >
            立即参与
          </ActionButton>
        </div>
      </section>

      <nav
        aria-label="活动快捷入口"
        className="fixed bottom-0 left-1/2 z-40 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-3 bg-white pt-3 pb-[max(10px,env(safe-area-inset-bottom))] shadow-[0_-5px_24px_rgba(35,37,43,0.12)]"
      >
        <FooterEntry
          icon={SLICES.homeIcon[2]}
          label="活动规则"
          onClick={() => openView('rules')}
        />
        <FooterEntry
          icon={SLICES.homeIcon[1]}
          label="活动说明"
          divided
          onClick={() => openView('info')}
        />
        <FooterEntry
          icon={SLICES.homeIcon[0]}
          label="我的奖品"
          divided
          onClick={showMyPrizes}
        />
      </nav>
    </main>
  );
}

function FooterEntry({
  icon,
  label,
  divided = false,
  onClick,
}: {
  icon: string | undefined;
  label: string;
  divided?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`relative flex min-h-[72px] flex-col items-center justify-center gap-1 text-[13px] text-ink active:bg-black/[0.03] ${
        divided
          ? "before:absolute before:top-3 before:bottom-3 before:left-0 before:w-px before:bg-[#d5d5d5] before:content-['']"
          : ''
      }`}
      onClick={onClick}
    >
      <img
        src={icon}
        alt=""
        className="size-9 object-contain"
      />
      <span>{label}</span>
    </button>
  );
}
