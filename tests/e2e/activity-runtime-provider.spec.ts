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
  test('a returning submitted participant enters lottery directly without showing the local success acknowledgement', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'development-simulation');
    await page.route('**/api/activity/demo/runtime**', (route) =>
      route.fulfill({ json: { ...runtime, nextStep: 'LOTTERY' } }),
    );
    await page.route('**/api/activity/demo/info', (route) =>
      route.fulfill({ json: info }),
    );
    await page.goto('/activity/demo');
    await page.getByRole('button', { name: '立即参与' }).click();
    await expect(page.getByRole('button', { name: '开始抽奖' })).toBeVisible();
    await expect(page.getByRole('button', { name: '提交信息' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '去抽奖' })).toHaveCount(0);
  });

  test('keeps the authoritative result hidden until the wheel finishes spinning and settling', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'development-simulation');
    const win = {
      id: '8f72385d-54b9-4614-a8b1-c926aa22018e',
      prizeLevel: '一等奖',
      prizeName: '小米充电宝',
      prizeImageUrl: null,
      redeemEndAt: '2026-09-12T10:00:00.000Z',
      redemptionStatus: 'WAIT_REDEEM',
    } as const;
    let drawn = false;
    let drawRequests = 0;

    await page.route('**/api/activity/demo/runtime**', (route) =>
      route.fulfill({
        json: {
          ...runtime,
          nextStep: drawn ? 'PRIZE' : 'LOTTERY',
          win: drawn ? win : null,
        },
      }),
    );
    await page.route('**/api/activity/demo/info', (route) =>
      route.fulfill({
        json: {
          ...info,
          prizes: [
            {
              prizeLevel: win.prizeLevel,
              name: win.prizeName,
              imageUrl: null,
            },
            {
              prizeLevel: '二等奖',
              name: '定制保温杯',
              imageUrl: null,
            },
          ],
        },
      }),
    );
    await page.route('**/api/activity/demo/lottery', async (route) => {
      drawRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, 120));
      drawn = true;
      await route.fulfill({ json: { win } });
    });
    await page.route('**/api/activity/demo/prize-code', (route) =>
      route.fulfill({ json: { code: 'PRIZE-CODE', qrUrl: '/prize-code.png' } }),
    );

    await page.goto('/activity/demo');
    await page.getByRole('button', { name: '立即参与' }).click();
    const wheel = page.getByLabel('抽奖转盘');
    const result = page.getByText('一等奖 · 小米充电宝');
    const startedAt = Date.now();

    await page.getByRole('button', { name: '立即抽奖' }).click();
    await expect(wheel).toHaveClass(/lottery-wheel--spinning/);
    await page.waitForTimeout(500);
    await expect(result).toHaveCount(0);
    await expect(wheel).toHaveClass(/lottery-wheel--settling/, {
      timeout: 2_500,
    });
    await expect(result).toHaveCount(0);
    await expect(result).toBeVisible({ timeout: 3_000 });

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(2_700);
    expect(drawRequests).toBe(1);
  });

  test('stops the wheel cleanly and restores retry after a rejected draw', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'development-simulation');
    let drawRequests = 0;

    await page.route('**/api/activity/demo/runtime**', (route) =>
      route.fulfill({ json: { ...runtime, nextStep: 'LOTTERY' } }),
    );
    await page.route('**/api/activity/demo/info', (route) =>
      route.fulfill({
        json: {
          ...info,
          prizes: [
            {
              prizeLevel: '一等奖',
              name: '小米充电宝',
              imageUrl: null,
            },
          ],
        },
      }),
    );
    await page.route('**/api/activity/demo/lottery', async (route) => {
      drawRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, 120));
      await route.fulfill({
        status: 500,
        json: { code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR' },
      });
    });

    await page.goto('/activity/demo');
    await page.getByRole('button', { name: '立即参与' }).click();
    const wheel = page.getByLabel('抽奖转盘');
    const drawButton = page.getByRole('button', { name: '立即抽奖' });

    await drawButton.click();
    await expect(wheel).toHaveClass(/lottery-wheel--spinning/);
    await expect(page.getByRole('button', { name: '抽奖中…' })).toBeDisabled();
    await expect(wheel).toHaveClass(/lottery-wheel--stopping/, {
      timeout: 2_500,
    });
    await expect(page.getByText('操作失败，请稍后重试')).toBeVisible();
    await expect(drawButton).toBeEnabled({ timeout: 1_500 });
    expect(drawRequests).toBe(1);
  });

  test('reveals the authoritative result without sustained rotation when reduced motion is requested', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'development-simulation');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const win = {
      id: '8f72385d-54b9-4614-a8b1-c926aa22018e',
      prizeLevel: '一等奖',
      prizeName: '小米充电宝',
      prizeImageUrl: null,
      redeemEndAt: '2026-09-12T10:00:00.000Z',
      redemptionStatus: 'WAIT_REDEEM',
    } as const;
    let drawn = false;

    await page.route('**/api/activity/demo/runtime**', (route) =>
      route.fulfill({
        json: {
          ...runtime,
          nextStep: drawn ? 'PRIZE' : 'LOTTERY',
          win: drawn ? win : null,
        },
      }),
    );
    await page.route('**/api/activity/demo/info', (route) =>
      route.fulfill({
        json: {
          ...info,
          prizes: [
            {
              prizeLevel: win.prizeLevel,
              name: win.prizeName,
              imageUrl: null,
            },
          ],
        },
      }),
    );
    await page.route('**/api/activity/demo/lottery', (route) => {
      drawn = true;
      return route.fulfill({ json: { win } });
    });
    await page.route('**/api/activity/demo/prize-code', (route) =>
      route.fulfill({ json: { code: 'PRIZE-CODE', qrUrl: '/prize-code.png' } }),
    );

    await page.goto('/activity/demo');
    await page.getByRole('button', { name: '立即参与' }).click();
    const wheel = page.getByLabel('抽奖转盘');
    await page.getByRole('button', { name: '立即抽奖' }).click();

    await expect
      .poll(() =>
        wheel.evaluate((element) => getComputedStyle(element).animationName),
      )
      .toBe('none');
    await expect(page.getByText('一等奖 · 小米充电宝')).toBeVisible({
      timeout: 1_000,
    });
  });

  test('bootstraps one anonymous session and refetches both resources after simultaneous 401 responses', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'development-simulation');
    let runtimeRequests = 0;
    let infoRequests = 0;
    let bootstrapRequests = 0;

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
      return route.fulfill(
        infoRequests === 1
          ? { status: 401, json: { code: 'UNAUTHORIZED' } }
          : { json: info },
      );
    });
    await page.route('**/api/activity/demo/session**', (route) => {
      bootstrapRequests += 1;
      expect(
        new URL(route.request().url()).searchParams.get('returnPath'),
      ).toBe('/activity/demo');
      return route.fulfill({ json: { authenticated: true } });
    });

    await page.goto('/activity/demo');

    await expect(page.getByRole('button', { name: '立即参与' })).toBeVisible();
    expect(bootstrapRequests).toBe(1);
    expect(runtimeRequests).toBe(2);
    expect(infoRequests).toBe(2);
  });

  for (const earlyResource of ['runtime', 'info'] as const) {
    test(`recovers when ${earlyResource} returns 401 before the other initial request settles`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name === 'development-simulation');
      const lateResource = earlyResource === 'runtime' ? 'info' : 'runtime';
      const requests = { runtime: 0, info: 0 };
      let bootstrapRequests = 0;
      let releaseInitial!: () => void;
      const initialRequestsStarted = new Promise<void>((resolve) => {
        releaseInitial = resolve;
      });
      let releaseLate!: () => void;
      const lateResponse = new Promise<void>((resolve) => {
        releaseLate = resolve;
      });
      for (const resource of ['runtime', 'info'] as const) {
        await page.route(
          `**/api/activity/demo/${resource}**`,
          async (route) => {
            requests[resource] += 1;
            if (requests[resource] === 1) {
              if (requests.runtime && requests.info) releaseInitial();
              await initialRequestsStarted;
              if (resource === lateResource) await lateResponse;
              await route.fulfill({
                status: 401,
                json: { code: 'UNAUTHORIZED' },
              });
            } else {
              await route.fulfill({
                json: resource === 'runtime' ? runtime : info,
              });
            }
          },
        );
      }
      await page.route('**/api/activity/demo/session**', (route) => {
        bootstrapRequests += 1;
        return route.fulfill({ json: { authenticated: true } });
      });

      try {
        await page.goto('/activity/demo');
        await expect.poll(() => requests[earlyResource]).toBe(2);
        releaseLate();
        await expect(
          page.getByRole('button', { name: '立即参与' }),
        ).toBeVisible();
        expect(requests).toEqual({ runtime: 2, info: 2 });
        expect(bootstrapRequests).toBe(1);
        await expect(page.getByText('操作失败，请稍后重试')).toHaveCount(0);
      } finally {
        releaseLate();
      }
    });
  }

  test('shows a stable error without repeating bootstrap when the refreshed session remains unauthorized', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'development-simulation');
    let bootstrapRequests = 0;

    await page.route('**/api/activity/demo/runtime**', (route) =>
      route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED' } }),
    );
    await page.route('**/api/activity/demo/info', (route) =>
      route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED' } }),
    );
    await page.route('**/api/activity/demo/session**', (route) => {
      bootstrapRequests += 1;
      return route.fulfill({ json: { authenticated: true } });
    });

    await page.goto('/activity/demo');

    await expect(page.getByText('操作失败，请稍后重试')).toBeVisible();
    await page.waitForTimeout(200);
    expect(bootstrapRequests).toBe(1);
  });

  test('keeps the bootstrap error when stale runtime data survives a later 401', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'development-simulation');
    let runtimeUnauthorized = false;
    let infoRequests = 0;
    let bootstrapRequests = 0;
    let releaseUpdatedInfo!: () => void;
    const updatedInfo = new Promise<void>((resolve) => {
      releaseUpdatedInfo = resolve;
    });

    await page.route('**/api/activity/demo/runtime**', (route) =>
      route.fulfill(
        runtimeUnauthorized
          ? { status: 401, json: { code: 'UNAUTHORIZED' } }
          : { json: runtime },
      ),
    );
    await page.route('**/api/activity/demo/info', (route) => {
      infoRequests += 1;
      if (infoRequests > 1) {
        return updatedInfo.then(() =>
          route.fulfill({ json: { ...info, name: '更新后的展会活动' } }),
        );
      }
      return route.fulfill({
        json: info,
      });
    });
    await page.route('**/api/activity/demo/session**', (route) => {
      bootstrapRequests += 1;
      return route.fulfill({ json: { authenticated: true } });
    });

    await page.goto('/activity/demo');
    await expect(page.getByText('展会活动')).toBeVisible();

    runtimeUnauthorized = true;
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });

    await expect(page.getByText('操作失败，请稍后重试')).toBeVisible();
    releaseUpdatedInfo();
    await page.waitForTimeout(200);
    expect(infoRequests).toBeGreaterThan(1);
    expect(bootstrapRequests).toBe(1);
  });

  test('ignores the deprecated invalid-entry query when activity data is available', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'development-simulation');
    await mockSuccessfulActivity(page);

    await page.goto('/activity/demo?entryError=invalid');

    await expect(page.getByRole('button', { name: '立即参与' })).toBeVisible();
  });

  test('creates a development session and refetches runtime and info only when simulation is enabled', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'development-simulation');
    let runtimeRequests = 0;
    let infoRequests = 0;
    let developmentSessionRequests = 0;

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
      developmentSessionRequests += 1;
      return route.fulfill({ json: { authenticated: true } });
    });

    await page.goto('/activity/demo');

    await expect(page.getByRole('button', { name: '立即参与' })).toBeVisible();
    expect(developmentSessionRequests).toBe(1);
    expect(runtimeRequests).toBe(2);
    expect(infoRequests).toBe(2);
  });
});
