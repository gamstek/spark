import { describe, expect, it, vi } from 'vitest';

import { WechatIdentity } from '../../database/entities/accounts.entities.js';
import { WechatIdentityService } from './wechat-identity.service.js';

describe('WechatIdentityService event state', () => {
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
