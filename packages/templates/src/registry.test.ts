import { describe, expect, it } from 'vitest';

import { LotteryConfigSchema, getTemplate } from './index.js';

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

describe('template registry', () => {
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
