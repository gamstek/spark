import { ActionButton } from './action-button';

interface SelectSheetProps {
  title: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function SelectSheet({
  title,
  options,
  value,
  onChange,
  onConfirm,
  onClose,
}: SelectSheetProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[375px] rounded-t-[16px] bg-white px-4 pb-6 pt-4">
        <p className="text-[15px] text-ink">{title}</p>
        <div className="mt-3 flex items-center rounded-[10px] border border-[#CFD3D9] bg-[#FBFBFB] px-3 py-2.5">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent text-[15px] text-ink outline-none"
          >
            {options.map((o) => (
              <option
                key={o.value}
                value={o.value}
              >
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <ActionButton
          onClick={onConfirm}
          className="mt-5 h-[58px] w-full"
        >
          确认
        </ActionButton>
      </div>
    </div>
  );
}
