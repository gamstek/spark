import { describe, expect, it } from 'vitest';

import { extractRedemptionCode } from './wechat-scan';

describe('extractRedemptionCode', () => {
  it('extracts a code from a redemption URL', () => {
    expect(
      extractRedemptionCode('https://spark.gamstek.com/staff?code=ABC123'),
    ).toBe('ABC123');
  });

  it('accepts a plain redemption code', () => {
    expect(extractRedemptionCode(' ABC123 ')).toBe('ABC123');
  });

  it('removes display spacing from a redemption code', () => {
    expect(extractRedemptionCode('7k3m p9rx')).toBe('7K3MP9RX');
  });
});
