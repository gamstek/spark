import { useMemo } from 'react';

interface EnvironmentInput {
  userAgent: string;
  mode: string | undefined;
  development: boolean;
}

interface WechatEnvironment {
  allowed: boolean;
  simulated: boolean;
}

export function resolveWechatEnvironment({
  userAgent,
  mode,
  development,
}: EnvironmentInput): WechatEnvironment {
  const inWechat = /MicroMessenger/i.test(userAgent);
  const simulated = development && mode === 'simulate';
  return { allowed: inWechat || simulated, simulated };
}

export function useWechatEnvironment(): WechatEnvironment {
  return useMemo(
    () =>
      resolveWechatEnvironment({
        userAgent: window.navigator.userAgent,
        mode: import.meta.env.VITE_WECHAT_MODE,
        development: import.meta.env.DEV,
      }),
    [],
  );
}
