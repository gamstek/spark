import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  className?: string;
  contentWidth?: 'standard' | 'wide';
}

/**
 * 移动端画布填满动态视口，并在较宽屏幕保持活动内容的宽度上限。
 * 桌面上居中，容器外为浅灰底。
 * 视觉来源由各页面自行组件化（CSS 背景 + 独立切图），不使用整页静态图。
 */
export function PageShell({
  children,
  className = '',
  contentWidth = 'standard',
}: PageShellProps) {
  return (
    <div className="flex min-h-dvh justify-center bg-canvas">
      <div
        className={`relative min-h-dvh w-full ${contentWidth === 'wide' ? 'max-w-[430px]' : 'max-w-[375px]'} overflow-hidden ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
