import { expect, test, type Page } from '@playwright/test';

const textAnswers = [
  ['姓名', '张三'],
  ['单位（公司/院校/研究所）全称', '星火研究院'],
  ['部门/实验室/课题组', '分析实验室'],
  ['职位/职称', '研究员'],
  ['手机号码', '+86 138 0000 0000 转 2'],
  ['电子邮箱', '请通过助理联系'],
] as const;
const expectedSubmission = {
  name: '张三',
  organization: '星火研究院',
  department: '分析实验室',
  jobTitle: '研究员',
  phone: '+86 138 0000 0000 转 2',
  email: '请通过助理联系',
  researchAreas: ['life_sciences', 'other'],
  researchAreaOther: '交叉研究',
  instrumentInterests: ['mass_spectrometry', 'other'],
  instrumentInterestOther: '新型检测技术',
  visitPurposes: ['new_products'],
  followUpPreferences: ['product_pdf'],
  contactPreference: 'email_first',
  onsiteAvailability: 'available',
  otherNeeds: '',
  privacyAccepted: true,
};

async function mockForm(page: Page, failure?: '500' | 'lost', delayed = false) {
  const state = {
    submissions: [] as unknown[],
    runtimeReads: 0,
    authenticated: false,
    submitted: false,
  };
  let release!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/activity/demo/session**', (route) => {
    state.authenticated = true;
    return route.fulfill({ json: { authenticated: true } });
  });
  await page.route('**/api/activity/demo/runtime**', (route) => {
    state.runtimeReads++;
    return route.fulfill(
      state.authenticated
        ? {
            json: {
              activityCode: 'demo',
              templateId: 'exhibition-lottery',
              templateVersion: 1,
              participationId: '4c057be5-6902-4493-9440-cab1a1adcf3c',
              nextStep: state.submitted ? 'LOTTERY' : 'FORM',
              win: null,
              csrfToken: 'csrf-token-for-form',
            },
          }
        : { status: 401, json: { code: 'UNAUTHORIZED' } },
    );
  });
  await page.route('**/api/activity/demo/info', (route) =>
    route.fulfill({
      json: {
        code: 'demo',
        name: '展会活动',
        startsAt: '2026-09-10T00:00:00.000Z',
        drawEndsAt: '2026-09-12T00:00:00.000Z',
        endsAt: '2026-09-12T12:00:00.000Z',
        rulesText: '活动规则',
        noPrizeWeight: 0,
        prizes: [],
      },
    }),
  );
  await page.route('**/api/activity/demo/form-submissions', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe(
      'csrf-token-for-form',
    );
    state.submissions.push(route.request().postDataJSON());
    if (delayed) await responseGate;
    if (failure && state.submissions.length === 1) {
      if (failure === 'lost') return route.abort('failed');
      return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR' } });
    }
    state.submitted = true;
    return route.fulfill({ json: { submitted: true } });
  });
  await page.goto('/activity/demo');
  await page.getByRole('button', { name: '立即参与' }).click();
  await expect(
    page.getByRole('heading', { name: '行业专家信息登记与技术交流预约' }),
  ).toBeVisible();
  return { state, release };
}

async function fillText(page: Page) {
  for (const [label, value] of textAnswers)
    await page
      .getByRole('textbox', {
        name: new RegExp(label.replace(/[（）/]/g, '\\$&')),
      })
      .fill(value);
}

async function fillChoices(page: Page) {
  await page
    .getByRole('checkbox', {
      name: '生命科学（制药、生物技术、CRO）',
      exact: true,
    })
    .check();
  await page
    .getByRole('checkbox', {
      name: '质谱类（高分辨质谱，三重四极杆质谱，MALDI-TOF 等）',
      exact: true,
    })
    .check();
  await page
    .getByRole('checkbox', { name: '了解新产品/新技术动态', exact: true })
    .check();
  await page
    .getByRole('checkbox', { name: '发送详细产品技术资料（PDF）', exact: true })
    .check();
  await page
    .getByRole('radio', { name: '请先通过邮件发送资料', exact: true })
    .check();
  await page.getByRole('radio', { name: '是', exact: true }).check();
}

