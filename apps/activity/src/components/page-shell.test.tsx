import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PageShell } from './page-shell';

describe('PageShell', () => {
  it('keeps fixed-coordinate illustrated pages on their 375px stage', () => {
    const markup = renderToStaticMarkup(
      <PageShell>
        <p>活动内容</p>
      </PageShell>,
    );

    expect(markup).toContain('min-h-dvh');
    expect(markup).toContain('max-w-[375px]');
    expect(markup).not.toContain('max-w-[430px]');
    expect(markup).not.toContain('h-[769px]');
  });
});
