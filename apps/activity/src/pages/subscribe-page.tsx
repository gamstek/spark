import { useRuntime } from '../lib/runtime';
import { SLICES } from '../lib/assets';
import { PageShell } from '../components/page-shell';
import { ActionButton } from '../components/action-button';

/**
 * 扫码关注（关注公众号·未关注）。
 * 背景：subscribe/bg.png 铺满整页；坐标 @1x（375×769）：
 *   标语   (124,53) 125×18   深色字（加浅底条）
 *   大字   (80,141) 217×109  白字，两行，font-display 40px 居中
 *   二维码 (52,280) 271×271
 *   引导   (91,583) 193×50   #3A3A3A
 *   按钮   (43,658) 293×58
 */
export function SubscribePage() {
  const { activity, openView } = useRuntime();

  return (
    <PageShell className="bg-canvas">
      {/* 整页背景图 */}
      <img
        src={SLICES.subscribeBg}
        alt=""
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-full object-cover"
      />
      {/* 顶部标题条：浅色底 + 深色标语 #333 */}
      <header className="absolute inset-x-0 top-[40px] text-center text-[18px] text-ink">
        <span className="inline-block rounded-full bg-white/80 px-4 py-1">
          {activity.slug}
        </span>
      </header>

      {/* 大字标题 */}
      <h1 className="absolute left-[80px] top-[141px] w-[217px] text-center font-display text-[40px] font-bold leading-[1.35] text-white">
        关注公众号
        <br />
        参与抽奖
      </h1>

      {/* 二维码 (52,280) 271×271。真实公众号码由运营在环境中配置，这里使用设计切片 */}
      <img
        src={SLICES.subscribeQr}
        alt="公众号二维码"
        className="absolute left-[52px] top-[280px] rounded-[8px] bg-white object-cover"
        style={{ width: 271, height: 271 }}
      />

      {/* 引导文字 (91,582.5) 193×49.5，色 #3A3A3A */}
      <p
        className="absolute left-[91px] top-[582px] w-[193px] text-center text-[18px] leading-[24px]"
        style={{ color: '#3A3A3A' }}
      >
        关注引力波智谱公众号
        <br />
        长按识别二维码关注
      </p>

      {/* 按钮 */}
      <div className="absolute left-[43px] top-[658px] w-[293px]">
        <ActionButton onClick={() => openView('follow-success')}>
          我已关注，立即验证
        </ActionButton>
      </div>
    </PageShell>
  );
}
