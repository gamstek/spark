import { expect, test } from '@playwright/test';

test('logs in and creates the only supported activity template', async ({
  page,
}) => {
  let prizeCreated = false;
  let published = false;
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
  await page.route('**/api/admin/activities/created/publish', (route) => {
    published = true;
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/admin/prizes/activities/created', (route) => {
    if (route.request().method() === 'POST') {
      prizeCreated = true;
      return route.fulfill({ json: { id: 'prize-1' } });
    }
    return route.fulfill({
      json: prizeCreated
        ? [
            {
              id: 'prize-1',
              prize_name: '展会礼盒',
              total_stock: 20,
              awarded_stock: 0,
              weight: '1',
            },
          ]
        : [],
    });
  });
  await page.goto('/admin/login');
  await page.getByLabel('管理员账号').fill('admin');
  await page.getByLabel('密码').fill('password');
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

  await page.getByRole('link', { name: '奖品与库存' }).click();
  await page.getByLabel('奖品名称').fill('展会礼盒');
  await page.getByLabel('初始库存').fill('20');
  await page.getByLabel('抽奖权重').fill('1');
  await page.getByRole('button', { name: '新增奖项' }).click();
  await expect(page.getByText('奖项已新增')).toBeVisible();
  expect(prizeCreated).toBe(true);

  await page.getByRole('link', { name: '活动设置' }).click();
  await page.getByRole('button', { name: '发布活动' }).click();
  await expect(page.getByText('活动已发布')).toBeVisible();
  expect(published).toBe(true);
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

test('provides a responsive navigation shell and directed empty state', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities', (route) =>
    route.fulfill({ json: [] }),
  );

  await page.goto('/admin/activities');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('link', { name: '活动管理' })).toBeVisible();
  await expect(page.getByText('还没有活动')).toBeVisible();
  await expect(
    page.getByRole('link', { name: '创建第一个活动' }),
  ).toBeVisible();

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole('button', { name: '打开导航' }).click();
  await expect(page.getByRole('link', { name: '工作人员' })).toBeVisible();
});

test('confirms before ending an activity draw', async ({ page }) => {
  let ended = false;
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities/a1/end-draw', (route) => {
    ended = true;
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/admin/activities/a1', (route) =>
    route.fulfill({
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
  await page.getByRole('button', { name: '提前结束抽奖' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  expect(ended).toBe(false);
  await page.getByRole('button', { name: '确认结束抽奖' }).click();
  await expect.poll(() => ended).toBe(true);
});

test('adds inventory through a labeled dialog', async ({ page }) => {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities/a1', (route) =>
    route.fulfill({
      json: {
        id: 'a1',
        published_version_id: 'v1',
        starts_at: '2020-01-01T00:00:00Z',
      },
    }),
  );
  await page.route('**/api/admin/prizes/activities/a1', (route) =>
    route.fulfill({
      json: [
        {
          id: 'p1',
          prize_name: '定制礼盒',
          total_stock: 10,
          awarded_stock: 3,
          weight: '1',
        },
      ],
    }),
  );
  await page.route('**/api/admin/prizes/activity-prizes/p1/stock', (route) =>
    route.fulfill({ json: {} }),
  );

  await page.goto('/admin/activities/a1/prizes');
  await page.getByRole('button', { name: '添加库存' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('增加数量').fill('5');
  await page.getByRole('button', { name: '确认添加' }).click();
  await expect(page.getByText('库存已添加')).toBeVisible();
});

test('shows operational loading, empty, status, and export states', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities/a1/participants', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/admin/activities/a1/redemptions', (route) =>
    route.fulfill({
      json: [
        {
          id: 'redemption-1',
          prize_name: '定制礼盒',
          status: 'PENDING',
          redeemed_at: null,
          redeemed_by: null,
        },
      ],
    }),
  );
  await page.route('**/api/admin/activities/a1/report', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return route.fulfill({
      json: {
        visits: 10,
        uniqueVisitors: 8,
        participants: 5,
        leads: 4,
        subscribed: 3,
        awarded: 2,
        available: 8,
        pending: 1,
        redeemed: 1,
        expired: 0,
        channels: [],
        prizes: [],
      },
    });
  });
  await page.route('**/api/admin/activities/a1/exports', (route) =>
    route.fulfill({ json: { jobId: 'export-1' } }),
  );

  await page.goto('/admin/activities/a1/participants');
  await expect(page.getByText('暂无参与者')).toBeVisible();

  await page.goto('/admin/activities/a1/redemptions');
  await expect(page.getByText('待核销')).toBeVisible();

  await page.goto('/admin/activities/a1/report');
  await expect(page.getByText('正在汇总活动数据')).toBeVisible();
  await expect(page.getByText('页面访问')).toBeVisible();

  await page.goto('/admin/activities/a1/exports');
  await page.getByRole('button', { name: '生成 XLSX' }).click();
  await expect(page.getByText('导出任务已创建')).toBeVisible();
  await expect(page.getByText('处理中')).toBeVisible();
});

test('confirms staff disabling before changing account status', async ({
  page,
}) => {
  let disabled = false;
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/staff', (route) =>
    route.fulfill({
      json: [
        {
          id: 'staff-1',
          username: 'expo-staff',
          display_name: '展会核销组',
          activity_ids: ['a1'],
          disabled_at: null,
        },
      ],
    }),
  );
  await page.route('**/api/admin/staff/staff-1/status', (route) => {
    disabled = true;
    return route.fulfill({ json: {} });
  });

  await page.goto('/admin/staff');
  await page.getByRole('button', { name: '停用账号' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  expect(disabled).toBe(false);
  await page.getByRole('button', { name: '确认停用' }).click();
  await expect.poll(() => disabled).toBe(true);
  await expect(page.getByText('展会核销组 已停用。')).toBeVisible();
});

test('retries a failed job and reports queue feedback', async ({ page }) => {
  let retried = false;
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/jobs/failed', (route) =>
    route.fulfill({
      json: [
        {
          id: 'job-1',
          kind: 'DINGTALK_CALLBACK',
          attempts: 3,
          lastError: '上游请求超时',
        },
      ],
    }),
  );
  await page.route('**/api/admin/jobs/job-1/retry', (route) => {
    retried = true;
    return route.fulfill({ json: {} });
  });

  await page.goto('/admin/jobs');
  await page.getByRole('button', { name: '重新处理' }).click();
  await expect.poll(() => retried).toBe(true);
  await expect(page.getByText('任务已重新进入处理队列。')).toBeVisible();
});
