import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageShell } from '../components/page-shell';
import { ScanFrame } from '../components/scan-frame';
import { useStaff } from '../lib/runtime';
import { isWechatBrowser, scanRedemptionCode } from '../lib/wechat-scan';

export function ScanPage() {
  const navigate = useNavigate();
  const { setCode } = useStaff();
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  const scan = useCallback(async () => {
    if (!isWechatBrowser()) {
      setError('请在微信中使用扫一扫，或手动输入兑奖码');
      return;
    }
    setScanning(true);
    setError('');
    try {
      const code = await scanRedemptionCode();
      if (!code) return;
      setCode(code);
      navigate('/redeem/confirm');
    } catch {
      setError('微信扫一扫调用失败，请重试或手动输入兑奖码');
    } finally {
      setScanning(false);
    }
  }, [navigate, setCode]);

  useEffect(() => {
    void scan();
  }, [scan]);

  return (
    <PageShell className="flex min-h-dvh flex-col bg-scan text-white">
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <p className="mb-8 text-[18px]">请扫描用户兑奖二维码</p>
        <button
          type="button"
          aria-label="调用微信扫一扫"
          onClick={() => void scan()}
          disabled={scanning}
          className="relative disabled:opacity-60"
        >
          <ScanFrame />
          <span className="absolute inset-5 flex items-center justify-center text-center text-[14px] leading-6 text-white/65">
            {scanning ? '正在打开微信扫一扫…' : '点击重新扫一扫'}
          </span>
        </button>
        {error && (
          <p
            role="alert"
            className="mt-6 text-center text-[14px] leading-relaxed text-[#ffd07f]"
          >
            {error}
          </p>
        )}
      </main>

      <div className="pb-10 text-center">
        <button
          type="button"
          onClick={() => navigate('/enter')}
          className="text-[16px] underline underline-offset-4"
        >
          手动输入兑奖码
        </button>
      </div>
    </PageShell>
  );
}
