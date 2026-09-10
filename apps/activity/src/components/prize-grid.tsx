interface PrizeItem {
  name: string;
  imageUrl?: string;
}

export function PrizeGrid({ prizes }: { prizes: PrizeItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-[10px] gap-y-6">
      {prizes.map((p) => (
        <div
          key={p.name}
          className="flex flex-col items-center"
        >
          <div className="flex h-[84px] w-full items-center justify-center rounded-[14px] bg-white/80">
            {p.imageUrl ? (
              <img
                src={p.imageUrl}
                alt={p.name}
                className="h-14 w-14 object-contain"
              />
            ) : (
              <span className="text-[28px] leading-none opacity-40">·</span>
            )}
          </div>
          <span className="mt-2 text-[15px] text-prize">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
