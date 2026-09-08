import { useDemoRuntime } from '../lib/runtime';
import { SLICES } from '../lib/assets';
import { PageShell } from '../components/page-shell';
import { ActionButton } from '../components/action-button';

/**
 * 提交成功（表单提交后的等待/确认屏）。
 * 背景：submit-success/bg.png 铺满整页；成功图标居中；下方「去抽奖」按钮。
 */
export function SubmitSuccessPage() {
  const { activity, go } = useDemoRuntime();

  return (
    <PageShell className="bg-canvas">
      {/* 整页背景图 */}
      <img
        src={SLICES.submitSuccessBg}
        alt=""
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-full object-cover"
      />
      {/* 顶部标语 */}
      <header className="absolute inset-x-0 top-[53px] text-center text-[18px] text-ink">
        {activity.slug}
      </header>

      {/* 成功图标 118×118 居中 */}
      <img
        src={SLICES.submitSuccessIcon}
        alt="提交成功"
        className="absolute left-[128px] top-[280px] h-[118px] w-[118px] object-contain"
      />

      {/* 按钮：去抽奖 (43,658) 293×58 */}
      <div className="absolute left-[43px] top-[658px] w-[293px]">
        <ActionButton onClick={() => go('LOTTERY')}>去抽奖</ActionButton>
      </div>
    </PageShell>
  );
}
