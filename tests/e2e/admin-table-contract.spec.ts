import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './admin-test';

async function mockContext(page: Page) {
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
        published_version_id: 'v1',
        starts_at: '2020-01-01T00:00:00Z',
        config: {},
      },
    }),
  );
}

async function compactRow(row: Locator) {
  await expect(row).toBeVisible();
  expect.soft((await row.boundingBox())!.height).toBeLessThanOrEqual(56);
  expect
    .soft(
      await row
        .locator('td')
        .first()
        .evaluate((cell) => getComputedStyle(cell).paddingBlockStart),
    )
    .toBe('10px');
}

async function openActions(page: Page, label: string) {
  const trigger = page.getByRole('button', { name: label, exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toHaveClass(/rt-variant-ghost/);
  await expect(trigger).toHaveClass(/rt-r-size-1/);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  return trigger;
}

test('prize row menu preserves stock dialog focus and cancellation', async ({
  page,
}) => {
  await mockContext(page);
  await page.route('**/api/admin/prizes/activities/a1', (route) =>
    route.fulfill({
      json: [
        {
          id: 'p1',
          prize_level: '一等奖',
          prize_name: '定制礼盒',
          total_stock: 10,
          awarded_stock: 3,
          weight: '1',
        },
      ],
    }),
  );
  await page.goto('/admin/activities/a1/prizes');
  await compactRow(page.getByRole('row', { name: /定制礼盒/ }));
  const pointerTrigger = page.getByRole('button', {
    name: '奖品操作：定制礼盒',
  });
  await pointerTrigger.click();
  await page.getByRole('menuitem', { name: '添加库存' }).click();
  await expect(page.getByLabel('增加数量')).toBeFocused();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(pointerTrigger).toBeFocused();
  const trigger = await openActions(page, '奖品操作：定制礼盒');
  await page.getByRole('menuitem', { name: '添加库存' }).click();
  await expect(page.getByRole('dialog', { name: '添加库存' })).toBeVisible();
  await expect(page.getByLabel('增加数量')).toBeFocused();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(trigger).toBeFocused();
});

test('jobs separate identifiers and attempt counts while menu retry keeps pending geometry', async ({
  page,
}) => {
  await mockContext(page);
  await page.route('**/api/admin/jobs/failed', (route) =>
    route.fulfill({
      json: [
        { id: 'job-1', kind: 'EXPORT', attempts: 3, lastError: '服务暂不可用' },
      ],
    }),
  );
  let release!: () => void;
  await page.route('**/api/admin/jobs/job-1/retry', async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
  });
  await page.goto('/admin/jobs');
  await expect(
    page.getByRole('columnheader', { name: '任务 ID', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: '尝试次数', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('rowheader', { name: '线索导出', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'job-1', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '3', exact: true }),
  ).toBeVisible();
  const row = page.getByRole('row', { name: /job-1/ });
  await compactRow(row);
  const initial = await page
    .getByRole('button', { name: '任务操作：job-1', exact: true })
    .boundingBox();
  const trigger = await openActions(page, '任务操作：job-1');
  await page.getByRole('menuitem', { name: '重新处理' }).click();
  await expect(trigger).toBeDisabled();
  const pending = await trigger.boundingBox();
  expect(pending!.width).toBe(initial!.width);
  expect(pending!.height).toBe(initial!.height);
  await expect.poll(() => Boolean(release)).toBe(true);
  release();
  await expect(
    page.getByText('任务重试失败，请检查服务状态后再次操作。'),
  ).toBeVisible();
  await expect(trigger).toBeEnabled();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByRole('menuitem', { name: '重新处理' })).toBeVisible();
});

test('export row menu preserves refresh and real download link on narrow screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockContext(page);
  await page.route('**/api/admin/activities/a1/exports', (route) =>
    route.fulfill({ json: { jobId: 'export-1' } }),
  );
  let release!: () => void;
  await page.route('**/api/admin/exports/export-1', async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({
      json: {
        id: 'export-1',
        status: 'COMPLETED',
        rowCount: 5,
        downloadUrl: '/exports/export-1.xlsx',
      },
    });
  });
  await page.route('**/exports/export-1.xlsx', (route) =>
    route.fulfill({
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      headers: {
        'content-disposition': 'attachment; filename="export-1.xlsx"',
      },
      body: 'test export',
    }),
  );
  await page.goto('/admin/activities/a1/exports');
  await page.getByRole('button', { name: '生成 XLSX' }).click();
  await compactRow(page.getByRole('row', { name: /活动线索 XLSX/ }));
  const trigger = await openActions(page, '导出操作：export-1');
  await expect(page.getByRole('menuitem', { name: '下载文件' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: '刷新状态' }).click();
  await expect(trigger).toBeDisabled();
  await expect.poll(() => Boolean(release)).toBe(true);
  release();
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const download = page.getByRole('menuitem', { name: '下载文件' });
  await expect(download).toHaveAttribute('href', '/exports/export-1.xlsx');
  const downloadEvent = page.waitForEvent('download');
  await download.click();
  expect((await downloadEvent).suggestedFilename()).toBe('export-1.xlsx');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.getByRole('table').evaluate((table) => {
      let ancestor = table.parentElement;
      while (ancestor) {
        if (
          ancestor.scrollWidth > ancestor.clientWidth &&
          ['auto', 'scroll'].includes(getComputedStyle(ancestor).overflowX)
        )
          return true;
        ancestor = ancestor.parentElement;
      }
      return false;
    }),
  ).toBe(true);
});

