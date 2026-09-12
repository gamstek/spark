import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: ['activity-runtime-provider.spec.ts', 'activity-form.spec.ts'],
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  projects: [
    {
      name: 'anonymous-browser',
      use: {
        baseURL: 'http://127.0.0.1:5181',
        channel: 'chrome',
      },
    },
    {
      name: 'development-simulation',
      use: {
        baseURL: 'http://127.0.0.1:5182',
        channel: 'chrome',
      },
    },
  ],
  webServer: [
    {
      command:
        'pnpm --filter @spark/activity exec vite --host 127.0.0.1 --port 5181',
      url: 'http://127.0.0.1:5181/activity/',
      reuseExistingServer: true,
    },
    {
      command:
        'pnpm --filter @spark/activity exec vite --host 127.0.0.1 --port 5182',
      env: { VITE_WECHAT_MODE: 'simulate' },
      url: 'http://127.0.0.1:5182/activity/',
      reuseExistingServer: true,
    },
  ],
});
