import { describe, expect, it } from 'vitest';

import {
  ApiErrorCodeSchema,
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
    expect(LotteryConfigSchema.safeParse({ formUrl: 'javascript:alert(1)' }).success).toBe(false);
  });

  it.each(['OUT_OF_STOCK', 'ACTIVITY_ENDED', 'NOT_QUALIFIED', 'UNAUTHORIZED', 'FORBIDDEN',
    'RECORD_CONFLICT', 'REDEMPTION_EXPIRED', 'VERSION_CONFLICT', 'UNSUPPORTED_TEMPLATE'])(
    'publishes required error code %s', (code) => {
    expect(ApiErrorCodeSchema.parse(code)).toBe(code);
  });

  it.each(['password', 'passwordHash', 'sessionHash', 'callbackSecret'])(
    'rejects sensitive session response field %s', (field) => {
    expect(SessionViewSchema.safeParse({ id: callback.participationId, role: 'ADMIN', [field]: 'secret' }).success).toBe(false);
  });
});
