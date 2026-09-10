import { ChildPageHeader } from '../components/child-page-header';
import { PageShell } from '../components/page-shell';
import { useStaff } from '../lib/runtime';

export function RulesPage() {
  const { currentActivity } = useStaff();

  return (
    <PageShell className="min-h-dvh bg-canvas pb-8">
      <ChildPageHeader title="活动规则" />
      <article className="mx-4 mt-3 rounded-[14px] bg-white px-5 py-5 shadow-[0_3px_12px_rgba(30,37,62,0.035)]">
        <h1 className="text-xl font-medium text-ink">
          {currentActivity?.name ?? '活动规则'}
        </h1>
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-sub">
          {currentActivity?.rulesText || '当前活动暂未配置活动规则。'}
        </p>
      </article>
    </PageShell>
  );
}
