import { expect, test, type Page } from '@playwright/test';

const activity = {
  id: 'live-expo',
  name: '上海国际消费展',
  code: 'shanghai-expo',
  revision: 2,
  published_version_id: 'published-1',
  starts_at: '2020-09-08T02:00:00Z',
  draw_ends_at: '2099-09-10T10:00:00Z',
  ends_at: '2099-09-10T12:00:00Z',
  config: {},
};

const report = {
  visits: 1600,
  uniqueVisitors: 1400,
  participants: 1286,
  leads: 941,
  subscribed: 1000,
  totalStock: 300,
  awarded: 110,
  available: 190,
  pending: 92,
  redeemed: 18,
  expired: 0,
  channels: [],
  prizes: [],
};

async function mockWorkspace(page: Page) {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities', (route) =>
    route.fulfill({ json: [activity] }),
  );
  await page.route('**/api/admin/activities/live-expo', (route) =>
    route.fulfill({ json: activity }),
  );
  await page.route('**/api/admin/activities/live-expo/report', (route) =>
    route.fulfill({ json: report }),
  );
  await page.route('**/api/admin/jobs/failed', (route) =>
    route.fulfill({
      json: [
        {
          id: 'job-1',
          kind: 'DINGTALK_CALLBACK',
          attempts: 3,
          status: 'FAILED',
          lastError: 'upstream timeout',
          createdAt: '2026-09-10T02:32:00Z',
        },
        {
          id: 'job-2',
          kind: 'EXPORT',
          attempts: 2,
          status: 'FAILED',
          lastError: null,
          createdAt: '2026-09-10T02:22:00Z',
        },
      ],
    }),
  );
}

test('composes the approved operational zone from actual activity and failed-job data', async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.goto('/admin/activities');
  const context = page.locator('.app-sidebar .workspace-context');
  await expect(context.getByRole('region', { name: '当前活动' })).toBeVisible();
  await expect(context.getByRole('region', { name: '当前活动' })).toContainText(
    activity.name,
  );
  await expect(context.getByRole('region', { name: '当前活动' })).toContainText(
    '1,286',
  );
  await expect(context.getByRole('region', { name: '当前活动' })).toContainText(
    '92',
  );
  await expect(context.getByRole('region', { name: '当前活动' })).toContainText(
    '941',
  );
  await expect(context.getByRole('region', { name: '待处理' })).toContainText(
    '最近 2 项失败任务',
  );
  await expect(
    context.getByRole('link', { name: /检查钉钉表单回调/ }),
  ).toHaveAttribute('href', '/admin/jobs');
  await expect(
    context.getByRole('link', { name: '查看数据', exact: true }),
  ).toHaveAttribute('href', '/admin/activities/live-expo/report');
  await expect(page.locator('main .rt-Card')).toHaveCount(0);
  await expect(page.locator('main .ghost-table')).toHaveCount(1);
  await expect(page.locator('.app-workspace')).toHaveCSS(
    'background-image',
    /linear-gradient/,
  );
  await page.screenshot({
    path: 'test-results/composition-light-desktop.png',
    fullPage: true,
  });
});

test('keeps missing contextual data honest without fabricated metrics or tasks', async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.route('**/api/admin/activities', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/admin/jobs/failed', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await page.goto('/admin/activities');
  const context = page.locator('.app-sidebar .workspace-context');
  await expect(context.getByText('暂无进行中的活动')).toBeVisible();
  await expect(context.getByText('暂时无法读取失败任务')).toBeVisible();
  await expect(context.locator('.context-stat')).toHaveCount(0);
  await expect(context.locator('.context-task')).toHaveCount(0);
});

