import { expect, test } from '@playwright/test';

test('logs in and creates the only supported activity template', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/login', (r) =>
    r.fulfill({ json: { id: 'admin', role: 'ADMIN' } }),
  );
  await page.route('**/api/admin/auth/me', (r) =>
    r.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities', async (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ json: { id: 'created' } })
      : r.fulfill({ json: [] }),
  );
  await page.route('**/api/admin/activities/created', (r) =>
    r.fulfill({
      json: {
        id: 'created',
        name: '展会活动',
        code: 'generated1',
        revision: 0,
      },
    }),
  );
  await page.goto('/admin/login');
  await page.getByPlaceholder('管理员账号').fill('admin');
  await page.getByPlaceholder('密码').fill('password');
  await page.getByRole('button', { name: '登录' }).click();
  await page.getByRole('link', { name: '新建活动' }).click();
  await page.getByPlaceholder('活动名称').fill('展会活动');
  await page.getByPlaceholder('钉钉表单 ID').fill('form-id');
  await page
    .getByPlaceholder('已验证的钉钉预填链接')
    .fill('https://alidocs.dingtalk.com/notable/share/form/test?participant=');
  await page.getByPlaceholder('主图资源 ID').fill('hero');
  await page.getByPlaceholder('活动规则').fill('数量有限，先到先得');
  for (const input of await page.locator('input[type=datetime-local]').all())
    await input.fill('2026-09-09T10:00');
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(page).toHaveURL(/\/admin\/activities\/created$/);
  await expect(page.getByText('活动地址：/activity/generated1')).toBeVisible();
});

test('shows revision conflicts while editing a future activity', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/me', (r) =>
    r.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities/a1/draft', (r) =>
    r.fulfill({ status: 409, body: 'VERSION_CONFLICT' }),
  );
  await page.route('**/api/admin/activities/a1', (r) =>
    r.fulfill({
      json: {
        id: 'a1',
        name: '运行活动',
        code: 'running',
        revision: 2,
        published_version_id: 'v1',
        starts_at: '2099-01-01T00:00:00Z',
        draw_ends_at: '2099-01-02T00:00:00Z',
        ends_at: '2099-01-03T00:00:00Z',
        redeem_ends_at: '2099-01-04T00:00:00Z',
        config: {
          formId: 'form-id',
          formUrl:
            'https://alidocs.dingtalk.com/notable/share/form/test?participant=',
          prefillField: 'participant',
          heroAssetId: 'hero',
          rulesText: 'rules',
        },
      },
    }),
  );
  await page.goto('/admin/activities/a1');
  await page.getByPlaceholder('活动名称').fill('冲突名称');
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(
    page.getByText('版本已被其他人修改，请刷新后重试'),
  ).toBeVisible();
});

test('locks a running activity', async ({ page }) => {
  await page.route('**/api/admin/auth/me', (r) =>
    r.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities/a1', (r) =>
    r.fulfill({
      json: {
        id: 'a1',
        name: '运行活动',
        code: 'running',
        revision: 2,
        published_version_id: 'v1',
        starts_at: '2020-01-01T00:00:00Z',
      },
    }),
  );
  await page.goto('/admin/activities/a1');
  await expect(page.getByText('活动已经开始')).toBeVisible();
  await expect(page.getByPlaceholder('钉钉表单 ID')).toBeDisabled();
  await expect(page.getByRole('button', { name: '保存草稿' })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '提前结束抽奖' }),
  ).toBeVisible();
});
