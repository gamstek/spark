import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'staff-shell-layout.spec.ts',
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:5174/staff/',
    channel: 'chrome',
  },
  webServer: {
    command: 'pnpm --filter @spark/staff dev',
    url: 'http://127.0.0.1:5174/staff/',
    reuseExistingServer: true,
  },
});
