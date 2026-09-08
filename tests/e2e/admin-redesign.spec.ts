import { expect, test } from '@playwright/test';

test('login fields use Soft surfaces with Radix sizing and keyboard focus', async ({
  page,
}) => {
  await page.goto('/admin/login');
  const input = page.getByLabel('管理员账号', { exact: true });
  const field = input.locator('..');
  await expect(field).toHaveCSS('height', '40px');
  await expect(field).toHaveClass(/rt-variant-soft/);
  await expect(field).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await input.focus();
  await expect(input).toBeFocused();
  await expect(field).toHaveCSS('outline-style', 'solid');
  await page.screenshot({ path: 'test-results/radix-input-focus.png' });
});

test('filters activities and restores mobile navigation focus', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/me', (r) =>
    r.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities', (r) =>
    r.fulfill({
      json: [
        {
          id: 'spring',
          name: '春日品牌展',
          code: 'spring',
          published_version_id: null,
        },
        {
          id: 'summer',
          name: '夏季新品发布会',
          code: 'summer',
          published_version_id: 'v1',
          ends_at: '2020-01-01',
        },
      ],
    }),
  );
  await page.goto('/admin/activities');
  await expect(page.getByText('春日品牌展')).toBeVisible();
  await page.getByRole('textbox', { name: '搜索活动' }).fill('summer');
  await expect(page.getByText('春日品牌展')).toBeHidden();
  await expect(page.getByText('夏季新品发布会')).toBeVisible();
  await page.getByRole('button', { name: '清除搜索' }).click();
  await expect(page.getByRole('textbox', { name: '搜索活动' })).toBeFocused();
  await page.getByRole('textbox', { name: '搜索活动' }).fill('all');
  await expect(page.getByText('没有找到匹配的活动')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '搜索活动' })).toHaveValue(
    'all',
  );
  await page.getByRole('button', { name: '清除搜索' }).click();
  await page.getByRole('combobox', { name: '活动状态' }).click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-filter.png' });
  await page.getByRole('option', { name: '草稿', exact: true }).click();
  await expect(page.getByText('夏季新品发布会')).toBeHidden();
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(page.getByRole('combobox', { name: '活动状态' })).toBeFocused();
  await page.getByRole('combobox', { name: '活动状态' }).press('Enter');
  await expect(
    page.getByRole('option', { name: '草稿', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('option', { name: '全部状态' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('夏季新品发布会')).toBeVisible();
  await page.getByRole('button', { name: '账号菜单' }).click();
  await expect(page.getByRole('menuitem', { name: '退出登录' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '账号菜单' })).toBeFocused();
  await page.screenshot({
    path: 'test-results/admin-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.body.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.getByRole('button', { name: '打开导航' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '打开导航' })).toBeFocused();
  await page.screenshot({
    path: 'test-results/admin-mobile.png',
    fullPage: true,
  });
});

test('login reveals password and keeps authentication errors inline', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/login', (r) =>
    r.fulfill({ status: 401, json: { code: 'INVALID_CREDENTIALS' } }),
  );
  await page.goto('/admin/login');
  await page.getByLabel('管理员账号', { exact: true }).fill('invalid');
  await page.getByLabel('密码', { exact: true }).fill('invalid');
  await page.getByRole('button', { name: '显示密码' }).click();
  await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByText('账号或密码错误，请重试')).toBeVisible();
  await expect(page.getByLabel('管理员账号', { exact: true })).toHaveValue(
    'invalid',
  );
  await page.screenshot({
    path: 'test-results/admin-login.png',
    fullPage: true,
  });
});
