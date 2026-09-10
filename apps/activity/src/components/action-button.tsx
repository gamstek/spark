import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement>;

/** 主胶囊按钮：292.5×58，18px 白字，品牌红底 */
export function ActionButton({ className = '', ...rest }: Props) {
  return (
    <button
      className={`block h-[58px] w-full max-w-[292.5px] rounded-full bg-brand text-[18px] text-white transition-opacity active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}
