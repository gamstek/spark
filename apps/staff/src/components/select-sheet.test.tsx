import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SelectSheet } from './select-sheet';

describe('SelectSheet', () => {
  it('renders above fixed navigation as a modal dialog', () => {
    const markup = renderToStaticMarkup(
      <SelectSheet
        title="选择活动"
        options={[{ value: 'a1', label: '活动一' }]}
        value="a1"
        onChange={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('z-50');
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-label="关闭选择活动"');
  });
});