test('read-only participants keep prize and redemption status in distinct compact columns', async ({
  page,
}) => {
  await mockContext(page);
  await page.route('**/api/admin/activities/a1/participants', (route) =>
    route.fulfill({
      json: [
        {
          id: 'u1',
          answers: {
            name: '张三',
            organization: '星火研究院',
            department: '分析实验室',
            jobTitle: '研究员',
            phone: '13800000000',
            email: 'participant@example.com',
            researchAreas: ['life_sciences', 'other'],
            researchAreaOther: '交叉研究',
            instrumentInterests: ['mass_spectrometry'],
            visitPurposes: ['new_products'],
            followUpPreferences: ['product_pdf'],
            contactPreference: 'email_first',
            onsiteAvailability: 'available',
          },
          lead_completed: true,
          channel_code: 'expo',
          prize_name: '定制礼盒',
          redemption_status: 'PENDING',
          created_at: '2026-09-10T00:00:00Z',
        },
      ],
    }),
  );
  await page.goto('/admin/activities/a1/participants');
  await expect(
    page.getByRole('columnheader', { name: '奖品', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: '核销状态', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '定制礼盒', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '处理中', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: '操作', exact: true }),
  ).toBeVisible();
  await compactRow(page.getByRole('row', { name: /张三/ }));
  await expect(
    page.getByRole('cell', { name: '星火研究院', exact: true }),
  ).toBeVisible();
  const trigger = await openActions(page, '参与者操作：张三');
  await page.getByRole('menuitem', { name: '查看登记详情' }).click();
  const dialog = page.getByRole('dialog', { name: '登记详情', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('dt')).toHaveCount(13);
  await expect(dialog).toContainText(
    '生命科学（制药、生物技术、CRO）；其他（交叉研究）',
  );
  await expect(dialog.locator('dd').last()).toHaveText('未填写');
  await expect(
    page.getByRole('button', { name: '关闭', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('menuitem', { name: '查看登记详情' }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(trigger).toBeFocused();
});

test('staff uses separate compact columns and a keyboard-accessible edit and status menu', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockContext(page);
  const staff = {
    id: 'staff-1',
    username: 'expo',
    display_name: '展会核销组',
    activity_ids: ['a1'],
    disabled_at: null as string | null,
  };
  await page.route('**/api/admin/activities', (route) =>
    route.fulfill({ json: [{ id: 'a1', name: '现场活动', code: 'expo' }] }),
  );
  await page.route('**/api/admin/staff', (route) =>
    route.fulfill({ json: [staff] }),
  );
  let statusCalls = 0;
  let release!: () => void;
  await page.route('**/api/admin/staff/staff-1/status', async (route) => {
    statusCalls++;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    expect(route.request().postDataJSON()).toEqual({ disabled: true });
    staff.disabled_at = '2026-09-11T00:00:00Z';
    await route.fulfill({ json: {} });
  });
  await page.goto('/admin/staff');
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  for (const name of [
    '显示名称',
    '账号',
    '活动权限',
    '授权数量',
    '状态',
    '操作',
  ]) {
    await expect(
      table.getByRole('columnheader', { name, exact: true }),
    ).toBeVisible();
  }
  const row = table.getByRole('row', { name: /展会核销组/ });
  await expect(
    row.getByRole('rowheader', { name: '展会核销组', exact: true }),
  ).toBeVisible();
  await expect(
    row.getByRole('cell', { name: '@expo', exact: true }),
  ).toBeVisible();
  await expect(
    row.getByRole('cell', { name: '现场活动', exact: true }),
  ).toBeVisible();
  await expect(
    row.getByRole('cell', { name: '已启用', exact: true }),
  ).toBeVisible();
  await compactRow(row);
  const trigger = await openActions(page, '工作人员操作：expo');
  await page.getByRole('menuitem', { name: '账号设置' }).click();
  const dialog = page.getByRole('dialog', { name: '账号设置' });
  await expect(dialog.getByLabel('显示名称', { exact: true })).toHaveValue(
    '展会核销组',
  );
  await expect(dialog.getByLabel('重置密码', { exact: true })).toHaveAttribute(
    'type',
    'password',
  );
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  const disable = page.getByRole('menuitem', { name: '停用账号' });
  await expect(disable).toHaveAttribute('data-accent-color', 'red');
  await disable.click();
  const confirmation = page.getByRole('alertdialog', {
    name: '停用工作人员账号？',
  });
  await expect(confirmation).toContainText('已有核销记录不会受到影响');
  await expect(
    confirmation.getByRole('button', { name: '取消' }),
  ).toBeFocused();
  expect(statusCalls).toBe(0);
  await confirmation.getByRole('button', { name: '取消' }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('menuitem', { name: '停用账号' }).click();
  await confirmation.getByRole('button', { name: '确认停用' }).click();
  await expect(trigger).toBeDisabled();
  await expect.poll(() => statusCalls).toBe(1);
  release();
  await expect(
    row.getByRole('cell', { name: '已停用', exact: true }),
  ).toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByRole('menuitem', { name: '启用账号' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await trigger.evaluate((button) => {
      let parent = button.parentElement;
      while (parent) {
        if (
          parent.scrollWidth > parent.clientWidth &&
          parent.scrollLeft > 0 &&
          ['auto', 'scroll'].includes(getComputedStyle(parent).overflowX)
        )
          return true;
        parent = parent.parentElement;
      }
      return false;
    }),
  ).toBe(true);
});
