import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ContentDialog, PrivacyAgreementContent } from './content-dialog';

describe('content reading', () => {
  it('renders a semantic, non-submitting reusable trigger', () => {
    const markup = renderToStaticMarkup(
      <ContentDialog
        title="活动说明"
        trigger={<button type="button">阅读活动说明</button>}
      >
        <p>说明正文</p>
      </ContentDialog>,
    );
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('阅读活动说明');
  });

  it('renders the prepared agreement with a semantic GFM collection table', () => {
    const markup = renderToStaticMarkup(
      <PrivacyAgreementContent activityName="测试活动" />,
    );
    expect(markup).toContain('测试活动');
    expect(markup).toContain('<strong>生效日期：</strong>');
    expect(markup).toContain('<strong>适用活动：</strong>');
    expect(markup).toContain('<table>');
    expect(markup).toContain('<th');
    expect(markup).toContain('第三方服务清单为：无');
  });
});
