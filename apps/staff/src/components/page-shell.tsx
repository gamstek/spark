import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

/** Mobile 430px container, centered on desktop; content can grow and scroll naturally. */
export function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <div className="flex min-h-dvh justify-center bg-canvas">
      <div className={`w-full max-w-[430px] ${className}`}>{children}</div>
    </div>
  );
}
