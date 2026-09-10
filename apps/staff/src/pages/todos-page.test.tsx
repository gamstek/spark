import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { TodosPage } from './todos-page';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: { filter: 'WAIT_REDEEM' } }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../lib/runtime', () => ({
  useStaff: () => ({
    records: [
      {
        id: 'wait-1',
        name: '张*山',
        phone: '158****0562',
        prizeName: '手提袋',
        status: 'WAIT_REDEEM',
        wonAt: '2026-09-10T02:20:30.000Z',
        redeemedAt: null,
      },
      {
        id: 'done-1',
        name: '李*海',
        phone: '139****1234',
        prizeName: '保温杯',
        status: 'REDEEMED',
        wonAt: '2026-09-10T02:20:30.000Z',
        redeemedAt: '2026-09-10T03:20:30.000Z',
      },
    ],
  }),
}));

describe('TodosPage', () => {
  it('uses the shared child-page header and route-state filter', () => {
    const markup = renderToStaticMarkup(<TodosPage />);

    expect(markup).toContain('我的待办');
    expect(markup).toContain('aria-label="返回"');
    expect(markup).toContain('aria-label="打开菜单"');
    expect(markup).toContain('张*山');
    expect(markup).not.toContain('李*海');
    expect(markup).toContain('待核销');
  });
});
