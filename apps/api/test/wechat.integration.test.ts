import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ParticipantsService } from '../src/participants/participants.service.js';
import { OAuthStateService } from '../src/wechat/oauth-state.service.js';
import { WechatGateway } from '../src/wechat/wechat.gateway.js';
import { WechatIdentityService } from '../src/wechat/wechat-identity.service.js';
import { WechatTokenService } from '../src/wechat/token.service.js';
import { SubscriptionService } from '../src/wechat/subscription.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

describe('WeChat identity and participation recovery', () => {
  let database: TestDatabase;
  let scenario: Scenario;

  beforeAll(async () => {
    database = await createTestDatabase();
    scenario = await createScenario(database.dataSource);
  });

  afterAll(async () => database.close());

  it('consumes an OAuth state only once and binds it to a browser nonce', async () => {
    const states = new OAuthStateService(
      database.dataSource,
      'state-secret',
      () => scenario.now,
    );
    const issued = await states.issue('/activity/expo-2026?channel=poster');
    await expect(
      states.consume(issued.state, issued.browserNonce),
    ).resolves.toBe('/activity/expo-2026?channel=poster');
    await expect(
      states.consume(issued.state, issued.browserNonce),
    ).rejects.toThrow('OAUTH_STATE_INVALID');

    const another = await states.issue('/activity/expo-2026');
    await expect(
      states.consume(another.state, 'different-browser'),
    ).rejects.toThrow('OAUTH_STATE_INVALID');
  });

  it('rejects expired states and off-site return paths', async () => {
    let clock = scenario.now;
    const states = new OAuthStateService(
      database.dataSource,
      'state-secret',
      () => clock,
    );
    expect(() =>
      states.validateReturnPath('https://evil.example/activity/x'),
    ).toThrow('RETURN_PATH_INVALID');
    expect(() =>
      states.validateReturnPath('//evil.example/activity/x'),
    ).toThrow('RETURN_PATH_INVALID');
    const issued = await states.issue('/activity/expo-2026');
    clock = new Date(clock.getTime() + 10 * 60 * 1000 + 1);
    await expect(
      states.consume(issued.state, issued.browserNonce),
    ).rejects.toThrow('OAUTH_STATE_INVALID');
  });

  it('maps concurrent first login for one OpenID to one user', async () => {
    const identities = new WechatIdentityService(
      database.dataSource,
      'wx-app-id',
    );
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        identities.getOrCreateUser('openid-concurrent'),
      ),
    );
    expect(new Set(results.map((result) => result.userId))).toHaveLength(1);
  });

  it('creates one participation per user and activity under concurrency', async () => {
    const participants = new ParticipantsService(database.dataSource);
    const userId = randomUUID();
    await database.dataSource.query(
      `INSERT INTO user_account (id) VALUES ($1)`,
      [userId],
    );
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        participants.getOrCreate(userId, scenario.activityId),
      ),
    );
    expect(new Set(results.map((result) => result.id))).toHaveLength(1);
  });

  it('surfaces WeChat timeouts for retry instead of inventing identity', async () => {
    const gateway = new WechatGateway({
      appId: 'app',
      appSecret: 'secret',
      fetch: async () => {
        throw new Error('timeout');
      },
    });
    await expect(gateway.exchangeCode('code')).rejects.toThrow(
      'WECHAT_REQUEST_FAILED',
    );
  });

  it('shares an encrypted access token and caches subscription for at most 60 seconds', async () => {
    const previousAppId = process.env.WECHAT_APP_ID;
    process.env.WECHAT_APP_ID = 'wx-cache-app';
    try {
      await new WechatIdentityService(
        database.dataSource,
        'wx-cache-app',
      ).getOrCreateUser('openid-cache');
      let tokenCalls = 0;
      let subscriptionCalls = 0;
      let remoteSubscribed = true;
      const gateway = {
        async fetchStableAccessToken() {
          tokenCalls += 1;
          return { accessToken: 'remote-token', expiresIn: 7200 };
        },
        async isSubscribed() {
          subscriptionCalls += 1;
          return remoteSubscribed;
        },
      } as unknown as WechatGateway;
      const tokens = new WechatTokenService(database.dataSource, gateway);
      const subscriptions = new SubscriptionService(
        database.dataSource,
        gateway,
        tokens,
      );
      await expect(subscriptions.isSubscribed('openid-cache')).resolves.toBe(
        true,
      );
      await expect(subscriptions.isSubscribed('openid-cache')).resolves.toBe(
        true,
      );
      expect(tokenCalls).toBe(1);
      expect(subscriptionCalls).toBe(1);
      const stored = await database.dataSource.query<
        { access_token_ciphertext: string }[]
      >(
        `SELECT access_token_ciphertext FROM wechat_credential_cache WHERE app_id='wx-cache-app'`,
      );
      expect(stored[0]?.access_token_ciphertext).not.toContain('remote-token');

      await database.dataSource.query(
        `UPDATE wechat_identity SET subscription_checked_at=now() - interval '61 seconds' WHERE app_id=$1 AND openid=$2`,
        ['wx-cache-app', 'openid-cache'],
      );
      remoteSubscribed = false;
      await expect(subscriptions.isSubscribed('openid-cache')).resolves.toBe(
        false,
      );
      await expect(subscriptions.isSubscribed('openid-cache')).resolves.toBe(
        false,
      );
      expect(subscriptionCalls).toBe(2);
      expect(tokenCalls).toBe(1);
    } finally {
      if (previousAppId === undefined) delete process.env.WECHAT_APP_ID;
      else process.env.WECHAT_APP_ID = previousAppId;
    }
  });

  it('releases a failed token refresh lease so another attempt can populate the cache', async () => {
    const previousAppId = process.env.WECHAT_APP_ID;
    process.env.WECHAT_APP_ID = 'wx-token-retry';
    try {
      let attempts = 0;
      const gateway = {
        async fetchStableAccessToken() {
          attempts += 1;
          if (attempts === 1) throw new Error('remote-timeout');
          return { accessToken: 'retry-token', expiresIn: 7200 };
        },
      } as unknown as WechatGateway;
      const tokens = new WechatTokenService(database.dataSource, gateway);
      await expect(tokens.getAccessToken()).rejects.toThrow('remote-timeout');
      await expect(tokens.getAccessToken()).resolves.toBe('retry-token');
      await expect(
        new WechatTokenService(database.dataSource, gateway).getAccessToken(),
      ).resolves.toBe('retry-token');
      expect(attempts).toBe(2);
    } finally {
      if (previousAppId === undefined) delete process.env.WECHAT_APP_ID;
      else process.env.WECHAT_APP_ID = previousAppId;
    }
  });
});
