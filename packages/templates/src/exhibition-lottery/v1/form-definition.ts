export const researchAreaValues = [
  'life_sciences',
  'materials_science',
  'food_agriculture_safety',
  'environmental_monitoring',
  'chemical_petrochemical',
  'clinical_medical_research',
  'other',
] as const;

export const instrumentInterestValues = [
  'chromatography',
  'spectroscopy',
  'mass_spectrometry',
  'sample_preparation',
  'lab_automation_consumables',
  'other',
] as const;

export const visitPurposeValues = [
  'new_products',
  'equipment_replacement',
  'procurement_selection',
  'application_solution',
  'cooperation',
  'technical_materials',
] as const;

export const followUpPreferenceValues = [
  'product_pdf',
  'engineer_call',
  'onsite_seminar_demo',
  'custom_solution',
  'industry_group',
] as const;

export const contactPreferenceValues = [
  'call_welcome',
  'email_first',
  'no_contact',
] as const;

export const onsiteAvailabilityValues = ['available', 'unavailable'] as const;

type ResearchArea = (typeof researchAreaValues)[number];
type InstrumentInterest = (typeof instrumentInterestValues)[number];
type VisitPurpose = (typeof visitPurposeValues)[number];
type FollowUpPreference = (typeof followUpPreferenceValues)[number];
type ContactPreference = (typeof contactPreferenceValues)[number];
type OnsiteAvailability = (typeof onsiteAvailabilityValues)[number];

export type ActivityFormAnswerValues = {
  name: string;
  organization: string;
  department: string;
  jobTitle: string;
  phone: string;
  email: string;
  researchAreas: readonly ResearchArea[];
  researchAreaOther?: string;
  instrumentInterests: readonly InstrumentInterest[];
  instrumentInterestOther?: string;
  visitPurposes: readonly VisitPurpose[];
  followUpPreferences: readonly FollowUpPreference[];
  contactPreference: ContactPreference;
  onsiteAvailability: OnsiteAvailability;
  otherNeeds?: string;
};

export const activityFormDefinition = [
  { number: '01', label: '姓名' },
  { number: '02', label: '单位（公司/院校/研究所）全称' },
  { number: '03', label: '部门/实验室/课题组' },
  { number: '04', label: '职位/职称' },
  { number: '05', label: '手机号码' },
  { number: '06', label: '电子邮箱' },
  { number: '07', label: '您的主要研究方向/应用领域（多选）' },
  { number: '08', label: '您目前最关注的仪器类型或技术（多选）' },
  { number: '09', label: '您此次关注的目的是（多选）' },
  { number: '10', label: '您希望我们以何种方式为您提供后续信息？（多选题）' },
  {
    number: '11',
    label: '您是否方便接受我们在1-2个工作日内致电进行简短的技术交流？',
  },
  {
    number: '12',
    label:
      '您今天是否有时间在我们的展台进行更深入的交流？（可与工作人员确认安排）',
  },
  { number: '13', label: '其他具体需求或咨询' },
] as const;

export const activityFormOptionLabels = {
  researchAreas: {
    life_sciences: '生命科学（制药、生物技术、CRO）',
    materials_science: '材料科学',
    food_agriculture_safety: '食品与农产品安全',
    environmental_monitoring: '环境监测与检测',
    chemical_petrochemical: '化学与石油化工',
    clinical_medical_research: '临床与医学研究',
    other: '其他',
  } satisfies Record<ResearchArea, string>,
  instrumentInterests: {
    chromatography: '色谱类（GC, GC-MS, LC, LC-MS, HPLC, IC）',
    spectroscopy: '光谱类（原子吸收 AAS，原子荧光 AFS，ICP-OES/MS，分子光谱）',
    mass_spectrometry: '质谱类（高分辨质谱，三重四极杆质谱，MALDI-TOF 等）',
    sample_preparation: '样品前处理设备',
    lab_automation_consumables: '实验室自动化与耗材',
    other: '其他',
  } satisfies Record<InstrumentInterest, string>,
  visitPurposes: {
    new_products: '了解新产品/新技术动态',
    equipment_replacement: '现有设备更新换代计划',
    procurement_selection: '为新项目/实验室采购选型',
    application_solution: '寻找特定应用解决方案',
    cooperation: '寻求合作（校企、测试服务等）',
    technical_materials: '获取技术资料',
  } satisfies Record<VisitPurpose, string>,
  followUpPreferences: {
    product_pdf: '发送详细产品技术资料（PDF）',
    engineer_call: '预约资深应用工程师电话沟通',
    onsite_seminar_demo: '安排线下技术讲座或 Demo 演示',
    custom_solution: '提供定制化的应用方案',
    industry_group: '加入行业技术交流群',
  } satisfies Record<FollowUpPreference, string>,
  contactPreference: {
    call_welcome: '方便，欢迎联系',
    email_first: '请先通过邮件发送资料',
    no_contact: '暂不需要，仅留资料即可',
  } satisfies Record<ContactPreference, string>,
  onsiteAvailability: {
    available: '是',
    unavailable: '否，行程较满',
  } satisfies Record<OnsiteAvailability, string>,
} as const;

const unanswered = (value: string | undefined) => value || '未填写';

const formatOptions = <T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
  otherExplanation?: string,
) =>
  values
    .map((value) =>
      value === 'other' && otherExplanation
        ? `${labels[value]}（${otherExplanation}）`
        : labels[value],
    )
    .join('；');

export const formatActivityFormAnswers = (
  answers: ActivityFormAnswerValues,
) => [
  { ...activityFormDefinition[0], value: answers.name },
  { ...activityFormDefinition[1], value: answers.organization },
  { ...activityFormDefinition[2], value: answers.department },
  { ...activityFormDefinition[3], value: answers.jobTitle },
  { ...activityFormDefinition[4], value: answers.phone },
  { ...activityFormDefinition[5], value: answers.email },
  {
    ...activityFormDefinition[6],
    value: formatOptions(
      answers.researchAreas,
      activityFormOptionLabels.researchAreas,
      answers.researchAreaOther,
    ),
  },
  {
    ...activityFormDefinition[7],
    value: formatOptions(
      answers.instrumentInterests,
      activityFormOptionLabels.instrumentInterests,
      answers.instrumentInterestOther,
    ),
  },
  {
    ...activityFormDefinition[8],
    value: formatOptions(
      answers.visitPurposes,
      activityFormOptionLabels.visitPurposes,
    ),
  },
  {
    ...activityFormDefinition[9],
    value: formatOptions(
      answers.followUpPreferences,
      activityFormOptionLabels.followUpPreferences,
    ),
  },
  {
    ...activityFormDefinition[10],
    value:
      activityFormOptionLabels.contactPreference[answers.contactPreference],
  },
  {
    ...activityFormDefinition[11],
    value:
      activityFormOptionLabels.onsiteAvailability[answers.onsiteAvailability],
  },
  { ...activityFormDefinition[12], value: unanswered(answers.otherNeeds) },
];
