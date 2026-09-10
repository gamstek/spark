import { expect, type Page } from '@playwright/test';
import { test } from './admin-test';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'short-desktop', width: 1280, height: 600 },
];

test('switches and persists the complete admin theme', async ({ page }) => {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto('/admin/activities');
  await page.getByRole('button', { name: '账号菜单' }).click();
  await page.getByRole('menuitemradio', { name: '深色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.app-workspace')).toHaveCSS(
    'background-color',
    'rgb(32, 29, 33)',
  );
  await expect(
    page.getByRole('link', { name: '创建第一个活动', exact: true }),
  ).toHaveCSS('background-color', 'rgb(217, 88, 109)');
  await page.screenshot({
    path: 'test-results/layout-theme-dark.png',
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '账号菜单' }).click();
  await expect(page.getByRole('menuitemradio', { name: '深色' })).toBeChecked();
  await page.getByRole('menuitemradio', { name: '浅色' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '账号菜单' }).click();
  await page.getByRole('menuitemradio', { name: '跟随系统' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('shows route context and closes the mobile drawer after navigation', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/admin/staff', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto('/admin/activities');
  await expect(page.locator('.app-sidebar')).toHaveCSS('position', 'fixed');
  await expect(page.locator('.app-sidebar .workspace-context')).toContainText(
    '活动运营',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开导航' }).click();
  const drawer = page.getByRole('dialog', { name: '工作空间导航' });
  await drawer.getByRole('link', { name: '工作人员', exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/admin\/staff$/);
  await page.getByRole('button', { name: '打开导航' }).click();
  await expect(drawer.locator('.workspace-context')).toContainText('现场协作');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '打开导航' })).toBeFocused();
  await expectNoDocumentOverflow(page);
});

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

test('keeps context text contrast accessible across themes and navigation surfaces', async ({
  page,
}) => {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto('/admin/activities');

  for (const theme of ['浅色', '深色']) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: '账号菜单' }).click();
    await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
    for (const mobile of [false, true]) {
      if (mobile) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: '打开导航' }).click();
      }
      const surface = page.locator(
        mobile ? '.mobile-navigation' : '.app-sidebar',
      );
      const contrast = await surface.evaluate((element) => {
        const luminance = (color: string) => {
          const channels = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((value) => {
              const channel = value / 255;
              return channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4;
            });
          return (
            channels[0]! * 0.2126 +
            channels[1]! * 0.7152 +
            channels[2]! * 0.0722
          );
        };
        const style = getComputedStyle(element);
        const backgrounds = [
          style.backgroundColor,
          ...style.backgroundImage.matchAll(/rgb\([^)]+\)/g),
        ].map((color) =>
          luminance(typeof color === 'string' ? color : color[0]),
        );
        return [
          ...element.querySelectorAll(
            '.app-sidebar__subtitle, .navigation-caption, .app-navigation__link:not(.is-active), .workspace-context__description',
          ),
        ].map((text) => {
          const foreground = luminance(getComputedStyle(text).color);
          return Math.min(
            ...backgrounds.map(
              (background) =>
                (Math.max(foreground, background) + 0.05) /
                (Math.min(foreground, background) + 0.05),
            ),
          );
        });
      });
      expect(contrast.length).toBeGreaterThan(0);
      for (const ratio of contrast) {
        expect(
          ratio,
          `${theme} ${mobile ? 'drawer' : 'sidebar'} normal text contrast`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      if (mobile) await page.keyboard.press('Escape');
    }
  }
});

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport });

    test('login error leaves the submit action and help text separate', async ({
      page,
    }) => {
      await page.addInitScript(() =>
        localStorage.setItem('spark-admin-theme', 'dark'),
      );
      await page.route('**/api/admin/auth/login', (route) =>
        route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED' } }),
      );
      await page.goto('/admin/login');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.locator('.login-form-area')).toHaveCSS(
        'background-color',
        'rgb(32, 29, 33)',
      );
      await expect(page.getByText('管理员账号', { exact: true })).toBeVisible();
      await expect(page.getByText('密码', { exact: true })).toBeVisible();
      await page.getByLabel('管理员账号', { exact: true }).fill('admin');
      await page.getByLabel('密码', { exact: true }).fill('invalid-password');
      await page.keyboard.press('Tab');
      const reveal = page.getByRole('button', {
        name: '显示密码',
        exact: true,
      });
      await expect(reveal).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute(
        'type',
        'text',
      );
      await page.getByRole('button', { name: '隐藏密码', exact: true }).click();
      await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute(
        'type',
        'password',
      );
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
      const contrast = await page
        .locator('.login-form-area')
        .evaluate((element) => {
          const luminance = (color: string) => {
            const [r, g, b] = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((value) => {
                const channel = value / 255;
                return channel <= 0.04045
                  ? channel / 12.92
                  : ((channel + 0.055) / 1.055) ** 2.4;
              });
            return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
          };
          const background = luminance(
            getComputedStyle(element).backgroundColor,
          );
          return [
            ...element.querySelectorAll(
              '.login-field label, .login-security, .login-help',
            ),
          ].map((text) => {
            const foreground = luminance(getComputedStyle(text).color);
            return (
              (Math.max(foreground, background) + 0.05) /
              (Math.min(foreground, background) + 0.05)
            );
          });
        });
      expect(contrast).toHaveLength(4);
      for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
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
      await page.route('**/api/admin/activities', (route) =>
        route.fulfill({ json: [] }),
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
      const trigger = page.getByRole('button', { name: `活动操作：${name}` });
      await trigger.scrollIntoViewIfNeeded();
      await expect(trigger).toBeInViewport();
      const tableOverflows = await page
        .locator('.ghost-table')
        .evaluate((element) => element.scrollWidth > element.clientWidth);
      if (tableOverflows) {
        expect(
          await trigger.evaluate((element) => {
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
      await trigger.click();
      const manage = page.getByRole('menuitem', { name: '管理', exact: true });
      await expect(manage).toBeInViewport();
      await manage.click();
      await expect(page).toHaveURL(/\/admin\/activities\/long-activity$/);
      await expect(
        page.getByRole('textbox', { name: '活动名称 （必填）', exact: true }),
      ).toHaveValue(name);
    });
  });
}
