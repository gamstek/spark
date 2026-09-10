import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('GhostTable', () => {
  it('uses the Radix ghost variant without a Card surface', () => {
    const source = readFileSync(
      new URL('./ghost-table.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('variant="ghost"');
    expect(source).not.toContain('<Card');
  });
});
