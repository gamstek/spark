import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'short-desktop', width: 1280, height: 600 },
];

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport });

    test('login error leaves the submit action and help text separate', async ({
      page,
    }) => {
      await page.route('**/api/admin/auth/login', (route) =>
        route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED' } }),
      );
      await page.goto('/admin/login');
      await page.getByLabel('管理员账号', { exact: true }).fill('admin');
      await page.getByLabel('密码', { exact: true }).fill('invalid-password');
      const submit = page.getByRole('button', { name: '登录', exact: true });
      await submit.click();
      const error = page.getByRole('alert');
      await expect(error).toContainText('账号或密码错误');
      const security = page.getByText('仅限授权管理员访问');
      const help = page.getByText(
        '账号由管理员统一创建。如需帮助，请联系系统管理员。',
      );
      await help.scrollIntoViewIfNeeded();
      await expect(help).toBeInViewport();
      const [errorBox, submitBox, securityBox, helpBox] = await Promise.all([
        error.boundingBox(),
        submit.boundingBox(),
        security.boundingBox(),
        help.boundingBox(),
      ]);
      expect(submitBox!.y).toBeGreaterThanOrEqual(
        errorBox!.y + errorBox!.height,
      );
      expect(helpBox!.y).toBeGreaterThanOrEqual(
        securityBox!.y + securityBox!.height,
      );
      await expectNoDocumentOverflow(page);
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      await expect(submit).toBeEnabled();
      await page.screenshot({
        path: `test-results/layout-login-${viewport.name}.png`,
        fullPage: true,
      });
    });

    test('staff dialog keeps failed input and reachable actions', async ({
      page,
    }) => {
      await page.route('**/api/admin/auth/me', (route) =>
        route.fulfill({ json: { csrfToken: 'csrf' } }),
      );
      await page.route('**/api/admin/staff', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 400, json: {} })
          : route.fulfill({ json: [] }),
      );
      await page.goto('/admin/staff');
      const trigger = page.getByRole('button', {
        name: '创建工作人员',
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('登录名', { exact: true }).fill('shanghai-expo');
      await dialog
        .getByLabel('显示名称', { exact: true })
        .fill('上海国际品牌展会现场核销与客户服务工作人员');
      await dialog
        .getByLabel('初始密码', { exact: true })
        .fill('password12345');
      await dialog.getByRole('button', { name: '创建并授权' }).click();
      await expect(dialog.getByRole('alert')).toContainText('工作人员创建失败');
      await expect(dialog.getByLabel('显示名称', { exact: true })).toHaveValue(
        '上海国际品牌展会现场核销与客户服务工作人员',
      );
      await expectNoDocumentOverflow(page);
      const cancel = dialog.getByRole('button', { name: '取消', exact: true });
      await cancel.scrollIntoViewIfNeeded();
      await expect(cancel).toBeInViewport();
      await expect(
        dialog.getByRole('button', { name: '创建并授权' }),
      ).toBeInViewport();
      await page.screenshot({
        path: `test-results/layout-staff-${viewport.name}.png`,
      });
      await cancel.click();
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });

    test('long activity content scrolls inside the table and keeps management reachable', async ({
      page,
    }) => {
      const name =
        '上海国际品牌新品发布暨秋季城市生活方式体验活动——线上预约与线下互动抽奖特别场';
      await page.route('**/api/admin/activities/long-activity', (route) =>
        route.fulfill({
          json: { name, code: 'long-activity', revision: 1, config: {} },
        }),
      );
      await page.route('**/api/admin/auth/me', (route) =>
        route.fulfill({ json: { csrfToken: 'csrf' } }),
      );
      await page.route('**/api/admin/activities', (route) =>
        route.fulfill({
          json: [
            {
              id: 'long-activity',
              name,
              code: 'shanghai-international-brand-autumn-product-launch-and-city-lifestyle-experience',
              published_version_id: null,
              starts_at: null,
              ends_at: null,
            },
          ],
        }),
      );
      await page.goto('/admin/activities');
      await expect(page.getByText(name, { exact: true })).toBeVisible();
      await page.getByRole('textbox', { name: '搜索活动' }).fill('上海');
      await expect(page.getByText(name, { exact: true })).toBeVisible();
      await expectNoDocumentOverflow(page);
      const timeHeader = page.getByRole('columnheader', { name: '活动时间' });
      expect(
        await timeHeader.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return (
            range.getBoundingClientRect().height <=
            parseFloat(getComputedStyle(element).lineHeight)
          );
        }),
        'The date column heading should remain readable on one line.',
      ).toBe(true);
      const manage = page.getByRole('link', { name: '管理', exact: true });
      await manage.scrollIntoViewIfNeeded();
      await expect(manage).toBeInViewport();
      if (viewport.width <= 768) {
        expect(
          await manage.evaluate((element) => {
            let parent = element.parentElement;
            while (parent && parent !== document.body) {
              if (
                parent.scrollWidth > parent.clientWidth &&
                ['auto', 'scroll'].includes(
                  getComputedStyle(parent).overflowX,
                ) &&
                parent.scrollLeft > 0
              ) {
                return true;
              }
              parent = parent.parentElement;
            }
            return false;
          }),
        ).toBe(true);
      }
      await expectNoDocumentOverflow(page);
      await page.screenshot({
        path: `test-results/layout-activities-${viewport.name}.png`,
        fullPage: true,
      });
      await manage.click();
      await expect(page).toHaveURL(/\/admin\/activities\/long-activity$/);
      await expect(page.getByLabel('活动名称', { exact: true })).toHaveValue(
        name,
      );
    });
  });
}
