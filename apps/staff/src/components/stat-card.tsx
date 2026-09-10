interface StatItem {
  label: string;
  value: string;
  /** 45×45 图标切图 URL */
  img: string;
}

export function StatCard({ items }: { items: StatItem[] }) {
  return (
    <div className="flex items-center rounded-[14px] bg-white p-3 shadow-sm">
      {items.map((it, i) => (
        <div
          key={it.label}
          className="relative flex flex-1 flex-col items-center gap-1"
        >
          <img
            src={it.img}
            alt={it.label}
            className="h-[45px] w-[45px] object-contain"
          />
          <span className="text-[14px] text-ink">{it.label}</span>
          <span className="text-[24px] leading-none text-blue">{it.value}</span>
          {i < items.length - 1 && (
            <div className="absolute right-0 top-1/2 h-[92px] w-px -translate-y-1/2 bg-[#ADADAD]" />
          )}
        </div>
      ))}
    </div>
  );
}
