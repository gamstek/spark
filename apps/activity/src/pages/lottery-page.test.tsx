import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LotteryPage } from './lottery-page';

const runtime = vi.hoisted(() => ({
  activity: {
    title: '幸运抽奖',
    noPrizeWeight: 1,
    prizes: [
      { prizeLevel: '一等奖', name: '小米充电宝' },
      { prizeLevel: '二等奖', name: '定制保温杯' },
    ],
  },
  step: 'LOTTERY',
  draw: vi.fn(),
  drawing: false,
  win: null as null | { prizeLevel: string; prizeName: string },
  showPrize: vi.fn(),
}));

vi.mock('../hooks/use-runtime', () => ({ useRuntime: () => runtime }));
vi.mock('../hooks/use-document-title', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../lib/assets', () => ({
  SLICES: {
    lotteryBg: '/lottery-bg.png',
    lotteryWheelFace: '/wheel-face.png',
    lotteryWheelCenter: '/wheel-center.png',
  },
}));

describe('LotteryPage', () => {
  beforeEach(() => {
    runtime.step = 'LOTTERY';
    runtime.drawing = false;
    runtime.win = null;
  });

  it('shows the winning result without leaving the lottery page', () => {
    runtime.step = 'PRIZE';
    runtime.win = { prizeLevel: '一等奖', prizeName: '小米充电宝' };

    const markup = renderToStaticMarkup(<LotteryPage />);

    expect(markup).toContain('恭喜抽中');
    expect(markup).toContain('一等奖 · 小米充电宝');
    expect(markup).toContain('text-[#8f1822]');
    expect(markup).toContain('查看奖品');
    expect(markup).not.toContain('立即抽奖</button>');
  });

  it('renders the design artwork without an additional page header', () => {
    const markup = renderToStaticMarkup(<LotteryPage />);

    expect(markup).toContain('小米充电宝');
    expect(markup).toContain('立即抽奖');
    expect(markup).toMatch(/小米充电宝[\s\S]*谢谢参与[\s\S]*定制保温杯/);
    expect(markup).toContain('transform:translate(-50%, -50%) rotate(90deg)');
    expect(markup).not.toContain('aria-label="返回"');
  });

  it('rotates the wheel and prevents another draw while drawing', () => {
    runtime.drawing = true;

    const markup = renderToStaticMarkup(<LotteryPage />);

    expect(markup).toContain('lottery-wheel--spinning');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('抽奖中…');
  });

  it('shows a persistent no-prize result', () => {
    runtime.step = 'NO_PRIZE';

    const markup = renderToStaticMarkup(<LotteryPage />);

    expect(markup).toContain('很遗憾');
    expect(markup).toContain('未中奖');
    expect(markup).toContain('返回首页');
    expect(markup).not.toContain('立即抽奖</button>');
  });
});
