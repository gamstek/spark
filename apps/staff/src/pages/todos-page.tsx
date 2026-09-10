import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ListRow } from '../components/list-row';
import { PageShell } from '../components/page-shell';
import { SLICES } from '../lib/assets';
import type { RedemptionStatus } from '../lib/api';
import { useStaff } from '../lib/runtime';

type Filter = 'ALL' | RedemptionStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'REDEEMED', label: '已核销' },
  { key: 'WAIT_REDEEM', label: '待核销' },
];

export function TodosPage() {
  const navigate = useNavigate();
  const { records } = useStaff();
  const [filter, setFilter] = useState<Filter>('ALL');
  const list = records.filter(
    (r) => filter === 'ALL' || r.status === filter,
  );

  return (
    <PageShell className="relative flex min-h-screen flex-col">
      {/* 页面背景图 */}
      <img
        src={SLICES.todos.bg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />

      <div className="relative flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-3 py-3">
          <button
            onClick={() => navigate('/')}
            className="h-6 w-6 text-ink/60"
            aria-label="返回"
          >
            ←
          </button>
          <span className="text-[18px] text-ink">我的待办</span>
          <span className="w-6" />
        </header>

        {/* 筛选 tab */}
        <div className="mx-3 flex h-[57px] items-center rounded-[12px] bg-[#E3E4E8] p-1">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-1 rounded-[10px] text-[18px] leading-none transition ${
                  active ? 'bg-white text-blue shadow-sm' : 'text-ink'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* 记录列表 */}
        <div className="flex-1 overflow-y-auto px-3 pb-6 pt-3">
          <div className="divide-y divide-line/60 rounded-[14px] bg-white p-2 shadow-sm">
            {list.map((record) => (
              <div
                key={record.id}
                className="py-2.5"
              >
                <ListRow record={record} />
              </div>
            ))}
            {list.length === 0 && (
              <p className="py-8 text-center text-[13px] text-sub">
                暂无记录
              </p>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
