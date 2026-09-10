import { describe, expect, it } from 'vitest';

import { WinViewSchema } from './redemptions';

describe('WinViewSchema', () => {
  it('includes the snapshotted prize level', () => {
    expect(
      WinViewSchema.parse({
        id: '7c89557d-7b88-4a7f-89e9-8483f43e77ad',
        prizeLevel: '三等奖',
        prizeName: '定制手机支架',
        prizeImageUrl: null,
        redeemEndAt: '2026-09-30T00:00:00.000Z',
        redemptionStatus: 'WAIT_REDEEM',
      }),
    ).toMatchObject({ prizeLevel: '三等奖' });
  });
});
