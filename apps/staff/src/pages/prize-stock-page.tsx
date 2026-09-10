import { useStaff } from '../lib/runtime';
import { AppShell } from './app-shell';

const DOT_CLASSES = [
  'bg-p1',
  'bg-p2',
  'bg-p3',
  'bg-p4',
  'bg-[#58afe8]',
  'bg-[#58afe8]',
];

/** 工作人员只读库存；运行中的库存调整仅允许管理员操作。 */
export function PrizeStockPage() {
  const { prizes } = useStaff();

  return (
    <AppShell>
      <main className="grid gap-3 px-4 pt-3 pb-6">
        {prizes.map((prize, index) => {
          const remaining = Math.max(0, prize.totalStock - prize.awardedStock);
          return (
            <article
              key={prize.id}
              className="flex min-h-[86px] items-start rounded-[12px] bg-white px-5 py-4 shadow-[0_3px_12px_rgba(30,37,62,0.035)]"
            >
              <span
                style={{ marginRight: '0.5rem' }}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] leading-none text-white ${
                  DOT_CLASSES[index % DOT_CLASSES.length]
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-normal text-ink">
                  {prize.name}
                </h2>
                <p className="mt-2.5 flex items-center gap-5 text-[14px] text-sub">
                  <span>
                    总数：
                    <strong className="font-normal text-ink">
                      {prize.totalStock}
                    </strong>
                  </span>
                  <span>
                    剩余：
                    <strong className="font-normal text-ink">
                      {remaining}
                    </strong>
                  </span>
                </p>
              </div>
            </article>
          );
        })}

        {prizes.length === 0 && (
          <div className="flex min-h-48 items-center justify-center rounded-[14px] bg-white text-[14px] text-weak">
            当前活动暂无奖品
          </div>
        )}
      </main>
    </AppShell>
  );
}
