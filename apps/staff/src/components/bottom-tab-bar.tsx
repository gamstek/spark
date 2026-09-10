import type { TabKey } from '../lib/runtime';
import { SLICES } from '../lib/assets';

const TABS: { key: TabKey; label: string; img: string }[] = [
  { key: 'home', label: '首页', img: SLICES.home.tabHome },
  { key: 'prizes', label: '奖品管理', img: SLICES.home.tabPrizes },
  { key: 'profile', label: '我的', img: SLICES.home.tabProfile },
];

interface BottomTabBarProps {
  active: TabKey;
  onChange: (key: TabKey) => void;
}

export function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  return (
    <nav
      aria-label="工作人员平台主导航"
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-[375px] -translate-x-1/2 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(25,28,38,0.05)] backdrop-blur"
    >
      <div className="flex h-[74px] items-center justify-around">
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`relative flex min-h-14 min-w-20 flex-col items-center justify-center gap-1 ${isActive ? 'text-brand' : 'text-ink'}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <img
                src={t.img}
                alt=""
                className="h-[30px] w-[30px] object-contain"
              />
              <span className="text-[13px]">{t.label}</span>
              {isActive && (
                <span className="absolute -top-2 h-0.5 w-7 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
