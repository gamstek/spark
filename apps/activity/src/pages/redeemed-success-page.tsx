import { useDemoRuntime } from '../lib/runtime';
import { SLICES } from '../lib/assets';
import { PageShell } from '../components/page-shell';

/**
 * 核销成功（完成态；staff 场景按钮文案待确认）。坐标 @1x（375x769）：
 *   标题(151,53) 71x18  白卡(16,107) 343x497
 *   成功图标(130,167) 119x119  大字(115,295) 147x35
 *   副文(94,348) 187x18  核销信息(44,419) 228x68  按钮(45,628) 286x52
 * 背景：redeemed-success/bg.png 铺满整页。
 */
export function RedeemedSuccessPage() {
  const { closeView } = useDemoRuntime();

  return (
    <PageShell className="bg-canvas">
      {/* 整页背景图 */}
      <img
        src={SLICES.redeemedSuccessBg}
        alt=""
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-full object-cover"
      />
      {/* 标题 */}
      <header className="absolute inset-x-0 top-[53px] text-center text-[18px] text-ink">
        核销成功
      </header>

      {/* 白色卡片 (16,107) 343×497 */}
      <div className="absolute left-[16px] top-[107px] h-[497px] w-[343px] rounded-[12px] bg-white">
        {/* 成功图标 */}
        <img
          src={SLICES.redeemedSuccessIcon}
          alt="核销成功"
          className="absolute left-[130px] top-[167px] h-[119px] w-[119px] object-contain"
        />

        {/* 大字：核销成功 */}
        <h1 className="absolute left-[115px] top-[295px] w-[147px] text-center font-display text-[36px] font-medium text-win2">
          核销成功
        </h1>

        {/* 副文 */}
        <p className="absolute left-[94px] top-[348px] w-[187px] text-center text-[18px] text-sub">
          奖品已成功发送给用户
        </p>

        {/* 核销信息 */}
        <dl className="absolute left-[44px] top-[419px] w-[228px] space-y-2 text-[15px] leading-[22px] text-sub">
          <div className="flex">
            <dt className="shrink-0">核销时间：</dt>
            <dd>2026.09.14 - 09.16</dd>
          </div>
          <div className="flex">
            <dt className="shrink-0">核销人员：</dt>
            <dd>王**</dd>
          </div>
          <div className="flex">
            <dt className="shrink-0">核销点：</dt>
            <dd>展台</dd>
          </div>
        </dl>
      </div>

      {/* 按钮：返回工作台 (45,628) 286×52 */}
      <button
        type="button"
        onClick={closeView}
        className="absolute left-[45px] top-[628px] h-[52px] w-[286px] rounded-full bg-brand text-[18px] text-white active:opacity-90"
      >
        返回工作台
      </button>
    </PageShell>
  );
}
