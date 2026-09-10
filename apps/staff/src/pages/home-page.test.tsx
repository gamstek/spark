import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { HomePage } from './home-page';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../lib/runtime', () => ({
  useStaff: () => ({
    currentActivity: {
      id: 'activity-1',
      code: 'expo',
      name: '第八届新污染物环境健康风险及防控学术会议',
      startsAt: '2026-09-14T00:00:00.000Z',
      endsAt: '2026-09-16T00:00:00.000Z',
    },
    prizes: [
      { id: 'prize-1', name: '手提袋', totalStock: 110, awardedStock: 0 },
    ],
    records: [
      {
        id: 'record-1',
        name: '张*山',
        phone: '158****0562',
        prizeName: '手提袋',
        status: 'REDEEMED',
        wonAt: '2026-09-10T02:20:30.000Z',
        redeemedAt: '2026-09-10T02:20:30.000Z',
      },
    ],
  }),
}));

describe('HomePage', () => {
  it('renders the operational dashboard from live activity data', () => {
    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).not.toContain('工作人员工作台');
    expect(markup).not.toContain('aria-label="返回"');
    expect(markup).not.toContain('aria-label="个人中心"');
    expect(markup).toContain('2026.09.14 - 09.16');
    expect(markup).toContain('今日核销');
    expect(markup).toContain('待兑奖');
    expect(markup).toContain('剩余奖品');
    expect(markup).toContain('110');
    expect(markup).toContain('份');
    expect(markup).toContain('扫一扫兑奖');
    expect(markup).toContain('手动输入兑奖码');
    expect(markup).toContain('最近核销记录');
  });
});
