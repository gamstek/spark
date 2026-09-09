import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/** mobile 375 宽容器，桌面居中，浅灰底；高度随内容自适应（列表可滚动）。 */
export function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <div className="flex min-h-screen justify-center bg-canvas">
      <div className={`w-full max-w-[375px] ${className}`}>{children}</div>
    </div>
  );
}
