import { useRuntime } from '../lib/runtime';
import { SLICES } from '../lib/assets';
import { PageShell } from '../components/page-shell';
import { ActionButton } from '../components/action-button';

/**
 * 抽奖中（LOTTERY / OUT_OF_STOCK）。
 * 视觉：轮盘盘面图(0,193) 375×376 + 盘心指针图(146,321) 85×100，
 * 奖品名称由活动信息接口返回，按设计稿坐标叠加在盘内；底部「立即抽奖」按钮(43,573) 293×58。
 * 背景浅灰 canvas。
 */
const PRIZE_SLOTS = [
  { x: 150, y: 285, w: 78 },
  { x: 250, y: 315, w: 78 },
  { x: 96, y: 316, w: 78 },
  { x: 245, y: 398, w: 78 },
  { x: 89, y: 406, w: 78 },
  { x: 150, y: 470, w: 78 },
];

export function LotteryPage() {
  const { activity, step, draw, drawing } = useRuntime();
  const soldOut = step === 'OUT_OF_STOCK';

  return (
    <PageShell className="bg-canvas">
      {/* 整页背景图 */}
      <img
        src={SLICES.lotteryBg}
        alt=""
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-full object-cover"
      />
      {/* 轮盘盘面 */}
      <img
        src={SLICES.lotteryWheelFace}
        alt="抽奖转盘"
        className="absolute left-0 top-[193px] h-[376px] w-[375px] object-cover"
      />

      {/* 轮盘中心指针 */}
      <img
        src={SLICES.lotteryWheelCenter}
        alt="转盘中心"
        className="absolute left-[146px] top-[321px] h-[100px] w-[85px] object-contain"
      />

      {/* 盘内奖品文字标签（覆盖在盘面上） */}
      {activity.prizes.slice(0, PRIZE_SLOTS.length).map((prize, index) => (
        <span
          key={`${prize.name}-${index}`}
          className="absolute text-center text-[15px] leading-[18px] text-[#F53C3C]"
          style={{
            left: PRIZE_SLOTS[index]!.x,
            top: PRIZE_SLOTS[index]!.y,
            width: PRIZE_SLOTS[index]!.w,
          }}
        >
          {prize.name}
        </span>
      ))}

      {/* 按钮：立即抽奖 (43,573) 293×58 */}
      <div className="absolute left-[43px] top-[573px] w-[293px]">
        <ActionButton
          onClick={() => void draw()}
          disabled={drawing || soldOut}
        >
          {soldOut ? '奖品已抽完' : drawing ? '抽奖中…' : '立即抽奖'}
        </ActionButton>
      </div>
    </PageShell>
  );
}
