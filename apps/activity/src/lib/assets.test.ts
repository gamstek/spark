import { describe, expect, it } from 'vitest';

import { SLICES } from './assets';

describe('slice assets', () => {
  it('loads photographic backgrounds as JPEG files', () => {
    expect(SLICES.homeBg).toMatch(/\.jpg$/);
    expect(SLICES.subscribeBg).toMatch(/\.jpg$/);
    expect(SLICES.submitSuccessBg).toMatch(/\.jpg$/);
    expect(SLICES.lotteryBg).toMatch(/\.jpg$/);
  });

  it('keeps transparency-sensitive assets as PNG files', () => {
    expect(SLICES.homeIcon).toHaveLength(3);
    expect(SLICES.homeIcon.every((url) => url.endsWith('.png'))).toBe(true);
    expect(SLICES.subscribeQr).toMatch(/\.png$/);
    expect(SLICES.submitSuccessIcon).toMatch(/\.png$/);
    expect(SLICES.lotteryWheelFace).toMatch(/\.png$/);
  });
});
