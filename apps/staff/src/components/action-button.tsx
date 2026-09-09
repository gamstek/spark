import type { ReactNode } from 'react';

interface ActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  /** primary:红底白字；danger-outline:红字红框；secondary:蓝字白底蓝框 */
  variant?: 'primary' | 'danger-outline' | 'secondary';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}

export function ActionButton({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled = false,
}: ActionButtonProps) {
  const base =
    'flex h-[51.5px] items-center justify-center rounded-[12px] text-[18px] font-medium disabled:cursor-not-allowed disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-brand text-white'
      : variant === 'danger-outline'
        ? 'border border-[#CA1D1D] text-[#CA1D1D]'
        : 'border border-blue text-blue';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
