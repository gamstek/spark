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
    <div className="border-t border-line bg-white">
      <div className="flex items-center justify-around py-2">
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`flex flex-col items-center gap-1 ${isActive ? 'text-blue' : 'text-ink'}`}
            >
              <img
                src={t.img}
                alt=""
                className="h-[30px] w-[30px] object-contain"
              />
              <span className="text-[12px]">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
