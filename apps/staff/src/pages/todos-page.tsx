import { useState } from 'react';
import { useLocation } from 'react-router-dom';

import { ChildPageHeader } from '../components/child-page-header';
import { ListRow } from '../components/list-row';
import { PageShell } from '../components/page-shell';
import type { RedemptionStatus } from '../lib/api';
import { useStaff } from '../lib/runtime';

type Filter = 'ALL' | RedemptionStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'REDEEMED', label: '已核销' },
  { key: 'WAIT_REDEEM', label: '待核销' },
];

function initialFilter(state: unknown): Filter {
  if (!state || typeof state !== 'object' || !('filter' in state)) return 'ALL';
  const filter = state.filter;
  return filter === 'REDEEMED' || filter === 'WAIT_REDEEM' ? filter : 'ALL';
}

export function TodosPage() {
  const { records } = useStaff();
  const location = useLocation();
  const [filter, setFilter] = useState<Filter>(() =>
    initialFilter(location.state),
  );
  const list = records.filter(
    (record) => filter === 'ALL' || record.status === filter,
  );

  return (
    <PageShell className="flex min-h-dvh flex-col bg-canvas">
      <ChildPageHeader title="我的待办" />

      <div
        role="tablist"
        aria-label="核销记录筛选"
        className="mx-4 mt-3 flex h-[54px] shrink-0 items-center rounded-[12px] bg-[#e5e6eb] p-1"
      >
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(item.key)}
              className={`h-full flex-1 rounded-[10px] text-[17px] transition ${
                active ? 'bg-white font-medium text-blue shadow-sm' : 'text-ink'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <main className="mx-4 mt-3 mb-4 min-h-0 flex-1 overflow-y-auto rounded-[14px] bg-white px-2 py-2">
        <div className="divide-y divide-black/5">
          {list.map((record) => (
            <div
              key={record.id}
              className="py-2"
            >
              <ListRow record={record} />
            </div>
          ))}
        </div>
        {list.length === 0 && (
          <div className="flex min-h-48 items-center justify-center text-[14px] text-weak">
            暂无记录
          </div>
        )}
      </main>
    </PageShell>
  );
}
