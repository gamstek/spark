import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { HomePage } from './home-page';

vi.mock('../hooks/use-runtime', () => ({
  useRuntime: () => ({
    activity: {
      title: '测试活动',
      dates: '2026.09.04 - 09.06',
      organizer: '测试主办方',
      rulesText: '测试活动规则',
    },
    participate: vi.fn(),
    openView: vi.fn(),
    showMyPrizes: vi.fn(),
  }),
}));

describe('HomePage', () => {
  it('renders the campaign content without browser chrome and with fixed entries', () => {
    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain('测试活动');
    expect(markup).toContain('2026.09.04 - 09.06');
    expect(markup).toContain('测试主办方');
    expect(markup).toContain('立即参与');
    expect(markup).not.toContain('<header');
    expect(markup).toContain('fixed bottom-0');
    expect(markup).toContain('活动规则');
    expect(markup).toContain('活动说明');
    expect(markup).toContain('我的奖品');
  });
});
