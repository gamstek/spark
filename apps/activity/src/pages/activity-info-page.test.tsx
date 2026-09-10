import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ActivityInfoPage, formatChineseDateRange } from './activity-info-page';

vi.mock('../hooks/use-runtime', () => ({
  useRuntime: () => ({
    activity: {
      title: '测试活动',
      startsAt: '2026-09-14T00:00:00+08:00',
      endsAt: '2026-09-16T23:59:59+08:00',
      dates: '2026.09.14 - 2026.09.16',
      rulesText: '每人只有一次抽奖机会，百分百中奖哦！',
      prizes: Array.from({ length: 7 }, (_, index) => ({
        name: `奖品 ${index + 1}`,
      })),
    },
    closeView: vi.fn(),
  }),
}));

describe('ActivityInfoPage', () => {
  it('renders every prize and the localized activity schedule', () => {
    const markup = renderToStaticMarkup(<ActivityInfoPage />);

    expect(markup).toContain('奖品介绍');
    expect(markup).toContain('奖品 7');
    expect(markup).toContain('2026年9月14日 — 9月16日');
    expect(markup).toContain('每人只有一次抽奖机会，百分百中奖哦！');
    expect(markup).toContain('sticky');
    expect(markup).not.toContain('absolute left-[16px] top-[118px]');
  });
});

describe('formatChineseDateRange', () => {
  it('includes both years when the range crosses a year boundary', () => {
    expect(
      formatChineseDateRange(
        '2026-12-31T00:00:00+08:00',
        '2027-01-01T00:00:00+08:00',
        'fallback',
      ),
    ).toBe('2026年12月31日 — 2027年1月1日');
  });

  it('falls back to the existing display value for invalid dates', () => {
    expect(formatChineseDateRange('', '', '待定')).toBe('待定');
  });
});
