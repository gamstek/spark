import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * 移动端 375 宽画布，以蓝湖设计稿的 769px 为最小高度，并延伸到完整视口。
 * 桌面上居中，容器外为浅灰底。
 * 视觉来源由各页面自行组件化（CSS 背景 + 独立切图），不使用整页静态图。
 */
export function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <div className="flex min-h-screen justify-center bg-canvas">
      <div
        className={`relative h-[769px] min-h-dvh w-full max-w-[375px] overflow-hidden ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
