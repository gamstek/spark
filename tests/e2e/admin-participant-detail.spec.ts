import { expect, type Page } from '@playwright/test';
import { test } from './admin-test';

const answers = {
  name: '张三',
  organization: '星火研究院',
  department: '分析实验室',
  jobTitle: '研究员',
  phone: '13800000000',
  email: 'participant@example.com',
  researchAreas: ['life_sciences', 'other'],
  researchAreaOther: '交叉研究',
  instrumentInterests: ['mass_spectrometry', 'other'],
  instrumentInterestOther: '新型检测技术',
  visitPurposes: ['new_products', 'technical_materials'],
  followUpPreferences: ['product_pdf', 'engineer_call'],
  contactPreference: 'email_first',
  onsiteAvailability: 'available',
};
const participant = {
  id: 'u1',
  answers,
  lead_completed: true,
  lead_completed_at: '2026-09-10T00:00:00Z',
  channel_code: 'expo',
  prize_name: null,
  redemption_status: null,
  created_at: '2026-09-10T00:00:00Z',
};

async function mockParticipants(page: Page, rows: unknown[] = [participant]) {
  await page.route('**/api/admin/auth/me', (route) =>
    route.fulfill({ json: { csrfToken: 'csrf' } }),
  );
  await page.route('**/api/admin/activities/a1', (route) =>
    route.fulfill({
      json: {
        id: 'a1',
        name: '现场活动',
        code: 'expo',
        revision: 1,
        published_version_id: 'v1',
        starts_at: '2020-01-01T00:00:00Z',
        config: {},
      },
    }),
  );
  await page.route('**/api/admin/activities/a1/participants', (route) =>
    route.fulfill({ json: rows }),
  );
  await page.goto('/admin/activities/a1/participants');
}

for (const theme of ['light', 'dark'] as const) {
  test(`renders all answers in order and keeps the ${theme} narrow dialog readable and keyboard contained`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(
      (value) => localStorage.setItem('spark-admin-theme', value),
      theme,
    );
    await mockParticipants(page);
    const trigger = page.getByRole('button', { name: '参与者操作：张三' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: '查看登记详情' }).click();
    const dialog = page.getByRole('dialog', { name: '登记详情', exact: true });
    const body = dialog.getByRole('region', { name: '完整登记答案' });
    const close = dialog.getByRole('button', { name: '关闭', exact: true });
    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();
    await expect(body.getByRole('term')).toHaveText([
      '01 姓名',
      '02 单位（公司/院校/研究所）全称',
      '03 部门/实验室/课题组',
      '04 职位/职称',
      '05 手机号码',
      '06 电子邮箱',
      '07 您的主要研究方向/应用领域（多选）',
      '08 您目前最关注的仪器类型或技术（多选）',
      '09 您此次关注的目的是（多选）',
      '10 您希望我们以何种方式为您提供后续信息？（多选题）',
      '11 您是否方便接受我们在1-2个工作日内致电进行简短的技术交流？',
      '12 您今天是否有时间在我们的展台进行更深入的交流？（可与工作人员确认安排）',
      '13 其他具体需求或咨询',
    ]);
    await expect(body.getByRole('definition')).toHaveText([
      '张三',
      '星火研究院',
      '分析实验室',
      '研究员',
      '13800000000',
      'participant@example.com',
      '生命科学（制药、生物技术、CRO）；其他（交叉研究）',
      '质谱类（高分辨质谱，三重四极杆质谱，MALDI-TOF 等）；其他（新型检测技术）',
      '了解新产品/新技术动态；获取技术资料',
      '发送详细产品技术资料（PDF）；预约资深应用工程师电话沟通',
      '请先通过邮件发送资料',
      '是',
      '未填写',
    ]);
    for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    await body.focus();
    await page.keyboard.press('Control+End');
    await expect(body.getByRole('definition').last()).toBeInViewport();
    await expect(close).toBeInViewport();
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
    expect(
      await body.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    // Measure effective opaque text/background contrast instead of asserting token names.
    const contrast = await body
      .getByRole('definition')
      .last()
      .evaluate((element) => {
        const rgb = (color: string) => color.match(/[\d.]+/g)!.map(Number);
        const foreground = rgb(getComputedStyle(element).color);
        let ancestor: Element | null = element;
        let background = [255, 255, 255];
        while (ancestor) {
          const color = rgb(getComputedStyle(ancestor).backgroundColor);
          if (color.length === 3 || color[3] === 1) {
            background = color;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        const luminance = (color: number[]) =>
          color.slice(0, 3).reduce((sum, channel, index) => {
            const value = channel / 255;
            return (
              sum +
              (value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4) *
                [0.2126, 0.7152, 0.0722][index]
            );
          }, 0);
        const light = luminance(foreground),
          dark = luminance(background);
        return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
      });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({
      path: testInfo.outputPath(`participant-detail-${theme}.png`),
    });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole('menuitem', { name: '查看登记详情' }).click();
    await close.click();
    await expect(trigger).toBeFocused();
  });
}

test('shows no detail action for an unsubmitted participant and an empty state for no participants', async ({
  page,
}) => {
  await mockParticipants(page, [
    {
      ...participant,
      id: 'u2',
      answers: null,
      lead_completed: false,
      lead_completed_at: null,
    },
  ]);
  await expect(
    page.getByRole('cell', { name: '暂无登记详情', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /参与者操作/ })).toHaveCount(0);
  await page.route('**/api/admin/activities/a1/participants', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.reload();
  await expect(page.getByText('暂无参与者', { exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});
