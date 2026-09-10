import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageShell } from '../components/page-shell';
import { ScanFrame } from '../components/scan-frame';
import { useStaff } from '../lib/runtime';

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

/** 从二维码内容中提取兑奖码（兼容完整链接 /staff?code=xxx 与纯码） */
function extractCode(raw: string): string {
  try {
    const url = new URL(raw);
    return url.searchParams.get('code') ?? raw;
  } catch {
    return raw;
  }
}

export function ScanPage() {
  const navigate = useNavigate();
  const { setCode } = useStaff();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const ctor = (
      window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
    ).BarcodeDetector;
    if (!ctor) {
      setError('当前浏览器不支持扫码识别，请使用手动输入');
      return;
    }
    if (!videoRef.current) return;

    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const detector = new ctor({ formats: ['qr_code'] });

    const handle = (raw: string) => {
      stopped = true;
      cancelAnimationFrame(raf);
      const code = extractCode(raw).trim();
      if (code) {
        setCode(code);
        navigate('/redeem/confirm');
      } else {
        setError('未能识别二维码内容，请重试或手动输入');
        setScanning(false);
      }
    };

    const loop = async () => {
      if (stopped || !videoRef.current) return;
      try {
        const results = await detector.detect(videoRef.current);
        if (results.length > 0) {
          handle(results[0]!.rawValue);
          return;
        }
      } catch {
        // 单帧识别失败可忽略，继续下一帧
      }
      raf = requestAnimationFrame(() => void loop());
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((mediaStream) => {
        if (stopped) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = mediaStream;
        void video.play();
        setScanning(true);
        void loop();
      })
      .catch(() => {
        setError('无法打开摄像头，请检查权限或使用手动输入');
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [navigate, setCode]);

  return (
    <PageShell className="flex min-h-screen flex-col bg-scan text-white">
      <header className="flex items-center justify-between px-3 py-3">
        <span className="w-6" />
        <span className="text-[18px]">扫码</span>
        <button
          onClick={() => navigate('/')}
          className="h-6 w-6 text-white/70"
          aria-label="返回"
        >
          ×
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <p className="mb-6 text-[18px]">请扫描用户兑奖二维码</p>
        <div className="relative">
          <ScanFrame />
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-[inherit] object-cover"
          />
        </div>
        {scanning && (
          <p className="mt-4 text-[13px] text-white/80">识别中…</p>
        )}
        {error && (
          <p className="mt-4 text-center text-[14px] leading-relaxed text-[#FFD07F]">
            {error}
          </p>
        )}
      </div>

      <div className="pb-8 text-center">
        <button
          onClick={() => navigate('/enter')}
          className="text-[15px] underline"
        >
          手动输入兑奖码
        </button>
      </div>
    </PageShell>
  );
}
