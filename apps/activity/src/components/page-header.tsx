interface PageHeaderProps {
  title: string;
  onBack: () => void;
  position?: 'absolute' | 'sticky';
}

export function PageHeader({
  title,
  onBack,
  position = 'absolute',
}: PageHeaderProps) {
  return (
    <header
      className={`${position} inset-x-0 top-0 z-20 grid h-14 grid-cols-[48px_minmax(0,1fr)_48px] items-center border-b border-black/[0.06] bg-white/95 px-2 text-ink backdrop-blur-sm`}
    >
      <button
        type="button"
        aria-label="返回"
        className="flex size-11 items-center justify-center text-[32px] leading-none font-light active:opacity-60"
        onClick={onBack}
      >
        ‹
      </button>
      <h1 className="truncate text-center text-[18px] font-medium">{title}</h1>
    </header>
  );
}
