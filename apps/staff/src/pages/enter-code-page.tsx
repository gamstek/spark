import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ActionButton } from '../components/action-button';
import { PageShell } from '../components/page-shell';
import { useStaff } from '../lib/runtime';

export function EnterCodePage() {
  const navigate = useNavigate();
  const { code, setCode } = useStaff();
  const [error, setError] = useState('');

  const next = () => {
    if (!code.trim()) {
      setError('请输入兑奖码');
      return;
    }
    setError('');
    navigate('/redeem/confirm');
  };

  return (
    <PageShell className="flex min-h-screen flex-col bg-scan text-white">
      <header className="flex items-center justify-between px-3 py-3">
        <button
          onClick={() => navigate('/')}
          className="h-6 w-6 text-white/70"
          aria-label="返回"
        >
          ←
        </button>
        <span className="text-[18px]">输入兑奖码</span>
        <span className="w-6" />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') next();
          }}
          placeholder="请输入兑奖码"
          className="h-[50px] w-full rounded-[10px] bg-white px-4 text-[18px] text-ink outline-none placeholder:text-[15px] placeholder:text-sub"
        />
        {error && <p className="mt-2 text-[13px] text-[#FFD07F]">{error}</p>}
        <p className="mt-3 text-[15px] text-white/70">扫描用户兑奖二维码</p>
        <ActionButton
          onClick={next}
          className="mt-8 w-full"
        >
          下一步
        </ActionButton>
      </div>
    </PageShell>
  );
}
