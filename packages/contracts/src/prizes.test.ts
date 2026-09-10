import { describe, expect, it } from 'vitest';

import { PrizeInputSchema } from './prizes';

describe('PrizeInputSchema', () => {
  it('requires a prize level for activity display', () => {
    expect(
      PrizeInputSchema.parse({
        prizeLevel: '三等奖',
        name: '定制手机支架',
        imageAssetId: null,
        stock: 10,
        weight: 1,
      }),
    ).toMatchObject({ prizeLevel: '三等奖' });
  });
});
