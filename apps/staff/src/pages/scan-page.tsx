import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageShell } from '../components/page-shell';
import { ScanFrame } from '../components/scan-frame';
import {
  extractRedemptionCode,
  startQrScanner,
  type QrScannerSession,
  type ScannerFailure,
} from '../lib/qr-scanner';
import { useStaff } from '../lib/runtime';

const failureMessages: Record<ScannerFailure, string> = {
  UNSUPPORTED: '当前浏览器无法打开相机，请使用 HTTPS 页面或手动输入兑奖码。',
  PERMISSION_DENIED:
    '未获得相机权限，请在浏览器设置中允许相机访问，再重新扫描。',
  NO_CAMERA: '未找到可用相机，请检查设备相机后重试，或手动输入兑奖码。',
  CAMERA_BUSY: '相机暂时无法使用，请关闭其他使用相机的应用或页面后重试。',
  SCAN_FAILED: '二维码识别中断，请重新扫描，或手动输入兑奖码。',
};

type ScanState = 'starting' | 'scanning' | 'error' | 'paused';

export function ScanPage() {
  const navigate = useNavigate();
  const { setCode } = useStaff();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<QrScannerSession | null>(null);
  const pendingRef = useRef<Promise<void> | null>(null);
  const generationRef = useRef(0);
  const handledRef = useRef(false);
  const [state, setState] = useState<ScanState>('starting');
  const [error, setError] = useState('');

  const stop = useCallback((video = videoRef.current) => {
    generationRef.current += 1;
    sessionRef.current?.stop();
    sessionRef.current = null;
    // Initialization may attach a stream before it returns its controls.
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const scan = useCallback(() => {
    stop();
    const generation = generationRef.current;
    handledRef.current = false;
    setState('starting');
    setError('');
    const run = async () => {
      // Close a late session before another attempt uses this video element.
      await pendingRef.current;
      if (generation !== generationRef.current) return;
      if (document.visibilityState === 'hidden') {
        setState('paused');
        return;
      }
      if (window.isSecureContext === false) {
        setError(failureMessages.UNSUPPORTED);
        setState('error');
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      let pendingCode: string | undefined;
      const fail = (failure: ScannerFailure) => {
        if (generation !== generationRef.current) return;
        stop();
        setError(failureMessages[failure]);
        setState('error');
      };
      const finish = (code: string) => {
        stop();
        setCode(code);
        navigate('/redeem/confirm');
      };
      try {
        const session = await startQrScanner(
          video,
          (raw) => {
            if (generation !== generationRef.current || handledRef.current)
              return;
            const code = extractRedemptionCode(raw);
            handledRef.current = true;
            if (!code) {
              // The adapter stops after any decoded QR, including an empty code.
              // Invalidate this attempt so late initialization cannot resume it.
              stop();
              setError(
                '二维码未包含兑奖码，请重新扫描用户兑奖二维码，或手动输入兑奖码。',
              );
              setState('error');
              return;
            }
            if (sessionRef.current) finish(code);
            else pendingCode = code;
          },
          undefined,
          fail,
        );
        if (generation !== generationRef.current) {
          session.stop();
          return;
        }
        sessionRef.current = session;
        if (pendingCode !== undefined) finish(pendingCode);
        else setState('scanning');
      } catch (failure) {
        if (generation !== generationRef.current) return;
        const normalizedFailure =
          typeof failure === 'string' && Object.hasOwn(failureMessages, failure)
            ? (failure as ScannerFailure)
            : 'SCAN_FAILED';
        fail(normalizedFailure);
      }
    };
    pendingRef.current = run();
  }, [navigate, setCode, stop]);

  useEffect(() => {
    const video = videoRef.current;
    scan();
    const pause = () => {
      if (document.visibilityState !== 'hidden') return;
      stop();
      setState('paused');
    };
    document.addEventListener('visibilitychange', pause);
    return () => {
      document.removeEventListener('visibilitychange', pause);
      stop(video);
    };
  }, [scan, stop]);

  const leave = (path: string) => {
    stop();
    navigate(path);
  };

  return (
    <PageShell className="staff-scanner">
      <video
        ref={videoRef}
        className="staff-scanner-video"
        muted
        playsInline
        autoPlay
        aria-hidden="true"
      />
      <div className="staff-scanner-overlay">
        <header className="staff-scanner-header">
          <button
            type="button"
            className="staff-scanner-back"
            aria-label="返回"
            onClick={() => leave('/')}
          >
            <span aria-hidden="true">←</span>
          </button>
          <h1>扫描兑奖码</h1>
          <div className="staff-scanner-feedback">
            <p
              role="status"
              aria-live="polite"
            >
              {state === 'starting' && '正在打开相机…'}
              {state === 'scanning' && '正在扫描，请将二维码对准框内'}
              {state === 'paused' && '扫描已暂停，点击重新扫描以打开相机'}
            </p>
            {state === 'error' && <p role="alert">{error}</p>}
          </div>
        </header>
        <main className="staff-scanner-main">
          <p className="staff-scanner-instruction">请扫描用户兑奖二维码</p>
          <ScanFrame />
        </main>
        <footer className="staff-scanner-actions">
          <button
            type="button"
            className="staff-scanner-retry"
            onClick={scan}
            disabled={state === 'starting' || state === 'scanning'}
          >
            重新扫描
          </button>
          <button
            type="button"
            className="staff-scanner-manual"
            onClick={() => leave('/enter')}
          >
            手动输入兑奖码
          </button>
        </footer>
      </div>
    </PageShell>
  );
}
