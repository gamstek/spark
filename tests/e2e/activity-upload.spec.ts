import { expect } from '@playwright/test';
import { test } from './admin-test';

const hero = {
  name: 'hero.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  ),
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities/a1', (route) =>
    route.fulfill({
      json: {
        id: 'a1',
        name: '展会活动',
        code: 'exhibition',
        revision: 0,
        published_version_id: null,
        starts_at: '2099-01-01T00:00:00Z',
        draw_ends_at: '2099-01-02T00:00:00Z',
        ends_at: '2099-01-03T00:00:00Z',
        redeem_ends_at: '2099-01-04T00:00:00Z',
        config: {
          requireSubscribe: true,
          noPrizeWeight: 1,
          heroAssetId: 'old-hero',
          rulesText: '数量有限，先到先得',
        },
      },
    }),
  );
});

for (const failure of ['rejected', 'network'] as const) {
  test(`preserves the draft and allows retry after a ${failure} hero upload`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    const drafts: { name: string; config: { heroAssetId: string } }[] = [];
    let attempts = 0;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/admin/media', (route) => {
      attempts += 1;
      if (attempts > 1) return route.fulfill({ json: { id: 'uploaded-hero' } });
      return failure === 'network'
        ? route.abort('failed')
        : route.fulfill({
            status: 400,
            json: { code: 'MEDIA_TOO_LARGE', message: 'MEDIA_TOO_LARGE' },
          });
    });
    await page.route('**/api/admin/activities/a1/draft', (route) => {
      drafts.push(route.request().postDataJSON());
      return route.fulfill({ json: { revision: 1 } });
    });

    if (failure === 'network')
      await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/admin/activities/a1');
    await page.getByPlaceholder('活动名称').fill('修改后的活动');
    await page.getByLabel('上传新主图').setInputFiles(hero);
    await page.getByRole('button', { name: '保存草稿' }).click();

    await expect(page.getByText(/主图上传失败/)).toBeVisible();
    await expect(page.getByPlaceholder('活动名称')).toHaveValue('修改后的活动');
    await expect(page.getByLabel('上传新主图')).toHaveValue(/hero\.png$/);
    expect(drafts).toEqual([]);
    expect(errors).toEqual([]);
    await page.getByText(/主图上传失败/).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath('upload-error.png'),
      fullPage: true,
    });

    await page.getByRole('button', { name: '保存草稿' }).click();
    await expect(page.getByText('草稿已保存')).toBeVisible();
    await expect(page.getByText(/主图上传失败/)).toHaveCount(0);
    expect(drafts).toEqual([
      expect.objectContaining({
        name: '修改后的活动',
        config: expect.objectContaining({ heroAssetId: 'uploaded-hero' }),
      }),
    ]);
    expect(errors).toEqual([]);
  });
}

test('prevents duplicate draft submissions while the hero is uploading', async ({
  page,
}) => {
  let finishUpload!: () => void;
  const uploadReady = new Promise<void>((resolve) => {
    finishUpload = resolve;
  });
  let uploads = 0;
  const drafts: unknown[] = [];
  await page.route('**/api/admin/media', async (route) => {
    uploads += 1;
    await uploadReady;
    await route.fulfill({ json: { id: 'uploaded-hero' } });
  });
  await page.route('**/api/admin/activities/a1/draft', (route) => {
    drafts.push(route.request().postDataJSON());
    return route.fulfill({ json: { revision: 1 } });
  });

  try {
    await page.goto('/admin/activities/a1');
    await page.getByLabel('上传新主图').setInputFiles(hero);
    const save = page.getByRole('button', { name: '保存草稿' });
    await save.click();
    await expect.poll(() => uploads).toBe(1);
    await expect(save).toBeDisabled();
    await page.getByPlaceholder('活动名称').press('Enter');
    finishUpload();

    await expect(page.getByText('草稿已保存')).toBeVisible();
    await expect(save).toBeEnabled();
    expect(uploads).toBe(1);
    expect(drafts).toHaveLength(1);
  } finally {
    finishUpload();
  }
});
