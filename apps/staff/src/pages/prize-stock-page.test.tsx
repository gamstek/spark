import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PrizeStockPage } from './prize-stock-page';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/prizes' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../lib/runtime', () => ({
  useStaff: () => ({
    prizes: [
      {
        id: 'prize-1',
        name: '小米充电宝',
        totalStock: 16,
        awardedStock: 6,
      },
    ],
  }),
}));

describe('PrizeStockPage', () => {
  it('renders prize management as a primary tab page', () => {
    const markup = renderToStaticMarkup(<PrizeStockPage />);

    expect(markup).toContain('奖品管理');
    expect(markup).not.toContain('aria-label="返回"');
    expect(markup).toContain('小米充电宝');
    expect(markup).toContain('总数：');
    expect(markup).toContain('>16<');
    expect(markup).toContain('剩余：');
    expect(markup).toContain('>10<');
    expect(markup).not.toContain('编辑');
  });
});
