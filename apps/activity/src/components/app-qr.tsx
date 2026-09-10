import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';

interface AppQrProps {
  /** 二维码承载的内容（核销链接 / 公众号码）。为空时展示占位网格 */
  value: string;
  size?: number;
}

function QrGrid({ value }: { value: string }) {
  const cells: ReactNode[] = [];
  // 占位伪二维码：用 value 的字符决定每个格子的明暗，确定性生成，便于复现
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

/** 白色圆角方片二维码容器（公众号码 / 核销码共用）。有内容时渲染真实二维码。 */
export function AppQr({ value, size = 158 }: AppQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!value) {
      setDataUrl(null);
      return;
    }
    QRCode.toDataURL(value, { width: 320, margin: 1 })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [value]);

  return (
    <div
      className="rounded-lg bg-white p-2 shadow"
      style={{ width: size, height: size }}
      title={value}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="二维码"
          className="h-full w-full"
        />
      ) : (
        <QrGrid value={value} />
      )}
    </div>
  );
}
