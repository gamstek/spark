import { expect } from '@playwright/test';
import { test } from './admin-test';

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
  await page.route('**/api/admin/media', (route) =>
    route.fulfill({ json: { id: 'prize-image' } }),
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
        published_version_id: published ? 'version-1' : null,
        starts_at: '2099-09-17T02:49:00Z',
        draw_ends_at: '2099-09-18T02:49:00Z',
        ends_at: '2099-09-26T02:49:00Z',
        redeem_ends_at: '2099-09-30T02:49:00Z',
        config: {
          formId: 'form-id',
          formUrl:
            'https://alidocs.dingtalk.com/notable/share/form/form-id?source=link',
          prefillField: 'prefill_participant',
          heroAssetId: 'hero',
          rulesText: '数量有限，先到先得',
        },
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
  await page.getByLabel('密码', { exact: true }).fill('password');
  await page.getByRole('button', { name: '登录' }).click();
  await page.getByRole('link', { name: '新建活动' }).click();
  await expect(page.getByRole('region', { name: '发布状态' })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存草稿' })).toHaveClass(
    /rt-variant-ghost/,
  );
  await expect(page.locator('.editor-form-content .rt-Card')).toHaveCount(0);
  await expect(page.locator('.required-field-mark')).toHaveCount(10);
  await page.getByPlaceholder('活动名称').fill('展会活动');
  await page
    .getByPlaceholder('钉钉表单 HTTPS 分享链接')
    .fill(
      'https://alidocs.dingtalk.com/notable/share/form/form-id?source=link',
    );
  await expect(page.getByPlaceholder('钉钉表单 ID')).toHaveValue('form-id');
  await page.getByPlaceholder('主图资源 ID').fill('hero');
  await page.getByPlaceholder('活动规则').fill('数量有限，先到先得');
  await page.locator('[name="startsAt"]').fill('2026-09-17T10:49');
  await page.locator('[name="drawEndsAt"]').fill('2026-09-15T10:49');
  await page.locator('[name="endsAt"]').fill('2026-09-26T10:49');
  await page.locator('[name="redeemEndsAt"]').fill('2026-09-30T10:49');
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(
    page.getByText('抽奖截止时间必须晚于活动开始时间。'),
  ).toBeVisible();

  await page.locator('[name="drawEndsAt"]').fill('2026-09-18T10:49');
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(page).toHaveURL(/\/admin\/activities\/created$/);
  await expect(page.getByText('活动地址：/activity/generated1')).toBeVisible();
  await expect(page.getByRole('navigation', { name: '活动功能' })).toHaveCount(
    1,
  );
  await expect(page.locator('main .activity-navigation')).toHaveCount(0);
  await expect(page.locator('.workspace-context')).toContainText('展会活动');
  await expect(page.locator('main .rt-Button.rt-variant-solid')).toHaveText([
    '发布活动',
  ]);

  await page.getByRole('navigation', { name: '活动功能' }).evaluate((node) => {
    (window as typeof window & { activityNavNode?: Element }).activityNavNode =
      node;
  });
  await page.getByRole('link', { name: '活动设置' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '奖品与库存' })).toBeFocused();
  await page.keyboard.press('Enter');
  expect(
    await page
      .getByRole('navigation', { name: '活动功能' })
      .evaluate(
        (node) =>
          (window as typeof window & { activityNavNode?: Element })
            .activityNavNode === node,
      ),
  ).toBe(true);
  await page.getByLabel('奖项等级').fill('一等奖');
  await page.getByLabel('奖品名称').fill('展会礼盒');
  await page.getByLabel('奖品图片').setInputFiles({
    name: 'prize.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByLabel('初始库存').fill('20');
  await page.getByLabel('抽奖权重').fill('1');
  await page.getByRole('button', { name: '新增奖项' }).click();
  await expect(page.getByText('奖项已新增')).toBeVisible();
  expect(prizeCreated).toBe(true);
  await expect(page.locator('.ghost-table')).toHaveCount(1);
  await expect(page.locator('.rt-Card table')).toHaveCount(0);

  await page.getByRole('link', { name: '活动设置' }).click();
  await page.getByRole('button', { name: '发布活动' }).click();
  await expect(page.getByText('活动已发布', { exact: true })).toBeVisible();
  expect(published).toBe(true);
  await expect(page.getByRole('region', { name: '发布状态' })).toContainText(
    '已发布',
  );
  await expect(page.locator('.workspace-context')).toContainText('已发布');
  await page.screenshot({
    path: 'test-results/activity-editor-desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '账号菜单' }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.screenshot({
    path: 'test-results/activity-editor-dark.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('region', { name: '发布状态' })).toHaveCSS(
    'position',
    'static',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/activity-editor-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '打开导航' }).click();
  await page.getByRole('link', { name: '奖品与库存' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/prizes$/);
  await expect(page.getByRole('dialog')).toBeHidden();
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
  await expect(page.getByRole('region', { name: '发布状态' })).toContainText(
    '已发布',
  );
  await expect(page.getByRole('button', { name: '保存草稿' })).toHaveClass(
    /rt-variant-ghost/,
  );
  await expect(page.locator('main .rt-Button.rt-variant-solid')).toHaveText([
    '发布活动',
  ]);
  await page.getByPlaceholder('活动名称').fill('冲突名称');
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(
    page.getByText('版本已被其他人修改，请刷新后重试'),
  ).toBeVisible();
  await expect(page.getByPlaceholder('活动名称')).toHaveValue('冲突名称');
  await page.route('**/api/admin/activities/a1/draft', (route) =>
    route.fulfill({ json: { revision: 3 } }),
  );
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(page.getByText('草稿已保存')).toBeVisible();
  await expect(page.locator('.activity-context-identity')).toContainText(
    '冲突名称',
  );
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
        draw_ends_at: '2099-01-01T00:00:00Z',
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
  await expect(page.locator('.activity-collection')).not.toHaveClass(/rt-Card/);
  await expect(page.locator('main .rt-Button.rt-variant-solid')).toHaveText([
    '创建第一个活动',
  ]);

  await page.route('**/api/admin/activities', (route) =>
    route.fulfill({
      json: [
        {
          id: 'a1',
          name: '秋季展会',
          code: 'autumn-expo',
          published_version_id: null,
          starts_at: null,
          ends_at: null,
        },
      ],
    }),
  );
  await page.reload();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('.activity-table')).toHaveClass(/ghost-table/);
  await expect(page.locator('.activity-metric.rt-Card')).toHaveCount(0);
  await expect(page.locator('main .rt-Button.rt-variant-solid')).toHaveText([
    '新建活动',
  ]);
  await expect(page.getByRole('button', { name: /^活动操作：/ })).toHaveClass(
    /rt-variant-ghost/,
  );
  await expect(page.getByLabel('搜索活动')).toBeVisible();
  await page.getByLabel('活动状态').focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('option', { name: '草稿', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('option', { name: '全部状态', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('option', { name: '草稿', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/status=/);
  await expect(page.getByLabel('活动状态')).toContainText('草稿');
  await page.getByLabel('搜索活动').fill('没有匹配');
  await expect(page.getByText('没有找到匹配的活动')).toBeVisible();
  await expect(page.getByRole('button', { name: '清除筛选' })).toHaveClass(
    /rt-variant-ghost/,
  );
  await page.getByRole('button', { name: '清除搜索' }).click();
  await expect(page.getByLabel('搜索活动')).toBeFocused();
  await expect(page).toHaveURL(/status=/);
  await expect(
    page.getByRole('cell', { name: '/activity/autumn-expo', exact: true }),
  ).toBeVisible();
  await page.getByLabel('搜索活动').fill('没有匹配');
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page).toHaveURL(/\/admin\/activities$/);
  await page.getByRole('button', { name: /^活动操作：/ }).click();
  await expect(
    page.getByRole('menuitem', { name: '管理', exact: true }),
  ).toHaveAttribute('href', '/admin/activities/a1');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ghost-table-footer')).toContainText(
    '显示 1 场活动 · 共 1 场',
  );
  await page.screenshot({
    path: 'test-results/activity-home-desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '账号菜单' }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await expect(page.locator('.radix-themes').first()).toHaveClass(/dark/);
  await expect(page.getByRole('menu')).toBeHidden();
  await page.screenshot({
    path: 'test-results/activity-home-dark.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '账号菜单' }).click();
  await page.getByRole('menuitemradio', { name: '浅色', exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('搜索活动')).toBeVisible();
  await expect(page.getByLabel('活动状态')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/activity-home-mobile.png',
    fullPage: true,
  });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole('button', { name: '打开导航' }).click();
  await expect(page.getByRole('link', { name: '工作人员' })).toBeVisible();
  await page.keyboard.press('Escape');

  let releaseActivities!: () => void;
  const pendingActivities = new Promise<void>((resolve) => {
    releaseActivities = resolve;
  });
  await page.route('**/api/admin/activities', async (route) => {
    await pendingActivities;
    await route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await page.reload();
  await expect(page.getByText('正在加载活动')).toBeVisible();
  releaseActivities();
  await expect(page.getByText('活动加载失败')).toBeVisible();
  await expect(page.getByRole('link', { name: '新建活动' })).toBeVisible();
});

test('confirms before ending an activity draw', async ({ page }) => {
  let ended = false;
  let detailLoads = 0;
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities/a1/end-draw', (route) => {
    ended = true;
    return route.fulfill({ json: {} });
  });
  await page.route('**/api/admin/activities/a1', (route) => {
    detailLoads += 1;
    return route.fulfill({
      json: {
        id: 'a1',
        name: '运行活动',
        code: 'running',
        revision: 2,
        published_version_id: 'v1',
        starts_at: '2020-01-01T00:00:00Z',
        draw_ends_at: ended ? '2020-01-02T00:00:00Z' : '2099-01-01T00:00:00Z',
      },
    });
  });

  await page.goto('/admin/activities/a1');
  const loadsBeforeEnd = detailLoads;
  await page.getByRole('button', { name: '提前结束抽奖' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  expect(ended).toBe(false);
  await page.getByRole('button', { name: '确认结束抽奖' }).click();
  await expect.poll(() => ended).toBe(true);
  await expect.poll(() => detailLoads).toBeGreaterThan(loadsBeforeEnd);
  await expect(page.getByText('抽奖已提前结束')).toBeVisible();
  await expect(page.getByRole('button', { name: '提前结束抽奖' })).toBeHidden();
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
  await expect(page.locator('.ghost-table')).toHaveCount(1);
  await expect(page.locator('.rt-Card table')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '奖品操作：定制礼盒' }),
  ).toHaveClass(/rt-variant-ghost/);
  await expect(page.getByRole('button', { name: '保存设置' })).toHaveClass(
    /rt-variant-ghost/,
  );
  await page.getByRole('button', { name: '奖品操作：定制礼盒' }).click();
  await page.getByRole('menuitem', { name: '添加库存' }).click();
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
  await page.route('**/api/admin/activities/a1', (route) =>
    route.fulfill({
      json: {
        id: 'a1',
        name: '现场活动',
        code: 'expo',
        revision: 1,
        published_version_id: null,
      },
    }),
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
        channels: [{ code: 'expo', visitors: 8 }],
        prizes: [{ name: '定制礼盒', awarded: 2, redeemed: 1 }],
      },
    });
  });
  await page.route('**/api/admin/activities/a1/exports', (route) =>
    route.fulfill({ json: { jobId: 'export-1' } }),
  );
  await page.route('**/api/admin/exports/export-1', (route) =>
    route.fulfill({
      json: {
        id: 'export-1',
        status: 'COMPLETED',
        rowCount: 5,
        downloadUrl: '/exports/export-1.xlsx',
      },
    }),
  );

  await page.goto('/admin/activities/a1/participants');
  await expect(page.getByText('暂无参与者')).toBeVisible();
  await page.route('**/api/admin/activities/a1/participants', (route) =>
    route.fulfill({
      json: [
        {
          id: 'participant-1',
          lead_completed: true,
          lead_completed_at: '2026-09-10T01:00:00Z',
          fields: { name: '测试参与者', phone: '13800000000' },
          created_at: '2026-09-10T00:00:00Z',
          channel_code: 'expo',
          prize_name: null,
          redemption_status: null,
        },
      ],
    }),
  );
  await page.reload();
  await expect(
    page.getByRole('rowheader', { name: '测试参与者' }),
  ).toBeVisible();
  await expect(page.locator('.ghost-table')).toHaveCount(1);
  await expect(page.locator('.rt-Card table')).toHaveCount(0);

  await page.goto('/admin/activities/a1/redemptions');
  await expect(page.getByText('待核销')).toBeVisible();
  await expect(page.locator('.ghost-table')).toHaveCount(1);
  await expect(page.locator('.rt-Card table')).toHaveCount(0);

  await page.goto('/admin/activities/a1/report');
  await expect(page.getByText('正在汇总活动数据')).toBeVisible();
  await expect(page.getByText('页面访问')).toBeVisible();
  await expect(page.locator('.ghost-table')).toHaveCount(2);
  await expect(page.locator('.rt-Card table')).toHaveCount(0);
  await page.screenshot({
    path: 'test-results/admin-report.png',
    fullPage: true,
  });

  await page.goto('/admin/activities/a1/exports');
  await page.getByRole('button', { name: '生成 XLSX' }).click();
  await expect(page.getByText('导出任务已创建')).toBeVisible();
  await expect(page.getByText('处理中')).toBeVisible();
  await expect(page.locator('.ghost-table')).toHaveCount(1);
  await expect(page.locator('.rt-Card table')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '导出操作：export-1' }),
  ).toHaveClass(/rt-variant-ghost/);
  await page.getByRole('button', { name: '导出操作：export-1' }).click();
  await page.getByRole('menuitem', { name: '刷新状态' }).click();
  await expect(page.getByText('文件已生成，可以下载。')).toBeVisible();
  await page.getByRole('button', { name: '导出操作：export-1' }).click();
  await expect(
    page.getByRole('menuitem', { name: '下载文件' }),
  ).toHaveAttribute('href', '/exports/export-1.xlsx');
  await page.keyboard.press('Escape');
  await expect(page.getByText('共 5 条记录')).toBeVisible();
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
  await expect(page.getByText('展会核销组')).toBeVisible();
  await expect(page.getByText('@expo-staff')).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: '授权数量' }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '1', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '工作人员操作：expo-staff' }).click();
  await page.getByRole('menuitem', { name: '账号设置' }).click();
  const settingsDialog = page.getByRole('dialog');
  await expect(settingsDialog.getByLabel('显示名称')).toHaveValue('展会核销组');
  await settingsDialog.getByRole('button', { name: '取消' }).click();
  await page.getByRole('button', { name: '工作人员操作：expo-staff' }).click();
  await page.getByRole('menuitem', { name: '停用账号' }).click();
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
  await page.getByRole('button', { name: '任务操作：job-1' }).click();
  await page.getByRole('menuitem', { name: '重新处理' }).click();
  await expect.poll(() => retried).toBe(true);
  await expect(page.getByText('任务已重新进入处理队列。')).toBeVisible();
});
