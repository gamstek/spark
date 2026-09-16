import { expect, test, type Page } from '@playwright/test';
import { installScannerBoundary } from './staff-scanner-boundary';

async function openScanner(page: Page) {
  await installScannerBoundary(page);
  await page.route('**/api/staff/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'staff-1',
        role: 'STAFF',
        csrfToken: 'csrf',
        displayName: '测试工作人员',
      },
    }),
  );
  await page.route('**/api/staff/activities', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto('scan');
}

async function cameraEvent(page: Page, name: string, detail?: string) {
  await expect(page.locator('html')).toHaveAttribute(
    'data-test-camera',
    'pending',
  );
  await page.evaluate(
    ({ name, detail }) => {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    },
    { name, detail },
  );
}

test('accepts one QR result and requires explicit redemption confirmation', async ({
  page,
}) => {
  const lookups: unknown[] = [];
  const confirmations: unknown[] = [];
  await page.route('**/api/staff/redemptions/lookup', (route) => {
    lookups.push(route.request().postDataJSON());
    return route.fulfill({
      json: {
        redemptionId: 'redemption-1',
        lotteryRecordId: 'lottery-1',
        activityId: 'activity-1',
        prizeName: '展会礼盒',
        prizeImageUrl: null,
        status: 'WAIT_REDEEM',
        redeemEndAt: '2099-10-01T00:00:00.000Z',
        redeemedAt: null,
        userHint: '测试用户',
      },
    });
  });
  page.on('request', (request) => {
    if (request.url().endsWith('/api/staff/redemptions/confirm'))
      confirmations.push(request.postDataJSON());
  });
  await openScanner(page);
  await expect(page.getByRole('status')).toContainText('正在打开相机');
  await cameraEvent(page, 'test-camera-ready');
  await expect(page.getByRole('status')).toContainText('正在扫描');
  const historyBefore = await page.evaluate(() => history.length);
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('test-camera-result', {
        detail: ['https://example.test/redeem?code=ab-12%20cd34', 'ZZ999999'],
      }),
    );
  });
  await expect(page).toHaveURL(/\/staff\/redeem\/confirm$/);
  await expect(page.getByText('AB12CD34', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '确认发放' })).toBeEnabled();
  // React Strict Mode can replay the confirmation page's read-only effect.
  expect(lookups.length).toBeGreaterThan(0);
  for (const lookup of lookups) expect(lookup).toEqual({ code: 'AB12CD34' });
  expect(confirmations).toEqual([]);
  expect(await page.evaluate(() => history.length)).toBe(historyBefore + 1);
});

for (const viewport of [
  { width: 320, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`preserves full viewport and manual recovery at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await openScanner(page);
    await expect(page.getByRole('status')).toContainText('正在打开相机');
    const video = page.locator('video');
    await expect(video).toHaveJSProperty('muted', true);
    await expect(video).toHaveJSProperty('playsInline', true);
    expect(await video.boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
    await cameraEvent(page, 'test-camera-error', 'NotAllowedError');
    await expect(page.getByRole('alert')).toContainText('未获得相机权限');
    const retry = page.getByRole('button', { name: '重新扫描' });
    const manual = page.getByRole('button', { name: '手动输入兑奖码' });
    await expect(retry).toBeEnabled();
    await expect(manual).toBeInViewport({ ratio: 1 });
    await expect(retry).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    await page.screenshot({
      path: testInfo.outputPath('permission-recovery.png'),
    });
    await retry.click();
    await expect(page.getByRole('status')).toContainText('正在打开相机');
    await cameraEvent(page, 'test-camera-ready');
    await expect(page.getByRole('status')).toContainText('正在扫描');
    await page.screenshot({ path: testInfo.outputPath('scanning.png') });
    await manual.click();
    await expect(page).toHaveURL(/\/staff\/enter$/);
    await expect(page.getByPlaceholder('请输入兑奖码')).toBeVisible();
  });
}

test('unsupported camera preserves retry and working manual entry', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined }),
  );
  await openScanner(page);
  await expect(page.getByRole('alert')).toContainText('当前浏览器无法打开相机');
  await expect(page.getByRole('button', { name: '重新扫描' })).toBeEnabled();
  await page.getByRole('button', { name: '手动输入兑奖码' }).click();
  await expect(page.getByPlaceholder('请输入兑奖码')).toBeVisible();
});
