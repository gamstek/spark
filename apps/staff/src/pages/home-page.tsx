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
    { label: '今日核销', value: String(todayRedeemed), img: SLICES.home.statToday },
    { label: '待兑奖', value: String(pending), img: SLICES.home.statPending },
    { label: '剩余奖品', value: String(remaining), img: SLICES.home.statStock },
  ];
  const recentRecords = records.slice(0, 3);

  return (
    <AppShell>
      <div className="px-3 pb-4">
        <header className="py-3 text-center text-[18px] text-ink">
          工作人员工作台
        </header>

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
        <div className="mt-3 grid gap-3">
          <button
            onClick={() => navigate('/scan')}
            className="flex items-center gap-4 rounded-[14px] bg-gradient-to-b from-[#4360D1] to-[#3a4fb0] px-4 py-3 text-left text-white"
          >
            <img
              src={SLICES.home.scan}
              alt=""
              className="h-12 w-12 shrink-0 object-contain"
            />
            <span>
              <span className="block text-[24px] leading-none">扫一扫兑奖</span>
              <span className="mt-2 block text-[12px] text-white/85">
                扫描用户兑奖二维码
              </span>
            </span>
            <span className="ml-auto text-[22px] text-white/70">›</span>
          </button>

          <button
            onClick={() => navigate('/enter')}
            className="flex items-center gap-4 rounded-[14px] border border-line bg-white px-4 py-3 text-left text-blue"
          >
            <img
              src={SLICES.home.manual}
              alt=""
              className="h-12 w-12 shrink-0 object-contain"
            />
            <span>
              <span className="block text-[24px] leading-none">
                手动输入兑奖码
              </span>
              <span className="mt-2 block text-[12px] text-blue/75">
                手工录入兑奖码核销
              </span>
            </span>
            <span className="ml-auto text-[22px] text-blue">›</span>
          </button>
        </div>

        {/* 最近核销记录 */}
        <div className="mt-3 rounded-[14px] bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] text-ink">最近记录</span>
            <button
              onClick={() => navigate('/todos')}
              className="text-[12px] text-sub"
            >
              查看全部 &gt;
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
        </div>
      </div>

      <SelectActivity
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </AppShell>
  );
}
