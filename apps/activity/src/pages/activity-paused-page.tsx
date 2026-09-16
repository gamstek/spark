import { useRuntime } from '../hooks/use-runtime';
import { useDocumentTitle } from '../hooks/use-document-title';

export function ActivityPausedPage() {
  const { activity } = useRuntime();
  useDocumentTitle(activity.title, '活动已暂停');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center justify-center bg-white px-8 text-center shadow-[0_0_32px_rgba(26,31,44,0.08)]">
      <section>
        <div
          className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#fff1f2] text-[28px] text-[#d70e21]"
          aria-hidden="true"
        >
          Ⅱ
        </div>
        <h1 className="mt-6 text-[24px] font-semibold text-ink">活动已暂停</h1>
        <p className="mt-3 text-[15px] leading-7 text-[#666]">
          现场运营正在处理中，请稍后刷新页面再参与活动。
        </p>
      </section>
    </main>
  );
}
