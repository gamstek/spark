import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: ['activity-runtime-provider.spec.ts', 'activity-form.spec.ts'],
  use: { baseURL: 'http://127.0.0.1:5175', channel: 'chrome' },
  webServer: {
    command: 'pnpm --filter @spark/admin dev',
    url: 'http://127.0.0.1:5175/admin/',
    reuseExistingServer: true,
  },
  reporter: 'line',
});
