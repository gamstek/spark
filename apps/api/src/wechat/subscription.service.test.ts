import { afterEach, describe, expect, it, vi } from 'vitest';

import { SubscriptionService } from './subscription.service.js';

describe('SubscriptionService', () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('does not call WeChat for the development simulated identity', async () => {
    process.env.NODE_ENV = 'development';
    const gateway = { isSubscribed: vi.fn() };
    const tokens = { getAccessToken: vi.fn() };
    const dataSource = { getRepository: vi.fn() };
    const service = new SubscriptionService(
      dataSource as never,
      gateway as never,
      tokens as never,
    );

    await expect(service.isSubscribed('development-wechat-user')).resolves.toBe(
      true,
    );
    expect(dataSource.getRepository).not.toHaveBeenCalled();
    expect(tokens.getAccessToken).not.toHaveBeenCalled();
    expect(gateway.isSubscribed).not.toHaveBeenCalled();
  });
});
