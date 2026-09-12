import { describe, expect, it } from 'vitest';

import {
  LotteryConfigSchema,
  activityFormOptionLabels,
  formatActivityFormAnswers,
  getTemplate,
  type ActivityFormAnswerValues,
} from './index.js';

const validConfig = {
  formId: 'form-exhibition-2026',
  formUrl: 'https://alidocs.dingtalk.com/notable/share/form/example',
  prefillField: 'participationId',
  fieldMapping: {
    participationId: '参与记录ID',
    name: '姓名',
    phone: '手机号',
  },
  requireSubscribe: true,
  noPrizeWeight: 1,
  heroAssetId: 'asset-hero-001',
  rulesText: '填写信息后参与抽奖，每人每场活动限一次。',
};

const validActivityForm: ActivityFormAnswerValues = {
  name: '张三',
  organization: '星火科技有限公司',
  department: '分析实验室',
  jobTitle: '高级研究员',
  phone: '13800138000',
  email: 'zhangsan@example.com',
  researchAreas: ['life_sciences', 'materials_science'],
  instrumentInterests: ['chromatography', 'mass_spectrometry'],
  visitPurposes: ['new_products', 'application_solution'],
  followUpPreferences: ['product_pdf', 'engineer_call'],
  contactPreference: 'email_first',
  onsiteAvailability: 'available',
  otherNeeds: '',
};

describe('template registry', () => {
  it('provides a Chinese label for every fixed activity form option', () => {
    expect(Object.values(activityFormOptionLabels.researchAreas)).toEqual([
      '生命科学（制药、生物技术、CRO）',
      '材料科学',
      '食品与农产品安全',
      '环境监测与检测',
      '化学与石油化工',
      '临床与医学研究',
      '其他',
    ]);
    expect(Object.values(activityFormOptionLabels.instrumentInterests)).toEqual(
      [
        '色谱类（GC, GC-MS, LC, LC-MS, HPLC, IC）',
        '光谱类（原子吸收 AAS，原子荧光 AFS，ICP-OES/MS，分子光谱）',
        '质谱类（高分辨质谱，三重四极杆质谱，MALDI-TOF 等）',
        '样品前处理设备',
        '实验室自动化与耗材',
        '其他',
      ],
    );
    expect(Object.values(activityFormOptionLabels.visitPurposes)).toEqual([
      '了解新产品/新技术动态',
      '现有设备更新换代计划',
      '为新项目/实验室采购选型',
      '寻找特定应用解决方案',
      '寻求合作（校企、测试服务等）',
      '获取技术资料',
    ]);
    expect(Object.values(activityFormOptionLabels.followUpPreferences)).toEqual(
      [
        '发送详细产品技术资料（PDF）',
        '预约资深应用工程师电话沟通',
        '安排线下技术讲座或 Demo 演示',
        '提供定制化的应用方案',
        '加入行业技术交流群',
      ],
    );
    expect(Object.values(activityFormOptionLabels.contactPreference)).toEqual([
      '方便，欢迎联系',
      '请先通过邮件发送资料',
      '暂不需要，仅留资料即可',
    ]);
    expect(Object.values(activityFormOptionLabels.onsiteAvailability)).toEqual([
      '是',
      '否，行程较满',
    ]);
  });

  it('formats fixed activity form answers in question order', () => {
    const formatted = formatActivityFormAnswers(validActivityForm);

    expect(formatted.map(({ number, label }) => `${number} ${label}`)).toEqual([
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
    expect(formatted[0]?.value).toBe('张三');
    expect(formatted[6]?.value).toBe(
      '生命科学（制药、生物技术、CRO）；材料科学',
    );
    expect(formatted[9]?.value).toBe(
      '发送详细产品技术资料（PDF）；预约资深应用工程师电话沟通',
    );
    expect(formatted[12]?.value).toBe('未填写');
  });

  it('resolves a template by its exact id and version', () => {
    expect(getTemplate('exhibition-lottery', 1).version).toBe(1);
    expect(() => getTemplate('exhibition-lottery', 99)).toThrow(
      'UNSUPPORTED_TEMPLATE',
    );
  });

  it('accepts a complete exhibition lottery configuration', () => {
    expect(LotteryConfigSchema.safeParse(validConfig).success).toBe(true);
  });

  it.each([
    [
      { ...validConfig, fieldMapping: { name: '姓名', phone: '手机号' } },
      'missing participation mapping',
    ],
    [{ ...validConfig, formUrl: 'javascript:alert(1)' }, 'script URL'],
    [
      { ...validConfig, formUrl: 'https://example.com/form' },
      'non-DingTalk host',
    ],
    [
      { ...validConfig, callbackSecret: 'must-not-be-configurable' },
      'unknown secret field',
    ],
  ])('rejects invalid configuration: %s', (config, reason) => {
    expect(reason).toBeTruthy();
    expect(LotteryConfigSchema.safeParse(config).success).toBe(false);
  });
});
