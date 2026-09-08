import { useDemoRuntime } from '../lib/runtime';
import { INFO_PRIZES } from '../lib/prizes';
import { PageShell } from '../components/page-shell';

/** 活动说明（首页「活动说明」入口子页）。坐标 @1x（375×769）。背景浅灰。 */
export function ActivityInfoPage() {
  const { activity, closeView } = useDemoRuntime();
  // 6 行奖品卡 y 起点（每行 57 高、6px 间距）
  const ROW_TOP = [152, 217, 282, 347, 412, 477];

  return (
    <PageShell className="bg-canvas">
      {/* 头部：标题 + 关闭 */}
      <div className="absolute inset-x-0 top-[53px] flex items-center justify-between px-2">
        <span className="mx-auto text-[18px] text-ink">活动说明</span>
        <button
          type="button"
          onClick={closeView}
          className="-ml-8 text-[14px] text-ink"
          aria-label="返回"
        >
          ✕
        </button>
      </div>

      {/* 奖品介绍标题 */}
      <h2 className="absolute left-[16px] top-[118px] text-[18px] text-ink">
        奖品介绍
      </h2>

      {/* 6 行奖品卡 */}
      {INFO_PRIZES.map((p, i) => (
        <div
          key={p.rank}
          className="absolute left-[16px] h-[57px] w-[343px] rounded-[8px] bg-white"
          style={{ top: ROW_TOP[i] }}
        >
          <span className="absolute left-[31px] top-[18px] flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[12px] text-white">
            {p.rank}
          </span>
          <span className="absolute left-[56px] top-[21px] text-[15px] text-ink">
            奖品
          </span>
          <span className="absolute right-[30px] top-[21px] text-right text-[15px] text-ink">
            {p.name}
          </span>
        </div>
      ))}

      {/* 活动时间 */}
      <h2 className="absolute left-[15px] top-[556px] text-[18px] text-ink">
        活动时间
      </h2>
      <p className="absolute left-[17px] top-[596px] text-[15px] text-ink">
        2026年9月14日 — 9月16日
      </p>

      {/* 活动规则 / 提示 */}
      <h2 className="absolute left-[16px] top-[641px] text-[18px] text-ink">
        活动规则
      </h2>
      <p className="absolute left-[16px] top-[681px] w-[263px] text-[15px] text-ink">
        {activity.rulesText}
      </p>
    </PageShell>
  );
}
