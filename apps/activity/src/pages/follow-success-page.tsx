import { useDemoRuntime } from '../lib/runtime';
import { SLICES } from '../lib/assets';
import { PageShell } from '../components/page-shell';
import { ActionButton } from '../components/action-button';

/**
 * 关注成功（关注公众号·已关注）。
 * 背景：follow-success/bg.png 铺满整页；成功图标居中；下方「去填写信息」按钮。
 */
export function FollowSuccessPage() {
  const { activity, go } = useDemoRuntime();

  return (
    <PageShell className="bg-canvas">
      {/* 整页背景图 */}
      <img
        src={SLICES.followSuccessBg}
        alt=""
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-full object-cover"
      />
      {/* 顶部标语 */}
      <header className="absolute inset-x-0 top-[53px] text-center text-[18px] text-ink">
        {activity.slug}
      </header>

      {/* 成功图标 118×118 居中 (约 128,280) */}
      <img
        src={SLICES.followSuccessIcon}
        alt="关注成功"
        className="absolute left-[128px] top-[280px] h-[118px] w-[118px] object-contain"
      />

      {/* 按钮：去填写信息 (43,658) 293×58 */}
      <div className="absolute left-[43px] top-[658px] w-[293px]">
        <ActionButton onClick={() => go('FORM')}>去填写信息</ActionButton>
      </div>
    </PageShell>
  );
}