test('keeps normal-size primary action text at AA contrast in both themes', async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.goto('/admin/activities');
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      colorScheme,
    );
    const action = page.getByRole('link', { name: '新建活动', exact: true });
    for (const hovered of [false, true]) {
      if (hovered) await action.hover();
      else await page.mouse.move(0, 0);
      const ratio = await action.evaluate((element) => {
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
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return (
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05)
        );
      });
      expect(
        ratio,
        `${colorScheme} ${hovered ? 'hover' : 'idle'} primary contrast`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('offers a visible persistent theme switch across canvas tables and overlays', async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/admin/activities');
  const toggle = page.getByRole('button', {
    name: '切换为深色主题',
    exact: true,
  });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveClass(/rt-variant-ghost/);
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.app-workspace')).toHaveCSS(
    'background-image',
    /rgb\(32, 29, 33\).*rgb\(39, 31, 37\)/,
  );
  await expect(page.locator('main')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await expect(page.locator('.ghost-table')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await expect(page.locator('.ghost-table table')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await page.getByRole('button', { name: '账号菜单' }).click();
  await expect(
    page.getByRole('menuitemradio', { name: '深色', exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole('menuitemradio', { name: '跟随系统' }),
  ).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCSS(
    'background-color',
    'rgb(39, 31, 37)',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await page.screenshot({
    path: 'test-results/composition-dark-desktop.png',
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole('button', { name: '切换为浅色主题' }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '切换为浅色主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '账号菜单' }).click();
  await page.getByRole('menuitemradio', { name: '跟随系统' }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', { name: '切换为浅色主题' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '打开导航' }).click();
  await expect(page.getByRole('dialog', { name: '工作空间导航' })).toHaveCSS(
    'background-color',
    'rgb(40, 34, 38)',
  );
  await page.screenshot({
    path: 'test-results/composition-dark-drawer.png',
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('separates activity identity and URL into compact Ghost Table columns', async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.goto('/admin/activities');
  await expect(
    page.getByRole('heading', { level: 1, name: '让每一场活动，都井然有序' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: '活动列表' })
      .getByRole('heading', { name: '全部活动' }),
  ).toBeVisible();
  const identity = page.getByRole('rowheader', { name: /上海国际消费展/ });
  await expect(identity).not.toContainText('/activity/shanghai-expo');
  await expect(
    page.getByRole('columnheader', { name: '访问路径' }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '/activity/shanghai-expo', exact: true }),
  ).toBeVisible();
  await expect(identity).toHaveCSS('box-shadow', 'none');
  await expect(identity).toHaveCSS('border-bottom-width', '1px');
});

test('keeps activity rows compact and opens row management by keyboard and pointer', async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.goto('/admin/activities');
  const row = page.getByRole('row', { name: /上海国际消费展/ });
  expect.soft((await row.boundingBox())!.height).toBeLessThanOrEqual(60);
  const trigger = row.getByRole('button', { name: '活动操作：上海国际消费展' });
  await expect(trigger).toHaveClass(/rt-variant-ghost/);
  await expect(trigger).toHaveClass(/rt-r-size-1/);
  await expect(
    row.getByRole('link', { name: '管理', exact: true }),
  ).toHaveCount(0);
  await trigger.focus();
  await page.keyboard.press('Enter');
  const manage = page.getByRole('menuitem', { name: '管理', exact: true });
  await expect(manage).toBeVisible();
  await expect(manage).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await manage.click();
  await expect(page).toHaveURL(/\/admin\/activities\/live-expo$/);
  await expect(
    page.getByRole('heading', { level: 1, name: '活动设置' }),
  ).toBeVisible();
});

test('reserves activity context geometry during delayed identity and report loads', async ({
  page,
}) => {
  await mockWorkspace(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/admin/activities/live-expo', async (route) => {
    await gate;
    await route.fulfill({ json: activity });
  });
  await page.route(
    '**/api/admin/activities/live-expo/report',
    async (route) => {
      await gate;
      await route.fulfill({ json: report });
    },
  );
  await page.goto('/admin/activities/live-expo');
  const nav = page.getByRole('navigation', { name: '活动功能' });
  await expect(nav).toBeVisible();
  const before = await nav.boundingBox();
  release();
  await expect(
    page.locator('.app-sidebar .activity-context-identity'),
  ).toContainText(activity.name);
  await expect(page.getByRole('region', { name: '发布状态' })).toBeVisible();
  const after = await nav.boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
});

test('keeps editor save publish and end-draw controls within Radix size two', async ({
  page,
}) => {
  await mockWorkspace(page);
  await page.goto('/admin/activities/live-expo');
  for (const label of ['保存草稿', '发布活动', '提前结束抽奖']) {
    await expect(
      page.getByRole('button', { name: label, exact: true }),
    ).toHaveClass(/rt-r-size-2/);
  }
  await page.screenshot({
    path: 'test-results/composition-editor-controls.png',
    fullPage: true,
  });
});

test('removes resolved failed-task actions from context after a successful retry', async ({
  page,
}) => {
  await mockWorkspace(page);
  let queued = false;
  await page.route('**/api/admin/jobs/failed', (route) =>
    route.fulfill({
      json: queued
        ? []
        : [{ id: 'job-1', kind: 'EXPORT', attempts: 2, lastError: 'Timeout' }],
    }),
  );
  await page.route('**/api/admin/jobs/job-1/retry', (route) => {
    queued = true;
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin/jobs');
  const context = page.locator('.app-sidebar .workspace-context');
  await expect(context.locator('.context-task')).toHaveCount(1);
  await page.getByRole('button', { name: '任务操作：job-1' }).click();
  await page.getByRole('menuitem', { name: '重新处理' }).click();
  await expect(page.getByText('任务已重新进入处理队列。')).toBeVisible();
  await expect(context.getByText('当前没有失败任务')).toBeVisible();
  await expect(context.locator('.context-task')).toHaveCount(0);
});

for (const width of [1280, 1440]) {
  test(`keeps the approved proportional left zone and usable workspace at ${width}px`, async ({
    page,
  }) => {
    await mockWorkspace(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin/activities');
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const sidebar = await page.locator('.app-sidebar').boundingBox();
      const workspace = await page.locator('.app-workspace').boundingBox();
      const topbar = await page.locator('.app-topbar').boundingBox();
      expect(sidebar!.width / width).toBeGreaterThan(0.25);
      expect(sidebar!.width / width).toBeLessThan(0.27);
      expect(Math.abs(workspace!.x - sidebar!.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(topbar!.x - workspace!.x)).toBeLessThanOrEqual(1);
      expect(workspace!.width).toBeGreaterThan(width * 0.7);
      await expect(page.locator('.app-sidebar .context-stat')).toHaveCount(3);
      await page.screenshot({
        path: `test-results/composition-scale-${width}-${theme}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
    await page.goto('/admin/activities/new');
    await expect(page.getByRole('button', { name: '保存草稿' })).toBeVisible();
    expect(
      (await page.locator('.editor-form-content').boundingBox())!.width,
    ).toBeGreaterThan(480);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`restores highlighted translucent context materials in ${theme} theme`, async ({
    page,
  }) => {
    await mockWorkspace(page);
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/activities');
    for (const name of ['当前活动', '待处理']) {
      const panel = page
        .locator('.app-sidebar')
        .getByRole('region', { name, exact: true });
      await expect(panel).toHaveCSS(
        'background-color',
        theme === 'light'
          ? 'rgba(255, 255, 255, 0.32)'
          : 'rgba(23, 19, 23, 0.28)',
      );
      await expect(panel).toHaveCSS('background-image', /linear-gradient/);
      await expect(panel).toHaveCSS('box-shadow', /inset/);
      const material = await panel.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          top: Number(style.borderTopColor.match(/[\d.]+/g)!.at(-1)),
          bottom: Number(style.borderBottomColor.match(/[\d.]+/g)!.at(-1)),
        };
      });
      expect(material.top).toBeGreaterThan(material.bottom);
      expect(material.bottom).toBeGreaterThanOrEqual(
        theme === 'light' ? 0.7 : 0.13,
      );
    }
  });

  test(`restores a pointer-inert ambient circle behind desktop and mobile content in ${theme}`, async ({
    page,
  }) => {
    await mockWorkspace(page);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/admin/activities');
    for (const mobile of [false, true]) {
      await page.setViewportSize({
        width: mobile ? 390 : 1440,
        height: mobile ? 844 : 900,
      });
      if (mobile) await page.getByRole('button', { name: '打开导航' }).click();
      const surface = page.locator(
        mobile ? '.mobile-navigation' : '.app-sidebar',
      );
      const ambient = await surface.evaluate((element) => {
        const style = getComputedStyle(element, '::before');
        return {
          content: style.content,
          circle: style.backgroundImage,
          opacity: Number(style.opacity),
          pointerEvents: style.pointerEvents,
          zIndex: Number(style.zIndex),
        };
      });
      expect(ambient.content).toBe('""');
      expect(ambient.circle).toMatch(
        /radial-gradient\((?:circle )?180px at -30px calc\(100% - 70px\)/,
      );
      expect(ambient.circle).toContain(
        theme === 'light' ? 'rgb(201, 188, 233)' : 'rgb(126, 36, 64)',
      );
      expect(ambient.opacity).toBe(theme === 'light' ? 0.38 : 0.44);
      expect(ambient.pointerEvents).toBe('none');
      expect(ambient.zIndex).toBeLessThan(0);
      await expect(surface).toHaveCSS('isolation', 'isolate');
      const scroll = await surface.evaluate((element) => ({
        height: element.clientHeight,
        scrollHeight: element.scrollHeight,
        contentBottom:
          element.querySelector('.workspace-context')!.getBoundingClientRect()
            .bottom - element.getBoundingClientRect().top,
      }));
      if (scroll.contentBottom < scroll.height)
        expect(scroll.scrollHeight).toBe(scroll.height);
      if (mobile) {
        const drawerWidth = (await surface.boundingBox())!.width;
        expect(drawerWidth).toBeGreaterThan(320);
        expect(drawerWidth).toBeLessThanOrEqual(390 * 0.88);
        await expect(
          surface.getByRole('link', { name: '查看数据', exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: `test-results/composition-material-mobile-${theme}.png`,
          fullPage: true,
          animations: 'disabled',
        });
        await surface.getByRole('button', { name: '关闭导航' }).click();
        await expect(surface).toBeHidden();
        await expect(
          page.getByRole('button', { name: '打开导航' }),
        ).toBeFocused();
      }
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  });
}
