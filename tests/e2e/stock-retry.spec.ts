import { expect, test, type Page } from '@playwright/test';

type StockOperation = {
  operationId: string;
  quantity: number;
};

async function mockPrizePage(
  page: Page,
  getTotalStock: () => number,
  options: { failRefresh?: boolean } = {},
) {
  let prizeListReads = 0;

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
  await page.route('**/api/admin/prizes/activities/a1', async (route) => {
    prizeListReads += 1;
    if (options.failRefresh && prizeListReads > 1) {
      await route.fulfill({ status: 503, body: 'TEMPORARILY_UNAVAILABLE' });
      return;
    }
    await route.fulfill({
      json: [
        {
          id: 'p1',
          prize_name: '定制礼盒',
          total_stock: getTotalStock(),
          awarded_stock: 3,
          weight: '1',
        },
      ],
    });
  });
}

function stockRow(page: Page) {
  return page.getByRole('row', { name: /定制礼盒/ });
}

test('retries an uncertain stock addition without adding inventory twice', async ({
  page,
}) => {
  let totalStock = 10;
  let requestNumber = 0;
  const appliedOperations = new Set<string>();
  const requests: StockOperation[] = [];

  await mockPrizePage(page, () => totalStock);
  await page.route(
    '**/api/admin/prizes/activity-prizes/p1/stock',
    async (route) => {
      const operation = route.request().postDataJSON() as StockOperation;
      requests.push(operation);
      requestNumber += 1;
      if (!appliedOperations.has(operation.operationId)) {
        appliedOperations.add(operation.operationId);
        totalStock += operation.quantity;
      }

      if (requestNumber === 1) {
        await route.abort('failed');
        return;
      }
      await route.fulfill({ json: { success: true } });
    },
  );

  await page.goto('/admin/activities/a1/prizes');
  await page.getByRole('button', { name: '添加库存' }).click();
  await page.getByLabel('增加数量').fill('5');
  await page.getByRole('button', { name: '确认添加' }).click();

  await expect(
    page.getByText('本次添加结果尚未确认，请按原数量重试。'),
  ).toBeVisible();
  await expect(page.getByLabel('增加数量')).toHaveValue('5');
  await expect(page.getByLabel('增加数量')).toBeDisabled();

  await page.getByRole('button', { name: '取消' }).click();
  await page.getByRole('button', { name: '添加库存' }).click();
  await expect(page.getByLabel('增加数量')).toHaveValue('5');
  await expect(page.getByLabel('增加数量')).toBeDisabled();
  await page.getByRole('button', { name: '重试添加' }).click();

  await expect(page.getByText('库存已添加')).toBeVisible();
  await expect(stockRow(page).getByRole('cell').nth(2)).toHaveText('15');
  expect(requests[1].operationId).toBe(requests[0].operationId);
  expect(requests[1].quantity).toBe(5);

  await page.getByRole('button', { name: '添加库存' }).click();
  await expect(page.getByLabel('增加数量')).toBeEnabled();
  await expect(page.getByLabel('增加数量')).toHaveValue('');
  await page.getByLabel('增加数量').fill('2');
  await page.getByRole('button', { name: '确认添加' }).click();

  await expect(stockRow(page).getByRole('cell').nth(2)).toHaveText('17');
  expect(requests[2].operationId).not.toBe(requests[0].operationId);
});

test('coalesces repeated submits while a stock addition is in flight', async ({
  page,
}) => {
  let totalStock = 10;
  const appliedOperations = new Set<string>();
  const requests: StockOperation[] = [];
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });

  await mockPrizePage(page, () => totalStock);
  await page.route(
    '**/api/admin/prizes/activity-prizes/p1/stock',
    async (route) => {
      const operation = route.request().postDataJSON() as StockOperation;
      requests.push(operation);
      if (!appliedOperations.has(operation.operationId)) {
        appliedOperations.add(operation.operationId);
        totalStock += operation.quantity;
      }
      await responseGate;
      await route.fulfill({ json: { success: true } });
    },
  );

  await page.goto('/admin/activities/a1/prizes');
  await page.getByRole('button', { name: '添加库存' }).click();
  await page.getByLabel('增加数量').fill('5');
  await page.getByRole('button', { name: '确认添加' }).evaluate((button) => {
    const form = button.closest('form');
    if (!(form instanceof HTMLFormElement)) throw new Error('Form not found');
    if (!(button instanceof HTMLButtonElement))
      throw new Error('Button not found');
    form.requestSubmit(button);
    form.requestSubmit(button);
  });

  await expect.poll(() => requests.length).toBe(1);
  await expect(page.getByRole('button', { name: '确认添加' })).toBeDisabled();
  releaseResponse();

  await expect(page.getByText('库存已添加')).toBeVisible();
  await expect(stockRow(page).getByRole('cell').nth(2)).toHaveText('15');
});

