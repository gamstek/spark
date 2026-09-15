import type { PropsWithChildren } from 'react';

export function DialogActions({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={['dialog-actions', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
