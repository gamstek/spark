import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders a consistent title and back control', () => {
    const markup = renderToStaticMarkup(
      <PageHeader
        title="活动规则"
        onBack={vi.fn()}
      />,
    );

    expect(markup).toContain('活动规则');
    expect(markup).toContain('返回');
    expect(markup).toContain('<header');
  });
});
