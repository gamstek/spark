import { useLocation, useNavigate } from 'react-router-dom';

import { ActionButton } from '../components/action-button';
import { PageShell } from '../components/page-shell';
import { SLICES } from '../lib/assets';
import { useStaff } from '../lib/runtime';

/**
 * 核销成功 / 已核销 结果页。设计稿参数（@1x 375×769）：
 *   页头「核销成功」(151,53) 18px
 *   白卡 (16,107) 343×497
 *   成功图标 (130,166.5) 118.5×118.5
 *   主标题 (114.5,295) 36px #4662D4 居中
 *   副文 (93.5,348) 18px #666
 *   详情三行 (43.5,419) 15px #666
 *   返回工作台按钮 (44.5,628) 286×51.5 红底白字
 */
export function RedeemSuccessPage() {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const { displayName } = useStaff();
  const already = pathname.includes('already');
  const assets = already ? SLICES.redeemAlready : SLICES.redeemSuccess;
  const redeemedAt =
    (state as { redeemedAt?: string | null } | null)?.redeemedAt ?? null;
  const timeText = redeemedAt ? new Date(redeemedAt).toLocaleString() : '—';

  return (
    <PageShell className="relative min-h-screen bg-canvas">
      {/* 页面背景图 */}
      <img
        src={assets.bg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />

      <div className="relative">
        <header className="pt-[53px] text-center text-[18px] text-ink">
          {already ? '已核销' : '核销成功'}
        </header>

        {/* 结果卡 (16,107) 343×497 */}
        <div className="absolute left-[16px] top-[107px] h-[497px] w-[343px] rounded-[12px] bg-white" />

        {/* 成功图标 (130,166.5) 118×118 */}
        <img
          src={assets.icon}
          alt=""
          className="absolute left-[130px] top-[166px] h-[118px] w-[118px] object-contain"
        />

        {/* 主标题 (114.5,295) 36px 居中 */}
        <h1 className="absolute left-[114px] top-[295px] w-[147px] text-center text-[36px] font-medium leading-[34.5px] text-blue2">
          {already ? '已核销' : '核销成功'}
        </h1>

        {/* 副文 (93.5,348) 18px */}
        <p className="absolute left-[93px] top-[348px] w-[187px] text-center text-[18px] leading-snug text-sub">
          {already
            ? `奖品已于 ${timeText} 完成核销`
            : '奖品已成功发送给用户'}
        </p>

        {/* 详情三行 (43.5,419) 15px */}
        <div className="absolute left-[43px] top-[419px] w-[228px] space-y-2 text-[15px] text-sub">
          <p>核销时间：{timeText}</p>
          <p>核销人员：{displayName}</p>
        </div>

        {/* 返回工作台 (44.5,628) 286×51.5 */}
        <div className="absolute left-[44px] top-[628px] w-[286px]">
          <ActionButton
            onClick={() => navigate('/')}
            className="w-full"
          >
            返回工作台
          </ActionButton>
        </div>
      </div>
    </PageShell>
  );
}
