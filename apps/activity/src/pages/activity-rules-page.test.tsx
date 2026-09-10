import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ActivityRulesPage } from './activity-rules-page';

vi.mock('../hooks/use-runtime', () => ({
  useRuntime: () => ({
    activity: { rulesText: '每人只有一次抽奖机会' },
    closeView: vi.fn(),
  }),
}));

describe('ActivityRulesPage', () => {
  it('renders activity rules as a standalone page', () => {
    const markup = renderToStaticMarkup(<ActivityRulesPage />);

    expect(markup).toContain('<main');
    expect(markup).toContain('活动规则');
    expect(markup).toContain('每人只有一次抽奖机会');
    expect(markup).toContain('aria-label="返回"');
    expect(markup).not.toContain('role="dialog"');
  });
});
