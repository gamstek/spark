import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useStaff } from '../lib/runtime';
import { AppShell } from './app-shell';
import { SelectActivity } from './select-activity';

const menuItems = [
  { label: '中奖记录', to: '/todos', state: { filter: 'ALL' } },
  { label: '奖品库存', to: '/prizes' },
  { label: '活动规则', to: '/rules' },
] as const;

function ChevronRight() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-5 w-5 fill-none stroke-[#8b8b8b]"
    >
      <path
        d="m7 4 6 6-6 6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProfilePage() {
  const { displayName, logout, currentActivity, records } = useStaff();
  const [activitySheetOpen, setActivitySheetOpen] = useState(false);
  const pendingCount = records.filter(
    (record) => record.status === 'WAIT_REDEEM',
  ).length;

  return (
    <AppShell>
      <main className="px-4 pt-3 pb-8">
        <section className="flex min-h-[124px] items-center gap-4 rounded-[14px] bg-gradient-to-r from-[#7185ef] to-[#4561d5] px-4 py-4 text-white shadow-[0_8px_20px_rgba(69,97,213,0.16)]">
          <div className="flex h-[82px] w-[82px] shrink-0 items-center justify-center rounded-full border-[3px] border-white/80 bg-[#f2f4ff] text-[30px] font-semibold text-blue shadow-sm">
            {displayName.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-medium">{displayName}</p>
            <p className="mt-2 text-[14px] text-white/85">当前活动：</p>
            <button
              type="button"
              onClick={() => setActivitySheetOpen(true)}
              className="mt-1.5 flex h-10 w-full items-center justify-between gap-2 rounded-md border border-white/45 px-3 text-left text-[14px]"
            >
              <span className="truncate">
                {currentActivity?.name ?? '暂无可操作活动'}
              </span>
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rotate-45 border-r border-b border-white/80"
              />
            </button>
          </div>
        </section>

        <nav
          aria-label="个人工作菜单"
          className="mt-3 grid gap-2.5"
        >
          <Link
            to="/todos"
            state={{ filter: 'WAIT_REDEEM' }}
            className="flex h-[58px] items-center rounded-[12px] bg-white px-5 text-[15px] text-ink shadow-[0_3px_12px_rgba(30,37,62,0.035)]"
          >
            <span>我的待办</span>
            <span className="ml-1 text-brand">（{pendingCount}）</span>
            <span className="ml-auto">
              <ChevronRight />
            </span>
          </Link>
          {menuItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              state={'state' in item ? item.state : undefined}
              className="flex h-[58px] items-center rounded-[12px] bg-white px-5 text-[15px] text-ink shadow-[0_3px_12px_rgba(30,37,62,0.035)]"
            >
              {item.label}
              <span className="ml-auto">
                <ChevronRight />
              </span>
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-3 flex h-[58px] w-full items-center justify-center rounded-[12px] bg-white text-[15px] font-medium text-brand shadow-[0_3px_12px_rgba(30,37,62,0.035)] transition active:bg-[#fff3f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          退出登录
        </button>
      </main>

      <SelectActivity
        open={activitySheetOpen}
        onClose={() => setActivitySheetOpen(false)}
      />
    </AppShell>
  );
}