async function fillOthers(page: Page) {
  await page
    .getByRole('group', { name: /07/ })
    .getByRole('checkbox', { name: '其他', exact: true })
    .check();
  await page
    .getByRole('textbox', { name: /其他研究方向\/应用领域说明/ })
    .fill('交叉研究');
  await page
    .getByRole('group', { name: /08/ })
    .getByRole('checkbox', { name: '其他', exact: true })
    .check();
  await page
    .getByRole('textbox', { name: /其他仪器类型或技术说明/ })
    .fill('新型检测技术');
}

async function fillForm(page: Page) {
  await fillText(page);
  await fillChoices(page);
  await fillOthers(page);
}

test.describe('anonymous self-hosted activity form', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'development-simulation',
      'Form journey exercises the anonymous, non-WeChat browser',
    );
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('submits all 13 questions with stable codes and CSRF, then explicitly refreshes into lottery', async ({
    page,
  }) => {
    const { state } = await mockForm(page);
    await fillForm(page);
    const consent = page.getByRole('checkbox', { name: /我已阅读并同意/ });
    await expect(consent).not.toBeChecked();
    const privacy = page.getByRole('button', {
      name: '用户活动隐私协议',
      exact: true,
    });
    await privacy.click();
    await expect(
      page.getByRole('dialog', { name: '用户活动隐私协议', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '关闭用户活动隐私协议' }).click();
    await expect(privacy).toBeFocused();
    await expect(consent).not.toBeChecked();
    await page.getByRole('button', { name: '提交信息' }).click();
    await expect(consent).toBeFocused();
    await expect(consent).toHaveAttribute('aria-invalid', 'true');
    await expect(
      page.getByText('请阅读并同意用户活动隐私协议', { exact: true }),
    ).toBeVisible();
    expect(state.submissions).toEqual([]);
    await consent.check();
    await page.getByRole('button', { name: '提交信息' }).click();
    await expect(
      page
        .getByRole('banner')
        .getByRole('heading', { name: '提交成功', exact: true }),
    ).toBeVisible();
    expect(state.submissions).toEqual([expectedSubmission]);
    const reads = state.runtimeReads;
    await expect(page.getByRole('button', { name: '开始抽奖' })).toHaveCount(0);
    await page.getByRole('button', { name: '去抽奖' }).click();
    await expect(page.getByRole('button', { name: '开始抽奖' })).toBeVisible();
    expect(state.runtimeReads).toBeGreaterThan(reads);
    expect(state.submissions).toHaveLength(1);
  });

  test('requires questions 01–12 and consent, focuses the first error, and leaves 13 optional', async ({
    page,
  }) => {
    const { state } = await mockForm(page);
    const submit = page.getByRole('button', { name: '提交信息' });
    await submit.click();
    await expect(
      page.getByRole('textbox', { name: /01\s*姓名/ }),
    ).toBeFocused();
    for (const [label] of textAnswers)
      await expect(
        page.getByRole('textbox', {
          name: new RegExp(label.replace(/[（）/]/g, '\\$&')),
        }),
      ).toHaveAttribute('aria-invalid', 'true');
    for (const number of ['07', '08', '09', '10', '11', '12'])
      await expect(
        page.getByRole('group', { name: new RegExp(`^${number}`) }),
      ).toHaveAttribute('aria-invalid', 'true');
    await expect(
      page.getByRole('textbox', { name: /13\s*其他具体需求或咨询/ }),
    ).toHaveAttribute('aria-invalid', 'false');
    await fillText(page);
    await submit.click();
    await expect(
      page.getByRole('checkbox', {
        name: '生命科学（制药、生物技术、CRO）',
        exact: true,
      }),
    ).toBeFocused();
    await fillChoices(page);
    await submit.click();
    await expect(
      page.getByRole('checkbox', { name: /我已阅读并同意/ }),
    ).toBeFocused();
    expect(state.submissions).toEqual([]);
    await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
    await submit.click();
    await expect(
      page
        .getByRole('banner')
        .getByRole('heading', { name: '提交成功', exact: true }),
    ).toBeVisible();
  });

  test('requires both other explanations and removes stale explanations when unchecked', async ({
    page,
  }) => {
    const { state } = await mockForm(page);
    await fillForm(page);
    await page
      .getByRole('textbox', { name: /其他研究方向\/应用领域说明/ })
      .fill('');
    await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
    await page
      .getByRole('textbox', { name: /其他仪器类型或技术说明/ })
      .fill('');
    await page.getByRole('button', { name: '提交信息' }).click();
    await expect(
      page.getByRole('textbox', { name: /其他研究方向\/应用领域说明/ }),
    ).toBeFocused();
    await expect(
      page.getByRole('textbox', { name: /其他仪器类型或技术说明/ }),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(state.submissions).toEqual([]);
    await page
      .getByRole('textbox', { name: /其他研究方向\/应用领域说明/ })
      .fill('过时研究说明');
    await page
      .getByRole('textbox', { name: /其他仪器类型或技术说明/ })
      .fill('过时仪器说明');
    for (const number of ['07', '08'])
      await page
        .getByRole('group', { name: new RegExp(number) })
        .getByRole('checkbox', { name: '其他', exact: true })
        .uncheck();
    await expect(page.getByRole('textbox', { name: /其他.*说明/ })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: '提交信息' }).click();
    await expect(
      page
        .getByRole('banner')
        .getByRole('heading', { name: '提交成功', exact: true }),
    ).toBeVisible();
    expect(state.submissions).toEqual([
      {
        name: '张三',
        organization: '星火研究院',
        department: '分析实验室',
        jobTitle: '研究员',
        phone: '+86 138 0000 0000 转 2',
        email: '请通过助理联系',
        visitPurposes: ['new_products'],
        followUpPreferences: ['product_pdf'],
        contactPreference: 'email_first',
        onsiteAvailability: 'available',
        otherNeeds: '',
        privacyAccepted: true,
        researchAreas: ['life_sciences'],
        instrumentInterests: ['mass_spectrometry'],
      },
    ]);
  });

  test('accepts conventional phone and email values as well as the non-format-validated contact values', async ({
    page,
  }) => {
    const { state } = await mockForm(page);
    await fillForm(page);
    await page.getByRole('textbox', { name: /手机号码/ }).fill('13800000000');
    await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
    await page
      .getByRole('textbox', { name: /电子邮箱/ })
      .fill('participant@example.com');
    await page.getByRole('button', { name: '提交信息' }).click();
    await expect(page.getByRole('button', { name: '去抽奖' })).toBeVisible();
    expect(state.submissions).toEqual([
      {
        ...expectedSubmission,
        phone: '13800000000',
        email: 'participant@example.com',
      },
    ]);
  });

  test('suppresses a second activation while pending without changing button size', async ({
    page,
  }) => {
    const { state, release } = await mockForm(page, undefined, true);
    try {
      await fillForm(page);
      const submit = page.getByRole('button', { name: '提交信息' });
      await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
      const before = await submit.boundingBox();
      await submit.dblclick();
      const pending = page.getByRole('button', { name: '提交中…' });
      await expect(pending).toBeDisabled();
      await expect(pending).toHaveAttribute('aria-busy', 'true');
      const during = await pending.boundingBox();
      expect(during?.width).toBe(before?.width);
      expect(during?.height).toBe(before?.height);
      await page.keyboard.press('Enter');
      expect(state.submissions).toEqual([expectedSubmission]);
      release();
      await expect(
        page
          .getByRole('banner')
          .getByRole('heading', { name: '提交成功', exact: true }),
      ).toBeVisible();
      expect(state.submissions).toHaveLength(1);
    } finally {
      release();
    }
  });

  for (const failure of ['500', 'lost'] as const) {
    test(`preserves every answer after ${failure} and retries the identical submission`, async ({
      page,
    }) => {
      const { state } = await mockForm(page, failure);
      await fillForm(page);
      await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
      await page
        .getByRole('textbox', { name: /13\s*其他具体需求或咨询/ })
        .fill('请安排下午的技术交流');
      await page.getByRole('button', { name: '提交信息' }).click();
      await expect(page.getByRole('alert')).toHaveText(
        '提交结果尚未确认，请检查网络后重试',
      );
      for (const [label, value] of textAnswers)
        await expect(
          page.getByRole('textbox', {
            name: new RegExp(label.replace(/[（）/]/g, '\\$&')),
          }),
        ).toHaveValue(value);
      await expect(
        page.getByRole('textbox', { name: /其他研究方向\/应用领域说明/ }),
      ).toHaveValue('交叉研究');
      await expect(
        page.getByRole('textbox', { name: /其他仪器类型或技术说明/ }),
      ).toHaveValue('新型检测技术');
      await expect(
        page.getByRole('checkbox', { name: /我已阅读并同意/ }),
      ).toBeChecked();
      await page.getByRole('button', { name: '提交信息' }).click();
      await expect(
        page
          .getByRole('banner')
          .getByRole('heading', { name: '提交成功', exact: true }),
      ).toBeVisible();
      const body = {
        ...expectedSubmission,
        otherNeeds: '请安排下午的技术交流',
      };
      expect(state.submissions).toEqual([body, body]);
    });
  }

  for (const height of [844, 640]) {
    test(`keeps errors and long privacy content reachable at 390×${height} with keyboard and reduced motion`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 390, height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await mockForm(page);
      await page.getByRole('button', { name: '提交信息' }).click();
      await expect(
        page.getByRole('textbox', { name: /01\s*姓名/ }),
      ).toBeFocused();
      const rail = [];
      for (let number = 1; number <= 13; number++) {
        const bounds = await page
          .getByText(String(number).padStart(2, '0'), { exact: true })
          .boundingBox();
        rail.push(bounds!.x);
      }
      expect(Math.max(...rail) - Math.min(...rail)).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: testInfo.outputPath('form-errors.png'),
        fullPage: true,
      });
      const last = page.getByRole('textbox', {
        name: /13\s*其他具体需求或咨询/,
      });
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const privacy = page.getByRole('button', {
        name: '用户活动隐私协议',
        exact: true,
      });
      await privacy.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', {
        name: '用户活动隐私协议',
        exact: true,
      });
      const body = page.getByRole('region', { name: '用户活动隐私协议正文' });
      const close = page.getByRole('button', { name: '关闭用户活动隐私协议' });
      await expect(body).toBeFocused();
      const documentScroll = await page.evaluate(() => scrollY);
      await page.keyboard.press('Control+End');
      await expect
        .poll(() => body.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      expect(await page.evaluate(() => scrollY)).toBe(documentScroll);
      await expect(close).toBeInViewport();
      await expect(
        dialog.getByRole('heading', {
          name: '用户活动隐私协议',
          exact: true,
          level: 2,
        }),
      ).toBeInViewport();
      const bounds = await dialog.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
      for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
        await page.keyboard.press(key);
        expect(
          await dialog.evaluate((element) =>
            element.contains(document.activeElement),
          ),
        ).toBe(true);
      }
      await page.screenshot({
        path: testInfo.outputPath('privacy-dialog.png'),
      });
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(privacy).toBeFocused();
      await expect(
        page.getByRole('checkbox', { name: /我已阅读并同意/ }),
      ).not.toBeChecked();
    });
  }
});
