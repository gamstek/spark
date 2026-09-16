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
    <div className="min-h-dvh bg-canvas">
      <div
        className={`relative mx-auto w-full ${contentWidth === 'wide' ? 'min-h-dvh max-w-[430px]' : 'page-shell-artboard max-w-[375px]'} overflow-hidden ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
