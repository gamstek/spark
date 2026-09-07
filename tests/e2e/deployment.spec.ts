import { expect, test } from '@playwright/test';

const deploymentBaseUrl = process.env.DEPLOYMENT_BASE_URL;

test.describe('production same-origin routing', () => {
  test.skip(
    !deploymentBaseUrl,
    'DEPLOYMENT_BASE_URL is required for deployment checks',
  );

  for (const path of [
    '/activity/test-campaign',
    '/staff/redeem/test-code',
    '/admin/activities',
  ]) {
    test(`refreshes ${path}`, async ({ request }) => {
      const response = await request.get(
        new URL(path, deploymentBaseUrl).toString(),
      );

      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('text/html');
    });
  }

  test('does not serve the frontend fallback for unknown API routes', async ({
    request,
  }) => {
    const response = await request.get(
      new URL('/api/route-that-does-not-exist', deploymentBaseUrl).toString(),
    );

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');
  });
});
