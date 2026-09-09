import { useRuntime } from '../lib/runtime';
import { SLICES } from '../lib/assets';
import { PageShell } from '../components/page-shell';
import { ActionButton } from '../components/action-button';

/**
 * 恭喜中奖（PRIZE 中奖结果）。坐标 @1x（375×769）：
 *   祝贺标题图(63,123) 250×95  +  奖品盒图(42,223) 291×290
 *   奖项文字(133,432) 116×51    按钮(43,543) 293×58
 * 背景为整页 bg.png（#F6F6F6 纯色兜底）。
 */
export function PrizePage() {
  const { win, go } = useRuntime();

  return (
    <PageShell className="bg-[#F6F6F6]">
      {/* 整页背景图（纯色 #F6F6F6 作为加载兜底） */}
      <img
        src={SLICES.prizeBg}
        alt=""
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-full object-cover"
      />
      {/* 祝贺标题图「恭喜中奖」 */}
      <img
        src={SLICES.prizeCongratsTitle}
        alt="恭喜中奖"
        className="absolute left-[63px] top-[123px] h-[95px] w-[250px] object-contain"
      />

      {/* 奖品礼盒图 */}
      <img
        src={SLICES.prizeGiftBox}
        alt="奖品"
        className="absolute left-[42px] top-[223px] h-[290px] w-[291px] object-cover"
      />

      {/* 奖项文字 */}
      <p className="absolute left-[133px] top-[432px] w-[116px] text-center text-[18px] leading-[25px] text-win">
        {win?.prizeName}
      </p>

      {/* 按钮：查看奖品 (43,543) 293×58 */}
      <div className="absolute left-[43px] top-[543px] w-[293px]">
        <ActionButton onClick={() => go('REDEEMED')}>查看奖品</ActionButton>
      </div>
    </PageShell>
  );
}
