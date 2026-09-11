import { expect, test, type Page } from '@playwright/test';

const runtime = {
  activityCode: 'demo',
  templateId: 'exhibition-lottery',
  templateVersion: 1,
  participationId: '4c057be5-6902-4493-9440-cab1a1adcf3c',
  nextStep: 'NOT_STARTED',
  win: null,
  csrfToken: 'csrf-token-for-activity-runtime',
};

const info = {
  code: 'demo',
  name: '展会活动',
  startsAt: '2026-09-10T00:00:00.000Z',
  drawEndsAt: '2026-09-12T00:00:00.000Z',
  endsAt: '2026-09-12T12:00:00.000Z',
  rulesText: '活动规则',
  noPrizeWeight: 0,
  prizes: [],
};

async function mockSuccessfulActivity(page: Page) {
  await page.route('**/api/activity/demo/runtime**', (route) =>
    route.fulfill({ json: runtime }),
  );
  await page.route('**/api/activity/demo/info', (route) =>
    route.fulfill({ json: info }),
  );
}

test.describe('ActivityRuntimeProvider lifecycle', () => {
  test('stops loading for a production 401 without starting OAuth navigation', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'official-account');
    let releaseInfo!: () => void;
    const pendingInfo = new Promise<void>((resolve) => {
      releaseInfo = resolve;
    });
    const oauthRequests: string[] = [];

    await page.route('**/api/activity/demo/runtime**', (route) =>
      route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED' } }),
    );
    await page.route('**/api/activity/demo/info', async (route) => {
      await pendingInfo;
      await route.fulfill({ json: info });
    });
    await page.route('**/api/wechat/oauth/**', (route) => {
      oauthRequests.push(route.request().url());
      return route.fulfill({ status: 500 });
    });

    try {
      await page.goto('/activity/demo');

      await expect(
        page.getByText('请从公众号欢迎消息或“活动抽奖”菜单重新进入'),
      ).toBeVisible();
      await expect(page.getByText('加载中…')).toHaveCount(0);
      expect(oauthRequests).toEqual([]);
      await expect(page).toHaveURL(/\/activity\/demo$/);
    } finally {
      releaseInfo();
    }
  });

  test('removes stale invalid-entry guidance when the URL rerenders with successful runtime data', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'official-account');
    await mockSuccessfulActivity(page);

    await page.goto('/activity/demo?entryError=invalid');
    await expect(
      page.getByText('活动入口已失效，请从公众号“活动抽奖”菜单获取新链接'),
    ).toBeVisible();

    await page.evaluate(() => {
      window.history.replaceState({}, '', '/activity/demo');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await expect(
      page.getByText('活动入口已失效，请从公众号“活动抽奖”菜单获取新链接'),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: '立即参与' })).toBeVisible();
  });

  test('creates a simulated session and refetches runtime and info only in development simulation', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'development-simulation');
    let runtimeRequests = 0;
    let infoRequests = 0;
    let simulatedSessionRequests = 0;

    await page.route('**/api/activity/demo/runtime**', (route) => {
      runtimeRequests += 1;
      return route.fulfill(
        runtimeRequests === 1
          ? { status: 401, json: { code: 'UNAUTHORIZED' } }
          : { json: runtime },
      );
    });
    await page.route('**/api/activity/demo/info', (route) => {
      infoRequests += 1;
      return route.fulfill({ json: info });
    });
    await page.route('**/api/wechat/oauth/simulate', (route) => {
      simulatedSessionRequests += 1;
      return route.fulfill({ json: { authenticated: true } });
    });

    await page.goto('/activity/demo');

    await expect(page.getByRole('button', { name: '立即参与' })).toBeVisible();
    expect(simulatedSessionRequests).toBe(1);
    expect(runtimeRequests).toBe(2);
    expect(infoRequests).toBe(2);
  });
});
