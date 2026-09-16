import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/staff/redeem/success', state: null }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../lib/runtime', () => ({
  useStaff: () => ({ displayName: 'Test Staff' }),
}));

import { RedeemSuccessPage } from './redeem-success-page';

describe('RedeemSuccessPage layout', () => {
  it('centers the 375px result composition within wider phone shells', () => {
    const markup = renderToStaticMarkup(<RedeemSuccessPage />);

    expect(markup).toContain('mx-auto w-[375px] max-w-full');
    expect(markup).toContain('left-[16px] top-[107px] h-[497px] w-[343px]');
  });
});
