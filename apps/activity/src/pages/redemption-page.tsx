import { useRuntime } from '../lib/runtime';
import { PageShell } from '../components/page-shell';
import { StatusTag } from '../components/status-tag';
import { AppQr } from '../components/app-qr';

/**
 * 我的奖品（REDEEMED / EXPIRED）。坐标 @1x（375x769）：
 *   标题(151,53)  获奖卡(16,107) 343x207  状态(133,272) 标签(178,267)
 *   兑奖卡(16,327) 343x332  兑奖码(136,374)  QR(109,445) 158x158
 *   请出示(90,674)。元素均用页面级绝对坐标，与设计稿 @1x 一致。
 * 背景浅灰 canvas。
 */
export function RedemptionPage() {
  const { win, prizeCode } = useRuntime();

  return (
    <PageShell className="bg-canvas">
      {/* 标题 (151,53) */}
      <header className="absolute inset-x-0 top-[53px] text-center text-[18px] text-ink">
        我的奖品
      </header>

      {/* 获奖卡背景 (16,107) 343×207 */}
      <div className="absolute left-[16px] top-[107px] h-[207px] w-[343px] rounded-[12px] bg-white" />

      {/* 奖品图 (35.5,131) 145×119；无图时灰色占位 */}
      {win?.prizeImageUrl ? (
        <img
          src={win.prizeImageUrl}
          alt={win.prizeName}
          className="absolute left-[35px] top-[131px] h-[119px] w-[145px] rounded-[6px] bg-[#DFDDD4] object-cover"
        />
      ) : (
        <div className="absolute left-[35px] top-[131px] h-[119px] w-[145px] rounded-[6px] bg-[#DFDDD4]" />
      )}

      {/* 奖项 (199,154) 108×49.5 18px 两行 */}
      <p className="absolute left-[199px] top-[154px] w-[108px] text-[18px] leading-[25px] text-ink">
        奖品
        <br />
        {win?.prizeName}
      </p>

      {/* 状态： (133.5,272) 15px */}
      <span className="absolute left-[133px] top-[272px] text-[15px] text-ink">
        状态：
      </span>

      {/* 状态标签 (178.5,267) 55×21 */}
      <span className="absolute left-[178px] top-[267px]">
        {win && <StatusTag status={win.redemptionStatus} />}
      </span>

      {/* 兑奖卡背景 (16,327) 343×332 */}
      <div className="absolute left-[16px] top-[327px] h-[332px] w-[343px] rounded-[12px] bg-white" />

      {/* 兑奖码 (136.5,374) 102.5×52 18px 居中 两行 */}
      <p className="absolute left-[136px] top-[374px] w-[103px] text-center text-[18px] leading-[26px] text-ink">
        兑奖码
        <br />
        {prizeCode?.code ?? '—'}
      </p>

      {/* 二维码 (109,445) 158×158 */}
      <div className="absolute left-[109px] top-[445px]">
        <AppQr
          value={prizeCode?.qrUrl ?? ''}
          size={158}
        />
      </div>

      {/* 请出示二维码给工作人员核销 (90,674) 15px 居中 */}
      <p className="absolute left-[90px] top-[674px] w-[195px] text-center text-[15px] leading-none text-sub">
        请出示二维码给工作人员核销
      </p>
    </PageShell>
  );
}
