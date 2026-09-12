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

  it.each([
    '仪器<Lab>展',
    '**测试活动**',
    '![活动](https://example.invalid/pixel.png)',
    '[活动](https://example.invalid/)',
    '展会\n\n## 附加条款',
    '展会\r\n\r\n- 附加条款',
    '展会\n\n| 条款 |\n| --- |\n| 内容 |',
    '$& \\活动 &amp; &#65;',
    'https://example.invalid/path?q=1&x=2',
    'www.example.invalid',
    'exhibition@example.invalid',
    '`活动` ~~备注~~ _强调_ ! # {占位} [说明] (展会)',
    '展会\t名称　测试',
  ])(
    'preserves the complete activity name as literal text: %j',
    (activityName) => {
      const markup = renderToStaticMarkup(
        <PrivacyAgreementContent activityName={activityName} />,
      );
      const expectedLabel = renderToStaticMarkup(
        <p>
          <strong>适用活动：</strong> {activityName}
        </p>,
      );

      expect(markup).toContain(expectedLabel);
      expect(markup).not.toMatch(/<(?:img|script|em|del|code)\b/);
      expect(markup.match(/<h1\b/g)).toHaveLength(1);
      expect(markup.match(/<h2\b/g)).toHaveLength(8);
      expect(markup.match(/<strong\b/g)).toHaveLength(2);
      expect(markup.match(/<a\b/g)).toHaveLength(1);
      expect(markup.match(/<table\b/g)).toHaveLength(1);
    },
  );
});
