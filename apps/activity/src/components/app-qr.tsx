import type { ReactNode } from 'react';

interface AppQrProps {
  /** 二维码承载的内容（Demo 中无真实码，用伪网格占位） */
  value: string;
  size?: number;
}

function QrGrid({ value }: { value: string }) {
  const cells: ReactNode[] = [];
  // 伪二维码：用 value 的字符决定每个格子的明暗，确定性生成，便于复现
  for (let i = 0; i < 21 * 21; i++) {
    const ch = (i % 21) + Math.floor(i / 21);
    const on =
      i < value.length ? value.charCodeAt(i) % 3 !== 0 : (ch * ch) % 3 !== 0;
    cells.push(
      <rect
        key={i}
        x={(i % 21) * 4}
        y={Math.floor(i / 21) * 4}
        width="4"
        height="4"
        fill={on ? '#333' : 'transparent'}
      />,
    );
  }
  return (
    <svg
      viewBox="0 0 84 84"
      className="h-full w-full"
      aria-hidden="true"
    >
      {cells}
    </svg>
  );
}

/** 白色圆角方片二维码容器（公众号码 / 核销码共用） */
export function AppQr({ value, size = 158 }: AppQrProps) {
  return (
    <div
      className="rounded-lg bg-white p-2 shadow"
      style={{ width: size, height: size }}
      title={value}
    >
      <QrGrid value={value} />
    </div>
  );
}
