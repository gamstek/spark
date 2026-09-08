import { useDemoRuntime } from '../lib/runtime';
import { SLICES } from '../lib/assets';
import { PageShell } from '../components/page-shell';
import { ActionButton } from '../components/action-button';

/**
 * 抽奖中（LOTTERY / OUT_OF_STOCK）。
 * 视觉：轮盘盘面图(0,193) 375×376 + 盘心指针图(146,321) 85×100，
 * 奖品文字按设计稿坐标叠加在盘内；底部「立即抽奖」按钮(43,573) 293×58。
 * 背景浅灰 canvas。
 */
const PRIZE_LABELS = [
  { text: '小米充电宝', x: 150, y: 285, w: 78 },
  { text: '保温杯', x: 250, y: 315, w: 31 },
  { text: '手摇扇', x: 96, y: 316, w: 31 },
  { text: '定制手机支架', x: 245, y: 398, w: 43 },
  { text: '定制手提袋', x: 89, y: 406, w: 44 },
  { text: '定制笔记本', x: 150, y: 470, w: 75 },
];

export function LotteryPage() {
  const { go } = useDemoRuntime();

  return (
    <PageShell className="bg-canvas">
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
      {PRIZE_LABELS.map((p) => (
        <span
          key={p.text}
          className="absolute text-center text-[15px] leading-[18px] text-[#F53C3C]"
          style={{ left: p.x, top: p.y, width: p.w }}
        >
          {p.text}
        </span>
      ))}

      {/* 按钮：立即抽奖 (43,573) 293×58 */}
      <div className="absolute left-[43px] top-[573px] w-[293px]">
        <ActionButton onClick={() => go('PRIZE')}>立即抽奖</ActionButton>
      </div>
    </PageShell>
  );
}
