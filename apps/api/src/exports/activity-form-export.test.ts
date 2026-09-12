import { describe, expect, it } from 'vitest';
import {
  spreadsheetText,
  toActivityFormExportRow,
} from './activity-form-export.js';

describe('activity form export mapping', () => {
  it('maps every answer to readable, stable export cells', () => {
    expect(
      toActivityFormExportRow({
        name: '李雷',
        organization: '星火科技',
        department: '分析实验室',
        jobTitle: '研究员',
        phone: '13800138000',
        email: 'li.lei@example.com',
        researchAreas: ['life_sciences', 'other'],
        researchAreaOther: '细胞治疗',
        instrumentInterests: ['mass_spectrometry', 'other'],
        instrumentInterestOther: '代谢组学平台',
        visitPurposes: ['new_products', 'technical_materials'],
        followUpPreferences: ['product_pdf', 'engineer_call'],
        contactPreference: 'email_first',
        onsiteAvailability: 'unavailable',
      }),
    ).toEqual({
      name: '李雷',
      organization: '星火科技',
      department: '分析实验室',
      jobTitle: '研究员',
      phone: '13800138000',
      email: 'li.lei@example.com',
      researchAreas: '生命科学（制药、生物技术、CRO）；其他',
      researchAreaOther: '细胞治疗',
      instrumentInterests:
        '质谱类（高分辨质谱，三重四极杆质谱，MALDI-TOF 等）；其他',
      instrumentInterestOther: '代谢组学平台',
      visitPurposes: '了解新产品/新技术动态；获取技术资料',
      followUpPreferences:
        '发送详细产品技术资料（PDF）；预约资深应用工程师电话沟通',
      contactPreference: '请先通过邮件发送资料',
      onsiteAvailability: '否，行程较满',
      otherNeeds: '',
    });
  });

  it('escapes formula-like input and leaves optional answers empty', () => {
    expect(spreadsheetText('=HYPERLINK("https://attacker.invalid")')).toBe(
      '\'=HYPERLINK("https://attacker.invalid")',
    );
    expect(
      toActivityFormExportRow({
        name: '=HYPERLINK("https://attacker.invalid")',
        organization: '星火科技',
        department: '分析实验室',
        jobTitle: '研究员',
        phone: '13800138000',
        email: 'li.lei@example.com',
        researchAreas: ['life_sciences'],
        instrumentInterests: ['chromatography'],
        visitPurposes: ['new_products'],
        followUpPreferences: ['product_pdf'],
        contactPreference: 'call_welcome',
        onsiteAvailability: 'available',
      }).otherNeeds,
    ).toBe('');
  });
});
