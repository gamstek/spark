import { expect, test, type Page } from '@playwright/test';

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
