import { useRuntime } from '../lib/runtime';
import { SLICES } from '../lib/assets';
import { PageShell } from '../components/page-shell';
import { ActionButton } from '../components/action-button';

/**
 * 关注成功（关注公众号·已关注）。
 * 背景：follow-success/bg.png 铺满整页；图标居中 + 「关注成功」蓝紫主标题
 *   + 深灰副文两行；下方「我已关注，去填写信息」按钮（点击后重新校验关注状态）。
 */
export function FollowSuccessPage() {
  const { activity, verifySubscribe } = useRuntime();

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

      {/* 成功图标 118.5×118.5 居中 (130.5,251) */}
      <img
        src={SLICES.followSuccessIcon}
        alt="关注成功"
        className="absolute left-[130px] top-[251px] h-[118px] w-[118px] object-contain"
      />

      {/* 主标题「关注成功」36px 蓝紫 (115,379.5) */}
      <h1 className="absolute left-[115px] top-[379px] w-[146px] text-center text-[36px] text-win2">
        关注成功
      </h1>

      {/* 副文「感谢关注 请继续填写活动信息」18px 深灰 两行 (101,452.5) */}
      <p className="absolute left-[101px] top-[452px] w-[174px] text-center text-[18px] text-[#3A3A3A]">
        感谢关注
        <br />
        请继续填写活动信息
      </p>

      {/* 按钮：我已关注，去填写信息 (43,658) 293×58 */}
      <div className="absolute left-[43px] top-[658px] w-[293px]">
        <ActionButton onClick={() => void verifySubscribe()}>
          我已关注，去填写信息
        </ActionButton>
      </div>
    </PageShell>
  );
}
