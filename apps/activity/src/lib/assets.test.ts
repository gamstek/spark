import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

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

  it('keeps the full campaign image payload below 700 KB and the lottery visuals below 300 KB', () => {
    const root = fileURLToPath(new URL('../assets/slices/', import.meta.url));
    const images = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && /\.(webp|png|jpe?g)$/.test(entry.name),
      )
      .map((entry) => join(entry.parentPath, entry.name));
    expect(images).toHaveLength(10);
    expect(
      images.reduce((total, path) => total + statSync(path).size, 0),
    ).toBeLessThan(700_000);
    expect(
      statSync(join(root, 'lottery/bg.jpg')).size +
        statSync(join(root, 'lottery/wheel-face.png')).size,
    ).toBeLessThan(300_000);
  });
});
