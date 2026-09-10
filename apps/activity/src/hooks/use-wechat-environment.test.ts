import { describe, expect, it } from 'vitest';

import { resolveWechatEnvironment } from './use-wechat-environment';

describe('resolveWechatEnvironment', () => {
  it('allows a real WeChat browser', () => {
    expect(
      resolveWechatEnvironment({
        userAgent: 'Mozilla/5.0 MicroMessenger/8.0.50',
        mode: undefined,
        development: false,
      }),
    ).toEqual({ allowed: true, simulated: false });
  });

  it('blocks an ordinary browser by default', () => {
    expect(
      resolveWechatEnvironment({
        userAgent: 'Mozilla/5.0 Chrome/152.0',
        mode: undefined,
        development: true,
      }),
    ).toEqual({ allowed: false, simulated: false });
  });

  it('allows simulation only in development', () => {
    expect(
      resolveWechatEnvironment({
        userAgent: 'Mozilla/5.0 Chrome/152.0',
        mode: 'simulate',
        development: true,
      }),
    ).toEqual({ allowed: true, simulated: true });
    expect(
      resolveWechatEnvironment({
        userAgent: 'Mozilla/5.0 Chrome/152.0',
        mode: 'simulate',
        development: false,
      }),
    ).toEqual({ allowed: false, simulated: false });
  });
});
