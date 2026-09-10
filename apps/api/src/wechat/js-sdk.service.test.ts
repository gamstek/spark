import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { WechatJsSdkService } from './js-sdk.service.js';

describe('WechatJsSdkService', () => {
  it('signs the page URL for scanQRCode and removes the hash', async () => {
    const tokens = {
      getAccessToken: vi.fn().mockResolvedValue('access-token'),
    };
    const gateway = {
      fetchJsApiTicket: vi
        .fn()
        .mockResolvedValue({ ticket: 'ticket-1', expiresIn: 7200 }),
    };
    const service = new WechatJsSdkService(
      tokens as never,
      gateway as never,
      () => 1_700_000_000_000,
      () => 'nonce-1',
      'wx-app-id',
    );

    const result = await service.createConfig(
      'https://spark.gamstek.com/staff/scan#ignored',
    );
    const source =
      'jsapi_ticket=ticket-1&noncestr=nonce-1&timestamp=1700000000&url=https://spark.gamstek.com/staff/scan';

    expect(result).toEqual({
      appId: 'wx-app-id',
      nonceStr: 'nonce-1',
      timestamp: 1_700_000_000,
      signature: createHash('sha1').update(source).digest('hex'),
    });
  });
});
