import { expect } from '@playwright/test';
import { test } from './admin-test';

test('staff table stays unframed with compact Ghost row menus in both themes', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/staff', (route) =>
    route.fulfill({
      json: [
        {
          id: 'staff-1',
          username: 'expo',
          display_name: '展会核销组',
          activity_ids: [],
          disabled_at: null,
        },
        {
          id: 'staff-2',
          username: 'backup',
          display_name: '备用核销组',
          activity_ids: [],
          disabled_at: '2026-09-01T00:00:00Z',
        },
      ],
    }),
  );
  await page.goto('/admin/staff');
  await expect(
    page.getByRole('button', { name: '创建工作人员', exact: true }),
  ).toHaveClass(/rt-r-size-2/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['浅色', '深色']) {
    await page.getByRole('button', { name: '账号菜单' }).click();
    await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
    await expect(page.getByRole('menu')).toBeHidden();
    const directory = page.locator('.staff-directory-panel');
    await expect(directory).toHaveCSS('box-shadow', 'none');
    await expect(directory).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(directory).toHaveCSS('border-radius', '0px');
    await expect(page.getByRole('table')).toHaveCount(1);
    for (const row of await page.locator('.staff-table tbody tr').all()) {
      await expect.soft(row).toHaveCSS('opacity', '1');
      await expect(row).toHaveCSS('box-shadow', 'none');
      const action = row.getByRole('button');
      await expect(action).toHaveClass(/rt-variant-ghost/);
      await expect(action).toHaveClass(/rt-r-size-1/);
      expect((await row.boundingBox())!.height).toBeLessThanOrEqual(56);
    }
    await page.screenshot({
      path: `test-results/staff-directory-${theme}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.staff-metric').nth(1)).toHaveCSS(
    'border-inline-start-width',
    '0px',
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: 'test-results/staff-directory-mobile.png',
    fullPage: true,
  });
});

test('staff settings preserve activity grants and password reset before enabling an account', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('spark-admin-theme', 'dark'),
  );
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  const staff = {
    id: 'staff-1',
    username: 'expo',
    display_name: '展会核销组',
    activity_ids: ['activity-1'],
    disabled_at: '2026-09-01T00:00:00Z' as string | null,
  };
  await page.route('**/api/admin/staff', (route) =>
    route.fulfill({ json: [staff] }),
  );
  await page.route('**/api/admin/activities', (route) =>
    route.fulfill({
      json: [
        {
          id: 'activity-1',
          name: '上海展会抽奖',
          code: 'expo',
          published_version_id: null,
          starts_at: null,
          ends_at: null,
        },
      ],
    }),
  );
  const requests: { method: string; body: unknown; csrf: string }[] = [];
  await page.route('**/api/admin/staff/staff-1', (route) => {
    const body = route.request().postDataJSON();
    requests.push({
      method: route.request().method(),
      body,
      csrf: route.request().headers()['x-csrf-token'],
    });
    staff.display_name = body.displayName;
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/admin/staff/staff-1/password', (route) => {
    requests.push({
      method: route.request().method(),
      body: route.request().postDataJSON(),
      csrf: route.request().headers()['x-csrf-token'],
    });
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/admin/staff/staff-1/status', (route) => {
    requests.push({
      method: route.request().method(),
      body: route.request().postDataJSON(),
      csrf: route.request().headers()['x-csrf-token'],
    });
    staff.disabled_at = null;
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin/staff');
  await page.getByRole('button', { name: '工作人员操作：expo' }).click();
  await page.getByRole('menuitem', { name: '账号设置' }).click();
  const dialog = page.getByRole('dialog', { name: '账号设置' });
  await expect(
    dialog.getByRole('button', { name: '可操作活动' }),
  ).toContainText('上海展会抽奖');
  await dialog.getByLabel('显示名称', { exact: true }).fill('上海核销组');
  await dialog
    .getByLabel('重置密码', { exact: true })
    .fill('updated-password-123');
  await dialog.getByRole('button', { name: '保存设置' }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('rowheader', { name: '上海核销组' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '工作人员操作：expo' }).click();
  await page.getByRole('menuitem', { name: '启用账号' }).click();
  await expect(page.getByText('上海核销组 已启用。')).toBeVisible();
  await page.getByRole('button', { name: '工作人员操作：expo' }).click();
  await expect(page.getByRole('menuitem', { name: '停用账号' })).toBeVisible();
  expect(requests).toEqual([
    {
      method: 'PATCH',
      body: { displayName: '上海核销组', activityIds: ['activity-1'] },
      csrf: 'csrf',
    },
    {
      method: 'POST',
      body: { password: 'updated-password-123' },
      csrf: 'csrf',
    },
    { method: 'POST', body: { disabled: false }, csrf: 'csrf' },
  ]);
});

test('failed jobs use a Ghost table and retry without changing the action size', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('spark-admin-theme', 'dark'),
  );
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  let retried = false;
  let attempts = 0;
  let releaseRetry: (() => void) | undefined;
  await page.route('**/api/admin/jobs/failed', (route) =>
    route.fulfill({
      json: retried
        ? []
        : [
            {
              id: 'job-1',
              kind: 'EXPORT',
              attempts: 3,
              lastError: '暂时无法连接存储服务',
            },
          ],
    }),
  );
  await page.route('**/api/admin/jobs/job-1/retry', async (route) => {
    if (++attempts === 1) {
      await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
      return;
    }
    await new Promise<void>((resolve) => {
      releaseRetry = resolve;
    });
    retried = true;
    await route.fulfill({ json: {} });
  });
  await page.goto('/admin/jobs');
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  expect(
    await table.evaluate((element) => Boolean(element.closest('.rt-Card'))),
  ).toBe(false);
  await expect(page.locator('.ghost-table')).toBeVisible();
  const retry = table.getByRole('button');
  await expect(retry).toHaveAccessibleName('任务操作：job-1');
  await expect(retry).toHaveClass(/rt-variant-ghost/);
  await page.screenshot({ path: 'test-results/jobs-dark.png', fullPage: true });
  const initial = await retry.boundingBox();
  await retry.click();
  await page.getByRole('menuitem', { name: '重新处理' }).click();
  await expect(
    page.getByText('任务重试失败，请检查服务状态后再次操作。'),
  ).toBeVisible();
  await expect(retry).toBeEnabled();
  await retry.click();
  await page.getByRole('menuitem', { name: '重新处理' }).click();
  await expect(retry).toBeDisabled();
  const pending = await retry.boundingBox();
  expect(pending!.width).toBe(initial!.width);
  expect(pending!.height).toBe(initial!.height);
  await expect.poll(() => Boolean(releaseRetry)).toBe(true);
  releaseRetry!();
  await expect(page.getByText('任务已重新进入处理队列。')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '没有失败任务', exact: true }),
  ).toBeVisible();
});

test('creates staff inside a dialog and retains input on failure', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/me', (r) =>
    r.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  let attempts = 0;
  let submittedActivityIds: string[] = [];
  await page.route('**/api/admin/staff', (r) => {
    if (r.request().method() !== 'POST') return r.fulfill({ json: [] });
    submittedActivityIds = r.request().postDataJSON().activityIds;
    return r.fulfill({ status: ++attempts === 1 ? 400 : 200, json: {} });
  });
  await page.route('**/api/admin/activities', (r) =>
    r.fulfill({
      json: [{ id: 'activity-1', name: '上海展会抽奖' }],
    }),
  );
  await page.goto('/admin/staff');
  await expect(page.getByLabel('登录名', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: '创建工作人员', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('登录名', { exact: true }).fill('expo');
  await dialog.getByLabel('显示名称', { exact: true }).fill('展会核销组');
  await dialog.getByLabel('初始密码', { exact: true }).fill('password12345');
  await dialog.getByRole('button', { name: '可操作活动' }).click();
  await page.getByRole('menuitemcheckbox', { name: '上海展会抽奖' }).click();
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: '创建并授权' }).click();
  await expect(
    dialog.getByText('工作人员创建失败，请检查登录名、密码和活动授权。'),
  ).toBeVisible();
  await expect(dialog.getByLabel('登录名', { exact: true })).toHaveValue(
    'expo',
  );
  expect(submittedActivityIds).toEqual(['activity-1']);
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
