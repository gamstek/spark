import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ProfilePage } from './profile-page';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/profile' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../lib/runtime', () => ({
  useStaff: () => ({
    displayName: '上海核销组',
    logout: vi.fn(),
    currentActivity: {
      id: 'activity-1',
      name: '第八届新污染物环境健康风险及防控学术会议',
    },
    records: [
      { id: 'record-1', status: 'WAIT_REDEEM' },
      { id: 'record-2', status: 'REDEEMED' },
    ],
    activities: [],
    currentActivityId: 'activity-1',
    pickActivity: vi.fn(),
  }),
}));

describe('ProfilePage', () => {
  it('renders the staff profile and working links without browser chrome', () => {
    const markup = renderToStaticMarkup(<ProfilePage />);

    expect(markup).toContain('上海核销组');
    expect(markup).toContain('第八届新污染物环境健康风险及防控学术会议');
    expect(markup).toContain('我的待办');
    expect(markup).toContain('（1）');
    expect(markup).toContain('href="/todos"');
    expect(markup).not.toContain('?filter=');
    expect(markup).toContain('href="/prizes"');
    expect(markup).toContain('href="/rules"');
    expect(markup).not.toContain('<header');
  });
});
