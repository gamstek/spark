import { expect, test, type Page } from '@playwright/test';

const runtime = {
  activityCode: 'demo',
  templateId: 'exhibition-lottery',
  templateVersion: 1,
  participationId: '4c057be5-6902-4493-9440-cab1a1adcf3c',
  nextStep: 'LOTTERY',
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
  winningProbability: 0,
  prizes: [{ prizeLevel: '一等奖', name: '小米充电宝', imageUrl: null }],
};

async function openLottery(page: Page) {
  await page.route('**/api/activity/demo/runtime**', (route) =>
    route.fulfill({ json: runtime }),
  );
  await page.route('**/api/activity/demo/info', (route) =>
    route.fulfill({ json: info }),
  );
  await page.goto('/activity/demo');
  await page.getByRole('button', { name: '立即参与' }).click();
}

const winningResult = {
  id: '8f72385d-54b9-4614-a8b1-c926aa22018e',
  prizeLevel: '一等奖',
  prizeName: '小米充电宝',
  prizeImageUrl: null,
  redeemEndAt: '2026-09-12T10:00:00.000Z',
  redemptionStatus: 'WAIT_REDEEM',
} as const;

async function openSubscribedPage(page: Page) {
  await page.route('**/api/activity/demo/runtime**', (route) =>
    route.fulfill({ json: { ...runtime, nextStep: 'SUBSCRIBE' } }),
  );
  await page.route('**/api/activity/demo/info', (route) =>
    route.fulfill({ json: info }),
  );
  await page.goto('/activity/demo');
  await page.getByRole('button', { name: '立即参与' }).click();
}

for (const viewport of [
  { width: 320, height: 667 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`keeps the lottery wheel visible and action centered at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'development-simulation');
    await page.setViewportSize(viewport);
    await openLottery(page);
    const wheel = page.locator('.lottery-wheel-region');
    const action = page.locator('.lottery-action button');
    await expect(wheel).toBeVisible();
    await expect(action).toBeVisible();

    const geometry = await page.evaluate(
      ({ wheelSelector, actionSelector }) => {
        const wheel = document.querySelector(wheelSelector);
        const action = document.querySelector(actionSelector);
        if (!wheel || !action) throw new Error('Lottery layout is missing');
        const wheelBox = wheel.getBoundingClientRect();
        const actionBox = action.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          documentWidth: document.documentElement.scrollWidth,
          wheelTop: wheelBox.top,
          wheelBottom: wheelBox.bottom,
          actionTop: actionBox.top,
          actionBottom: actionBox.bottom,
          actionCenter: actionBox.left + actionBox.width / 2,
        };
      },
      {
        wheelSelector: '.lottery-wheel-region',
        actionSelector: '.lottery-action button',
      },
    );

    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.wheelTop).toBeGreaterThanOrEqual(0);
    expect(geometry.wheelBottom).toBeLessThan(geometry.actionTop);
    expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(geometry.actionCenter).toBeCloseTo(geometry.viewportWidth / 2, 0);
  });
}

for (const viewport of [
  { width: 375, height: 568 },
  { width: 430, height: 740 },
  { width: 430, height: 932 },
]) {
  test(`keeps the revealed result clear of the wheel at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'development-simulation');
    await page.setViewportSize(viewport);
    await page.route('**/api/activity/demo/runtime**', (route) =>
      route.fulfill({
        json: { ...runtime, nextStep: 'PRIZE', win: winningResult },
      }),
    );
    await page.route('**/api/activity/demo/info', (route) =>
      route.fulfill({
        json: {
          ...info,
          prizes: [
            {
              prizeLevel: winningResult.prizeLevel,
              name: winningResult.prizeName,
              imageUrl: null,
            },
          ],
        },
      }),
    );
    await page.goto('/activity/demo');
    await page.getByRole('button', { name: '立即参与' }).click();
    const resultAction = page.getByRole('button', { name: '查看奖品' });
    await expect(resultAction).toBeVisible();

    const geometry = await page.evaluate(() => {
      const wheel = document.querySelector('.lottery-wheel-region');
      const outcome = document.querySelector('.lottery-outcome');
      if (!wheel || !outcome)
        throw new Error('Lottery result layout is missing');
      const wheelBox = wheel.getBoundingClientRect();
      const outcomeBox = outcome.getBoundingClientRect();
      return {
        wheelBottom: wheelBox.bottom,
        outcomeTop: outcomeBox.top,
        actionBottom: outcomeBox.bottom,
      };
    });

    expect(geometry.wheelBottom).toBeLessThanOrEqual(geometry.outcomeTop);
    expect(geometry.actionBottom).toBeLessThanOrEqual(viewport.height);
    expect(await resultAction.boundingBox()).not.toBeNull();
  });
}

for (const width of [390, 430]) {
  test(`keeps the fixed-coordinate subscribe artwork centered at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'development-simulation');
    await page.setViewportSize({ width, height: 844 });
    await openSubscribedPage(page);
    const stage = page.locator('.bg-canvas > .relative');
    const qr = page.getByAltText('公众号二维码');
    await expect(qr).toBeVisible();

    const geometry = await stage.evaluate((element) => {
      const stageBox = element.getBoundingClientRect();
      const qrBox = element
        .querySelector('img[alt="公众号二维码"]')
        ?.getBoundingClientRect();
      if (!qrBox) throw new Error('Subscribe QR is missing');
      return {
        stageWidth: stageBox.width,
        stageCenter: stageBox.left + stageBox.width / 2,
        qrCenter: qrBox.left + qrBox.width / 2,
      };
    });

    expect(geometry.stageWidth).toBe(375);
    expect(geometry.stageCenter).toBeCloseTo(width / 2, 0);
    expect(geometry.qrCenter).toBeCloseTo(width / 2, 0);
  });
}

test('keeps the subscribe verification action reachable at 375×667', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'development-simulation');
  await page.setViewportSize({ width: 375, height: 667 });
  await openSubscribedPage(page);
  const action = page.getByRole('button', { name: '我已关注，立即验证' });
  await action.scrollIntoViewIfNeeded();

  await expect(action).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeGreaterThanOrEqual(769);
});
