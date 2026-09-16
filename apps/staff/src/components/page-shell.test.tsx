import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { BottomTabBar } from './bottom-tab-bar';
import { PageShell } from './page-shell';
import { SelectSheet } from './select-sheet';

describe('staff mobile shell contract', () => {
  it('gives page content a 430px maximum width and natural dynamic viewport height', () => {
    const markup = renderToStaticMarkup(<PageShell>Page content</PageShell>);

    expect(markup).toContain('w-full max-w-[430px]');
    expect(markup).toContain('min-h-dvh');
    expect(markup).not.toMatch(/(?:^|\s)(?:h-screen|h-\[100d?vh\])(?:\s|$)/);
  });

  it('keeps the fixed bottom navigation centered with safe-area padding', () => {
    const markup = renderToStaticMarkup(
      <BottomTabBar
        active="home"
        onChange={vi.fn()}
      />,
    );

    expect(markup).toContain(
      'fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2',
    );
    expect(markup).toContain('pb-[env(safe-area-inset-bottom)]');
  });

  it('keeps the selection sheet at 430px and centers it in the overlay', () => {
    const markup = renderToStaticMarkup(
      <SelectSheet
        title="选择活动"
        options={[]}
        value=""
        onChange={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(markup).toContain('inset-0 z-50 flex items-end justify-center');
    expect(markup).toContain('w-full max-w-[430px] rounded-t-[16px]');
  });
});
