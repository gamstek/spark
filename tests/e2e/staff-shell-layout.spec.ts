import { expect, test, type Page } from '@playwright/test';

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`keeps unauthenticated login and feedback reachable at ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/staff/auth/me', (route) =>
      route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED' } }),
    );
    const attempts: unknown[] = [];
    await page.route('**/api/staff/auth/login', (route) => {
      attempts.push(route.request().postDataJSON());
      return route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED' } });
    });
    await page.goto('/');
    await expect(page).toHaveURL(/\/staff\/login$/);
    await expect(
      page.getByRole('heading', { name: '工作人员工作台' }),
    ).toBeVisible();
    const shell = page.locator('.bg-canvas > .w-full');
    const bounds = await shell.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBe(viewport.width);
    expect(bounds!.x + bounds!.width / 2).toBeCloseTo(viewport.width / 2, 0);
    expect(bounds!.height).toBeGreaterThanOrEqual(viewport.height);
    const username = page.getByLabel('账号', { exact: true });
    const password = page.getByLabel('密码', { exact: true });
    const submit = page.getByRole('button', { name: '进入工作台' });
    for (const control of [username, password, submit]) {
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport({ ratio: 1 });
    }
    await submit.click();
    const feedback = page.locator('form [aria-live="polite"]');
    await expect(feedback).toContainText('请输入账号和密码');
    await feedback.scrollIntoViewIfNeeded();
    await expect(feedback).toBeInViewport({ ratio: 1 });
    expect(attempts).toEqual([]);
    await username.fill('staff-test');
    await password.fill('wrong-password');
    await submit.click();
    await expect(feedback).toContainText('账号或密码错误');
    await feedback.scrollIntoViewIfNeeded();
    await expect(feedback).toBeInViewport({ ratio: 1 });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport({ ratio: 1 });
    await expect(submit).toBeEnabled();
    await expect(username).toHaveValue('staff-test');
    expect(attempts).toEqual([
      { username: 'staff-test', password: 'wrong-password' },
    ]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    await page.screenshot({
      path: testInfo.outputPath('login-error.png'),
      fullPage: true,
    });
  });
}

async function mockStaffSession(page: Page) {
  await page.route('**/api/staff/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'staff-1',
        role: 'STAFF',
        csrfToken: 'csrf-token',
        displayName: '测试工作人员',
      },
    }),
  );
  await page.route('**/api/staff/activities', (route) =>
    route.fulfill({
      json: [
        {
          id: 'activity-1',
          code: 'demo',
          name: '测试活动',
          startsAt: '2026-09-01T00:00:00.000Z',
          endsAt: '2026-10-01T00:00:00.000Z',
          rulesText: '测试规则',
        },
      ],
    }),
  );
  await page.route('**/api/staff/activities/activity-1/prizes', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/staff/redemptions/records**', (route) =>
    route.fulfill({ json: [] }),
  );
}

for (const width of [390, 430]) {
  test(`centers staff content, navigation, and selection sheet at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockStaffSession(page);
    await page.goto('/');
    await expect(page.getByText('测试活动')).toBeVisible();

    const nav = page.getByRole('navigation', { name: '工作人员平台主导航' });
    const navBounds = await nav.boundingBox();
    expect(navBounds).not.toBeNull();
    expect(navBounds!.width).toBe(width);
    expect(navBounds!.x + navBounds!.width / 2).toBeCloseTo(width / 2, 0);
    const shellBounds = await page
      .locator('.bg-canvas > .w-full')
      .boundingBox();
    expect(shellBounds).not.toBeNull();
    expect(shellBounds!.x).toBe(navBounds!.x);
    expect(shellBounds!.width).toBe(navBounds!.width);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);

    await page.getByText('测试活动').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    const sheetBounds = await sheet.locator('div.relative').boundingBox();
    expect(sheetBounds).not.toBeNull();
    expect(sheetBounds!.width).toBe(width);
    expect(sheetBounds!.x + sheetBounds!.width / 2).toBeCloseTo(width / 2, 0);
  });
}

for (const width of [390, 430]) {
  test(`centers redemption result artwork at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockStaffSession(page);
    await page.goto('redeem/success');
    await expect(page.getByRole('heading', { name: '核销成功' })).toBeVisible();

    const stage = page.locator('div.mx-auto').first();
    const stageBounds = await stage.boundingBox();
    const cardBounds = await stage
      .locator('div.absolute')
      .first()
      .boundingBox();
    expect(stageBounds).not.toBeNull();
    expect(cardBounds).not.toBeNull();
    expect(stageBounds!.width).toBe(375);
    expect(stageBounds!.x + stageBounds!.width / 2).toBeCloseTo(width / 2, 0);
    expect(cardBounds!.x + cardBounds!.width / 2).toBeCloseTo(width / 2, 0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}
