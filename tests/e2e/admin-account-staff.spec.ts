import { test, expect } from '@playwright/test';

test('creates staff inside a dialog and retains input on failure', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/me', (r) =>
    r.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  let attempts = 0;
  await page.route('**/api/admin/staff', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ status: ++attempts === 1 ? 400 : 200, json: {} })
      : r.fulfill({ json: [] }),
  );
  await page.goto('/admin/staff');
  await expect(page.getByLabel('登录名', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: '创建工作人员', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('登录名', { exact: true }).fill('expo');
  await dialog.getByLabel('显示名称', { exact: true }).fill('展会核销组');
  await dialog.getByLabel('初始密码', { exact: true }).fill('password12345');
  await dialog.getByRole('button', { name: '创建并授权' }).click();
  await expect(
    dialog.getByText('工作人员创建失败，请检查登录名、密码和活动 ID。'),
  ).toBeVisible();
  await expect(dialog.getByLabel('登录名', { exact: true })).toHaveValue(
    'expo',
  );
  await page.screenshot({ path: 'test-results/staff-dialog.png' });
  await dialog.getByRole('button', { name: '创建并授权' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('工作人员已创建并完成活动授权。')).toBeVisible();
  await page.goto('/admin/activities/new');
  await page.getByRole('button', { name: '保存草稿' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/admin-save-bar.png' });
});

test('account menu logs out with the restored CSRF token', async ({ page }) => {
  await page.route('**/api/admin/auth/me', (r) =>
    r.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities', (r) => r.fulfill({ json: [] }));
  let token = '';
  await page.route('**/api/admin/auth/logout', (r) => {
    token = r.request().headers()['x-csrf-token'];
    return r.fulfill({ json: {} });
  });
  await page.goto('/admin/activities');
  await page.getByRole('button', { name: '账号菜单' }).click();
  await page.getByRole('menuitem', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(token).toBe('csrf');
  await page.screenshot({ path: 'test-results/login-split.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.body.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/login-mobile.png',
    fullPage: true,
  });
});
