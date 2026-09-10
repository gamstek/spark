import { expect } from '@playwright/test';
import { test } from './admin-test';

for (const preference of ['light', 'dark', 'system'] as const) {
  test(`applies ${preference} before the application module loads`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: preference === 'dark' ? 'light' : 'dark',
    });
    await page.addInitScript(
      (value) => localStorage.setItem('spark-admin-theme', value),
      preference,
    );
    await page.route(/\/src\/main\.tsx(?:\?.*)?$/, (route) => route.abort());
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
    const expected = preference === 'system' ? 'dark' : preference;
    await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
    await expect(page.locator('html')).toHaveCSS('color-scheme', expected);
    await expect(page.locator('#root')).toBeEmpty();
  });
}

test('keeps rendering and switching themes when storage is unavailable', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      Object.defineProperty(Storage.prototype, method, {
        value() {
          throw new DOMException('Storage is blocked', 'SecurityError');
        },
      });
    }
  });
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.goto('/admin/activities');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '切换为浅色主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '账号菜单' }).click();
  await page.getByRole('menuitemradio', { name: '跟随系统' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});
