import { expect } from '@playwright/test';
import { test } from './admin-test';

const validActivity = {
  id: 'activity-1',
  name: '展会活动',
  code: 'expo',
  revision: 1,
  published_version_id: 'version-1',
  draft_version_id: null,
  paused_at: null,
  starts_at: '2020-09-15T00:00:00.000Z',
  draw_ends_at: '2099-09-16T00:00:00.000Z',
  ends_at: '2099-09-17T00:00:00.000Z',
  status: 'RUNNING',
  serverNow: '2026-09-15T08:00:00.000Z',
  version: 1,
  template_id: 'exhibition-lottery',
  template_version: 1,
  config: {},
  redeem_ends_at: '2099-09-18T00:00:00.000Z',
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
});

test('shows a load failure for an existing activity without status and recovers on retry', async ({
  page,
}, testInfo) => {
  let malformed = true;
  await page.route('**/api/admin/activities/activity-1', (route) =>
    route.fulfill({
      json: { ...validActivity, status: malformed ? undefined : 'RUNNING' },
    }),
  );
  await page.goto('/admin/activities/activity-1');
  await expect(page.getByText('活动配置加载失败')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存草稿' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '发布活动', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('region', { name: '发布状态' })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('activity-load-failure.png'),
    fullPage: true,
  });
  malformed = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('region', { name: '发布状态' })).toContainText(
    '进行中',
  );
  await expect(page.getByRole('button', { name: '保存草稿' })).toBeDisabled();
  await expect(page.locator('.app-sidebar .workspace-context')).toContainText(
    '进行中',
  );
});

test('shows a list load failure for invalid server time without crashing navigation', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/admin/activities', (route) =>
    route.fulfill({
      json: [{ ...validActivity, serverNow: 'invalid' }],
    }),
  );
  await page.goto('/admin/activities');
  await expect(page.getByText('活动加载失败', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /展会活动/ })).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: '新建活动', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('activity-list-load-failure-mobile.png'),
    fullPage: true,
  });
});
