import { useRuntime } from '../hooks/use-runtime';
import { PageHeader } from '../components/page-header';
import { useDocumentTitle } from '../hooks/use-document-title';

export function ActivityRulesPage() {
  const { activity, closeView } = useRuntime();
  useDocumentTitle(activity.title, '活动规则');

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-white text-ink shadow-[0_0_32px_rgba(26,31,44,0.08)]">
      <PageHeader
        title="活动规则"
        position="sticky"
        onBack={closeView}
      />

      <article className="px-5 py-5 pb-[max(32px,env(safe-area-inset-bottom))] text-[16px] leading-8">
        <p className="whitespace-pre-wrap">{activity.rulesText}</p>
      </article>
    </main>
  );
}
