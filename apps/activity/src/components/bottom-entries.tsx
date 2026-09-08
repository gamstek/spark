import { SLICES } from '../lib/assets';

interface EntryDef {
  key: string;
  label: string;
  icon: string;
  onClick?: () => void;
}

interface BottomEntriesProps {
  onRules?: () => void;
  onInfo?: () => void;
  onPrize?: () => void;
}

export function BottomEntries({
  onRules,
  onInfo,
  onPrize,
}: BottomEntriesProps) {
  const homeIcons = Array.isArray(SLICES.homeIcon) ? SLICES.homeIcon : [];
  const entries: EntryDef[] = [
    {
      key: 'rules',
      label: '活动规则',
      icon: homeIcons[0] ?? '',
      onClick: onRules,
    },
    {
      key: 'info',
      label: '活动说明',
      icon: homeIcons[1] ?? '',
      onClick: onInfo,
    },
    {
      key: 'prize',
      label: '我的奖品',
      icon: homeIcons[2] ?? '',
      onClick: onPrize,
    },
  ];

  return (
    <div className="flex w-full items-stretch justify-around border-t border-line bg-white/70 pt-2">
      {entries.map((e) => (
        <button
          key={e.key}
          type="button"
          onClick={e.onClick}
          className="flex w-1/3 flex-col items-center gap-2 py-2 text-ink"
        >
          <span className="flex h-10 w-10 items-center justify-center">
            {e.icon ? (
              <img
                src={e.icon}
                alt={e.label}
                className="h-10 w-10 object-contain"
              />
            ) : null}
          </span>
          <span className="text-[12px]">{e.label}</span>
        </button>
      ))}
    </div>
  );
}
