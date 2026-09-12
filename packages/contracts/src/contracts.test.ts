import { describe, expect, it } from 'vitest';

import {
  ApiErrorCodeSchema,
  ActivityFormSubmissionSchema,
  ActivityInputSchema,
  LotteryConfigSchema,
  researchAreaValues,
  RuntimeStepSchema,
  SessionViewSchema,
} from './index.js';

const validActivityForm = {
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
  privacyAccepted: true,
};

describe('shared API contracts', () => {
  it('re-exports fixed form value metadata for browser clients', () => {
    expect(researchAreaValues).toEqual([
      'life_sciences',
      'materials_science',
      'food_agriculture_safety',
      'environmental_monitoring',
      'chemical_petrochemical',
      'clinical_medical_research',
      'other',
    ]);
  });

  it('accepts a complete fixed activity form without phone or email format checks', () => {
    expect(
      ActivityFormSubmissionSchema.safeParse(validActivityForm).success,
    ).toBe(true);
    expect(
      ActivityFormSubmissionSchema.safeParse({
        ...validActivityForm,
        phone: 'not-a-number',
        email: 'not-an-email',
      }).success,
    ).toBe(true);
  });

  it.each([
    [{ ...validActivityForm, name: '  ' }, 'empty required text'],
    [
      { ...validActivityForm, researchAreas: [] },
      'empty required multi-select',
    ],
    [
      { ...validActivityForm, instrumentInterests: ['unknown'] },
      'unknown option',
    ],
    [
      {
        ...validActivityForm,
        visitPurposes: ['new_products', 'new_products'],
      },
      'duplicate options',
    ],
    [{ ...validActivityForm, privacyAccepted: false }, 'privacy not accepted'],
    [{ ...validActivityForm, unexpected: true }, 'unknown object key'],
    [
      {
        ...validActivityForm,
        researchAreas: ['other'],
        researchAreaOther: '',
      },
      'other research area without explanation',
    ],
    [
      { ...validActivityForm, researchAreaOther: '交叉学科' },
      'research area explanation without other',
    ],
    [
      {
        ...validActivityForm,
        instrumentInterests: ['other'],
        instrumentInterestOther: '',
      },
      'other instrument interest without explanation',
    ],
    [
      { ...validActivityForm, instrumentInterestOther: '定制设备' },
      'instrument interest explanation without other',
    ],
  ])('rejects invalid fixed activity form: %s', (input) => {
    expect(ActivityFormSubmissionSchema.safeParse(input).success).toBe(false);
  });

  it('uses the template package as the only lottery config schema', () => {
    expect(LotteryConfigSchema.safeParse({ heroAssetId: '' }).success).toBe(
      false,
    );
  });

  it('does not expose an asynchronous external-form runtime step', () => {
    expect(RuntimeStepSchema.safeParse('WAITING_FORM').success).toBe(false);
  });

  it('accepts Shanghai-offset activity times and rejects a client code', () => {
    const input = {
      name: '展会活动',
      templateId: 'exhibition-lottery',
      templateVersion: 1,
      startsAt: '2026-09-08T09:00:00+08:00',
      drawEndsAt: '2026-09-09T09:00:00+08:00',
      endsAt: '2026-09-10T09:00:00+08:00',
      redeemEndsAt: '2026-09-11T09:00:00+08:00',
      config: {
        requireSubscribe: true,
        noPrizeWeight: 1,
        heroAssetId: 'hero',
        rulesText: '活动规则',
      },
    };
    expect(ActivityInputSchema.safeParse(input).success).toBe(true);
    expect(
      ActivityInputSchema.safeParse({ ...input, code: 'manual' }).success,
    ).toBe(false);
  });

  it.each([
    'OUT_OF_STOCK',
    'ACTIVITY_ENDED',
    'NOT_QUALIFIED',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'RECORD_CONFLICT',
    'REDEMPTION_EXPIRED',
    'VERSION_CONFLICT',
    'UNSUPPORTED_TEMPLATE',
  ])('publishes required error code %s', (code) => {
    expect(ApiErrorCodeSchema.parse(code)).toBe(code);
  });

  it.each(['password', 'passwordHash', 'sessionHash', 'callbackSecret'])(
    'rejects sensitive session response field %s',
    (field) => {
      expect(
        SessionViewSchema.safeParse({
          id: '01993601-4d4c-7000-8000-000000000001',
          role: 'ADMIN',
          [field]: 'secret',
        }).success,
      ).toBe(false);
    },
  );
});
