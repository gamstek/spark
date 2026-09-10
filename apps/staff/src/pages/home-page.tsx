import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ActivityCard } from '../components/activity-card';
import { ListRow } from '../components/list-row';
import { StatCard } from '../components/stat-card';
import { SLICES } from '../lib/assets';
import { useStaff } from '../lib/runtime';
import { AppShell } from './app-shell';
import { SelectActivity } from './select-activity';

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { currentActivity, prizes, records } = useStaff();
  const [sheetOpen, setSheetOpen] = useState(false);

  const todayRedeemed = records.filter(
    (r) => r.status === 'REDEEMED' && r.redeemedAt && isToday(r.redeemedAt),
  ).length;
  const pending = records.filter((r) => r.status === 'WAIT_REDEEM').length;
  const remaining = prizes.reduce(
    (sum, prize) => sum + (prize.totalStock - prize.awardedStock),
    0,
  );
  const stats = [
    {
      label: '今日核销',
      value: String(todayRedeemed),
      unit: '笔',
      img: SLICES.home.statToday,
    },
    {
      label: '待兑奖',
      value: String(pending),
      unit: '份',
      img: SLICES.home.statPending,
    },
    {
      label: '剩余奖品',
      value: String(remaining),
      unit: '份',
      img: SLICES.home.statStock,
    },
  ];
  const recentRecords = records
    .filter((record) => record.status === 'REDEEMED')
    .slice(0, 3);

  return (
    <AppShell>
      <div className="px-4 pt-3 pb-5">
        {/* 当前活动卡（点击切换活动） */}
        <button
          onClick={() => setSheetOpen(true)}
          className="block w-full"
        >
          <ActivityCard activity={currentActivity} />
        </button>

        {/* 三列统计 */}
        <div className="mt-3">
          <StatCard items={stats} />
        </div>

        {/* 核销入口 */}
        <div className="mt-3 grid gap-3.5">
          <button
            onClick={() => navigate('/scan')}
            className="flex h-[96px] items-center gap-4 rounded-[14px] bg-gradient-to-r from-[#687ff2] to-[#4561d5] px-8 text-left text-white shadow-[0_8px_18px_rgba(69,97,213,0.16)]"
          >
            <img
              src={SLICES.home.scan}
              alt=""
              className="h-14 w-14 shrink-0 object-contain"
            />
            <span>
              <span className="block text-[23px] leading-none">扫一扫兑奖</span>
              <span className="mt-2 block text-[13px] text-white/85">
                扫描用户兑奖码，快速核销兑奖
              </span>
            </span>
          </button>

          <button
            onClick={() => navigate('/enter')}
            className="flex h-[96px] items-center gap-4 rounded-[14px] bg-white px-8 text-left text-blue shadow-[0_4px_14px_rgba(28,40,82,0.04)]"
          >
            <img
              src={SLICES.home.manual}
              alt=""
              className="h-14 w-14 shrink-0 object-contain"
            />
            <span>
              <span className="block text-[23px] leading-none">
                手动输入兑奖码
              </span>
              <span className="mt-2 block text-[13px] text-blue/75">
                输入兑奖码，手动核销兑奖
              </span>
            </span>
          </button>
        </div>

        {/* 最近核销记录 */}
        <section className="mt-3 rounded-[14px] bg-white px-4 py-4 shadow-[0_4px_14px_rgba(28,40,82,0.04)]">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-medium text-ink">最近核销记录</h2>
            <button
              onClick={() => navigate('/todos')}
              className="text-[12px] text-sub"
            >
              查看全部&nbsp; &gt;
            </button>
          </div>
          <div className="divide-y divide-line/60">
            {recentRecords.map((record) => (
              <div
                key={record.id}
                className="py-2.5"
              >
                <ListRow record={record} />
              </div>
            ))}
            {recentRecords.length === 0 && (
              <p className="py-4 text-center text-[13px] text-sub">
                暂无核销记录
              </p>
            )}
          </div>
        </section>
      </div>

      <SelectActivity
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </AppShell>
  );
}
