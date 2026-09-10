import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme-preference';

describe('resolveTheme', () => {
  it('resolves explicit and system preferences', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
