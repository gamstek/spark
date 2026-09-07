import { describe, expect, it } from 'vitest';

import {
  ApiErrorCodeSchema,
  ActivityInputSchema,
  CallbackInputSchema,
  LotteryConfigSchema,
  SessionViewSchema,
} from './index.js';

const callback = {
  formId: 'ding-form-1',
  recordId: 'record-1',
  participationId: '01993601-4d4c-7000-8000-000000000001',
  fields: { name: '张三', phone: '13800138000', company: '星火科技' },
};

describe('shared API contracts', () => {
  it('accepts a valid DingTalk callback', () => {
    expect(CallbackInputSchema.parse(callback)).toEqual(callback);
  });

  it.each([
    { ...callback, participationId: 'not-a-uuid' },
    { ...callback, participationId: "' OR true --" },
    { ...callback, recordId: '' },
    { ...callback, recordId: 'r'.repeat(257) },
    { ...callback, fields: { ...callback.fields, name: '' } },
    { ...callback, fields: { ...callback.fields, phone: '1'.repeat(33) } },
    { ...callback, fields: 'invalid' },
    { ...callback, callbackSecret: 'must-not-cross-the-boundary' },
  ])('rejects an invalid callback boundary', (input) => {
    expect(CallbackInputSchema.safeParse(input).success).toBe(false);
  });

  it('uses the template package as the only lottery config schema', () => {
    expect(
      LotteryConfigSchema.safeParse({ formUrl: 'javascript:alert(1)' }).success,
    ).toBe(false);
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
        formId: 'form-id',
        formUrl:
          'https://alidocs.dingtalk.com/notable/share/form/test?participant=',
        prefillField: 'participant',
        fieldMapping: {
          participationId: '参与编号',
          name: '姓名',
          phone: '手机号',
        },
        requireSubscribe: true,
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
          id: callback.participationId,
          role: 'ADMIN',
          [field]: 'secret',
        }).success,
      ).toBe(false);
    },
  );
});
