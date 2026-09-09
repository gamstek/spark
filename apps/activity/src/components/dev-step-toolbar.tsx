import { useRuntime, type DemoView } from '../lib/runtime';
import { STEP_LABELS } from '../lib/runtime-steps';

const VIEWS: { view: DemoView; label: string }[] = [
  { view: 'follow-success', label: '关注成功' },
  { view: 'info', label: '活动说明' },
  { view: 'redeemed-success', label: '核销成功' },
];

/** Demo 步骤导航工具栏：仅开发期 demo 预览模式渲染，自由切换到任意屏做验收 */
export function DevStepToolbar() {
  const { step, view, go, openView } = useRuntime();

  return (
    <div className="fixed bottom-3 left-1/2 z-[60] -translate-x-1/2 max-w-[calc(100vw-16px)]">
      <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-full bg-ink/85 p-1.5">
        {STEP_LABELS.map(({ step: s, label }) => (
          <button
            key={s}
            type="button"
            onClick={() => go(s, { free: true })}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] ${
              step === s && view === 'main' ? 'bg-white text-ink' : 'text-white'
            }`}
          >
            {label}
          </button>
        ))}
        {VIEWS.map(({ view: v, label }) => (
          <button
            key={v}
            type="button"
            onClick={() => openView(v)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] ${
              view === v ? 'bg-white text-ink' : 'text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
