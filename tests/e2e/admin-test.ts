import { test as base } from '@playwright/test';

// Context panels add read-only requests to every authenticated route. Individual
// tests register their business fixtures afterwards and take precedence here.
export const test = base.extend<{ workspaceContext: void }>({
  workspaceContext: [
    async ({ page }, use) => {
      await page.route('**/api/admin/activities', (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({ json: [] })
          : route.fallback(),
      );
      await page.route('**/api/admin/activities/*/report', (route) =>
        route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } }),
      );
      await page.route('**/api/admin/jobs/failed', (route) =>
        route.fulfill({ json: [] }),
      );
      await use();
    },
    { auto: true },
  ],
});
