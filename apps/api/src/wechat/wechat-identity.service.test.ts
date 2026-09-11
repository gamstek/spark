import { describe, expect, it, vi } from 'vitest';

import { WechatIdentity } from '../../database/entities/accounts.entities.js';
import { WechatIdentityService } from './wechat-identity.service.js';

describe('WechatIdentityService event state', () => {
  it('does not mutate subscription state after the callback deadline aborts', async () => {
    let releaseLock!: () => void;
    const lock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const query = vi.fn().mockReturnValueOnce(lock);
    const manager = { query };
    const abort = new AbortController();
    const identities = new WechatIdentityService({} as never, 'current-app');

    const operation = identities.applySubscriptionEvent(
      'private-openid',
      false,
      new Date('2026-09-11T04:00:00.000Z'),
      manager as never,
      abort.signal,
    );
    abort.abort();
    releaseLock();

    await expect(operation).rejects.toThrow('WECHAT_CALLBACK_DEADLINE');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['markSubscribed', true],
    ['markUnsubscribed', false],
  ] as const)(
    '%s updates only the current AppID identity',
    async (method, subscribed) => {
      const update = vi.fn().mockResolvedValue({ affected: 1 });
      const getRepository = vi.fn().mockReturnValue({ update });
      const identities = new WechatIdentityService(
        { getRepository } as never,
        'current-app',
      );

      expect(await identities[method]('private-openid')).toBeUndefined();

      expect(getRepository).toHaveBeenCalledWith(WechatIdentity);
      expect(update).toHaveBeenCalledWith(
        { appId: 'current-app', openid: 'private-openid' },
        { subscribed, subscriptionCheckedAt: expect.any(Function) },
      );
      expect(update.mock.calls[0]![1].subscriptionCheckedAt()).toBe('now()');
    },
  );
});