test('allows correction after the server rejects a stock quantity', async ({
  page,
}) => {
  let totalStock = 10;
  const requests: StockOperation[] = [];

  await mockPrizePage(page, () => totalStock);
  await page.route(
    '**/api/admin/prizes/activity-prizes/p1/stock',
    async (route) => {
      const operation = route.request().postDataJSON() as StockOperation;
      requests.push(operation);
      if (requests.length === 1) {
        await route.fulfill({
          status: 400,
          json: {
            code: 'INVALID_STOCK_QUANTITY',
            message: 'INVALID_STOCK_QUANTITY',
            requestId: 'request-1',
          },
        });
        return;
      }
      totalStock += operation.quantity;
      await route.fulfill({ json: { success: true } });
    },
  );

  await page.goto('/admin/activities/a1/prizes');
  await page.getByRole('button', { name: '添加库存' }).click();
  await page.getByLabel('增加数量').fill('9007199254740992');
  await page.getByRole('button', { name: '确认添加' }).click();

  await expect(
    page.getByText('增加数量无效，请输入安全范围内的正整数。'),
  ).toBeVisible();
  await expect(page.getByLabel('增加数量')).toBeEnabled();
  await page.getByLabel('增加数量').fill('5');
  await page.getByRole('button', { name: '确认添加' }).click();

  await expect(page.getByText('库存已添加')).toBeVisible();
  await expect(stockRow(page).getByRole('cell').nth(2)).toHaveText('15');
  expect(requests[1].operationId).not.toBe(requests[0].operationId);
});

test('clears stale success feedback when a later stock addition is uncertain', async ({
  page,
}) => {
  let totalStock = 10;
  let requestNumber = 0;

  await mockPrizePage(page, () => totalStock);
  await page.route(
    '**/api/admin/prizes/activity-prizes/p1/stock',
    async (route) => {
      const operation = route.request().postDataJSON() as StockOperation;
      requestNumber += 1;
      totalStock += operation.quantity;
      if (requestNumber === 2) {
        await route.abort('failed');
        return;
      }
      await route.fulfill({ json: { success: true } });
    },
  );

  await page.goto('/admin/activities/a1/prizes');
  await page.getByRole('button', { name: '添加库存' }).click();
  await page.getByLabel('增加数量').fill('5');
  await page.getByRole('button', { name: '确认添加' }).click();
  await expect(page.getByText('库存已添加')).toBeVisible();

  await page.getByRole('button', { name: '添加库存' }).click();
  await page.getByLabel('增加数量').fill('2');
  await page.getByRole('button', { name: '确认添加' }).click();

  await expect(page.getByText('库存已添加')).toBeHidden();
  await expect(
    page.getByText('本次添加结果尚未确认，请按原数量重试。'),
  ).toBeVisible();
});

test('reports a refresh failure separately after stock was added', async ({
  page,
}) => {
  let totalStock = 10;

  await mockPrizePage(page, () => totalStock, { failRefresh: true });
  await page.route(
    '**/api/admin/prizes/activity-prizes/p1/stock',
    async (route) => {
      const operation = route.request().postDataJSON() as StockOperation;
      totalStock += operation.quantity;
      await route.fulfill({ json: { success: true } });
    },
  );

  await page.goto('/admin/activities/a1/prizes');
  await page.getByRole('button', { name: '添加库存' }).click();
  await page.getByLabel('增加数量').fill('5');
  await page.getByRole('button', { name: '确认添加' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByText('库存已添加')).toBeVisible();
  await expect(
    page.getByText('库存数据刷新失败，请刷新页面查看最新结果。'),
  ).toBeVisible();
  await expect(stockRow(page).getByRole('cell').nth(2)).toHaveText('10');
});
