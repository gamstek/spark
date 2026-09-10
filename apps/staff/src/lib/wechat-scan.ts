import { staffApi } from './api';

type WechatScanResult = { resultStr: string };
type WechatSdk = {
  config(options: {
    debug: boolean;
    appId: string;
    timestamp: number;
    nonceStr: string;
    signature: string;
    jsApiList: string[];
  }): void;
  ready(callback: () => void): void;
  error(callback: (error: unknown) => void): void;
  scanQRCode(options: {
    needResult: 1;
    scanType: ['qrCode'];
    success(result: WechatScanResult): void;
    fail(error: unknown): void;
    cancel(): void;
  }): void;
};

declare global {
  interface Window {
    wx?: WechatSdk;
  }
}

let sdkPromise: Promise<WechatSdk> | null = null;

export function extractRedemptionCode(raw: string): string {
  const value = raw.trim();
  try {
    const url = new URL(value);
    return (url.searchParams.get('code') ?? value)
      .replace(/[\s-]/g, '')
      .toUpperCase();
  } catch {
    return value.replace(/[\s-]/g, '').toUpperCase();
  }
}

function loadWechatSdk(): Promise<WechatSdk> {
  if (window.wx) return Promise.resolve(window.wx);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
    script.async = true;
    script.onload = () =>
      window.wx ? resolve(window.wx) : reject(new Error('WECHAT_SDK_MISSING'));
    script.onerror = () => reject(new Error('WECHAT_SDK_LOAD_FAILED'));
    document.head.append(script);
  });
  return sdkPromise;
}

export function isWechatBrowser(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent);
}

export async function scanRedemptionCode(): Promise<string | null> {
  if (!isWechatBrowser()) throw new Error('WECHAT_BROWSER_REQUIRED');
  const wx = await loadWechatSdk();
  const pageUrl = window.location.href.split('#')[0]!;
  const config = await staffApi.wechatJsSdkConfig(pageUrl);

  await new Promise<void>((resolve, reject) => {
    wx.ready(resolve);
    wx.error(reject);
    wx.config({
      debug: false,
      ...config,
      jsApiList: ['scanQRCode'],
    });
  });

  return new Promise((resolve, reject) => {
    wx.scanQRCode({
      needResult: 1,
      scanType: ['qrCode'],
      success: (result) => resolve(extractRedemptionCode(result.resultStr)),
      fail: reject,
      cancel: () => resolve(null),
    });
  });
}
