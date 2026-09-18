import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RedemptionPage } from './redemption-page';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const runtime = vi.hoisted(() => ({
  activity: { title: '测试活动' },
  win: {
    prizeLevel: '三等奖',
    prizeName: '定制手机支架',
    prizeImageUrl: 'https://example.com/prize.png',
    redemptionStatus: 'WAIT_REDEEM' as 'WAIT_REDEEM' | 'REDEEMED' | 'EXPIRED',
  },
  refreshPrizeStatus: vi.fn().mockResolvedValue(undefined),
  refreshingPrizeStatus: false,
}));

vi.mock('../hooks/use-runtime', () => ({
  useRuntime: () => runtime,
}));

describe('RedemptionPage', () => {
  beforeEach(() => {
    runtime.win.redemptionStatus = 'WAIT_REDEEM';
  });

  it('renders the prize snapshot and redemption details in responsive cards', () => {
    const markup = renderToStaticMarkup(<RedemptionPage />);

    expect(markup).toContain('三等奖');
    expect(markup).toContain('定制手机支架');
    expect(markup).toContain('待核销');
    expect(markup).not.toContain('7K3M P9RX');
    expect(markup).not.toContain('https://example.com/redeem/836215');
    expect(markup).toContain('min-h-dvh');
    expect(markup).not.toContain('h-[769px]');
    expect(markup).toContain('刷新状态');
    expect(markup).toContain('确认领奖');
    expect(markup).toContain('请交由现场工作人员操作');
  });

  it.each([
    ['REDEEMED', '已兑奖', '该奖品已完成核销'],
    ['EXPIRED', '已过期', '该兑奖码已过期'],
  ] as const)(
    'hides the redeem code when status is %s',
    (status, tag, text) => {
      runtime.win.redemptionStatus = status;
      const markup = renderToStaticMarkup(<RedemptionPage />);

      expect(markup).toContain(tag);
      expect(markup).toContain(text);
      expect(markup).not.toContain('7K3M P9RX');
      expect(markup).not.toContain('https://example.com/redeem/836215');
      expect(markup).not.toContain('确认领奖');
    },
  );
});
