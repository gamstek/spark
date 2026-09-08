import { useDemoRuntime } from '../lib/runtime';
import { REDEMPTION } from '../lib/redemption';
import { PageShell } from '../components/page-shell';
import { StatusTag } from '../components/status-tag';
import { AppQr } from '../components/app-qr';

/**
 * 我的奖品（REDEEMED / EXPIRED）。坐标 @1x（375x769）：
 *   标题(151,53)  获奖卡(16,107) 343x207  状态标签(179,267) 55x21
 *   兑奖卡(16,327) 343x332  兑奖码(137,374)  QR(109,445) 158x158
 * 背景浅灰 canvas。
 */
export function RedemptionPage() {
  const { win } = useDemoRuntime();

  return (
    <PageShell className="bg-canvas">
      {/* 标题 */}
      <header className="absolute inset-x-0 top-[53px] text-center text-[18px] text-ink">
        我的奖品
      </header>

      {/* 获奖卡片 (16,107) 343×207 */}
      <div className="absolute left-[16px] top-[107px] h-[207px] w-[343px] rounded-[12px] bg-white">
        <p className="absolute left-[199px] top-[154px] w-[108px] text-[18px] leading-[24px] text-ink">
          {win.levelName}
          <br />
          {win.prizeName}
        </p>
        <span className="absolute left-[134px] top-[272px] text-[15px] text-ink">
          状态：
        </span>
        <span className="absolute left-[179px] top-[267px]">
          <StatusTag status={win.redemptionStatus} />
        </span>
      </div>

      {/* 兑奖凭证卡 (16,327) 343×332 */}
      <div className="absolute left-[16px] top-[327px] h-[332px] w-[343px] rounded-[12px] bg-white">
        <p className="absolute left-[137px] top-[374px] w-[103px] text-center text-[18px] leading-[26px] text-ink">
          兑奖码 {REDEMPTION.code}
        </p>
        <div className="absolute left-[109px] top-[445px]">
          <AppQr
            value={REDEMPTION.qrContent}
            size={158}
          />
        </div>
        <p className="absolute left-[90px] top-[674px] w-[195px] text-center text-[15px] text-sub">
          {REDEMPTION.claimHint}
        </p>
      </div>
    </PageShell>
  );
}
