import { SLICES } from '../lib/assets';
import { useStaff } from '../lib/runtime';
import { AppShell } from './app-shell';

const DOT_CLASSES = ['bg-p1', 'bg-p2', 'bg-p3', 'bg-p4'];

/** 奖品查看（只读）：库存由管理后台维护，工作人员现场只查看剩余数量。 */
export function PrizeStockPage() {
  const { prizes } = useStaff();

  return (
    <AppShell bg={SLICES.prizeStock.bg}>
      <div className="px-3 pb-4">
        <header className="py-3 text-center text-[18px] text-ink">
          奖品查看
        </header>
        <div className="mb-2 flex items-center px-2 text-[14px] text-ink">
          <span className="flex-1">奖品</span>
          <span>剩余/总量</span>
        </div>
        <div className="divide-y divide-line/60 overflow-hidden rounded-[12px]">
          {prizes.map((prize, i) => (
            <div
              key={prize.id}
              className="flex items-center gap-3 bg-white px-3 py-3"
            >
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${DOT_CLASSES[i % DOT_CLASSES.length]} text-[12px] leading-none text-white`}
              >
                {i + 1}
              </div>
              <p className="min-w-0 flex-1 truncate text-[15px] text-ink">
                {prize.name}
              </p>
              <span className="shrink-0 text-[15px] text-ink">
                {prize.totalStock - prize.awardedStock}/{prize.totalStock}
              </span>
            </div>
          ))}
          {prizes.length === 0 && (
            <p className="bg-white py-8 text-center text-[13px] text-sub">
              当前活动暂无奖品
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
