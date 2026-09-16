import { adminActivityDefaults } from './admin-activity-fixture';
import { expect } from '@playwright/test';
import { test } from './admin-test';

test('hides unused hero controls while preserving an existing hero config', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities/a1', (route) =>
    route.fulfill({
      json: {
        ...adminActivityDefaults,
        id: 'a1',
        name: '展会活动',
        code: 'exhibition',
        revision: 0,
        published_version_id: null,
        status: 'DRAFT',
        serverNow: '2026-09-15T08:00:00.000Z',
        starts_at: '2099-01-01T00:00:00Z',
        draw_ends_at: '2099-01-02T00:00:00Z',
        ends_at: '2099-01-03T00:00:00Z',
        redeem_ends_at: '2099-01-04T00:00:00Z',
        config: {
          requireSubscribe: true,
          winningProbability: 0,
          halfDayPrizeLimits: {},
          heroAssetId: 'old-hero',
          rulesText: '数量有限，先到先得',
        },
      },
    }),
  );
  let draft: { config?: { heroAssetId?: string } } = {};
  await page.route('**/api/admin/activities/a1/draft', (route) => {
    draft = route.request().postDataJSON();
    return route.fulfill({ json: { revision: 1 } });
  });

  await page.goto('/admin/activities/a1');
  await expect(page.getByText('主图资源 ID')).toHaveCount(0);
  await expect(page.getByText('上传新主图')).toHaveCount(0);
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(page.getByText('草稿已保存')).toBeVisible();
  expect(draft.config?.heroAssetId).toBe('old-hero');
});
