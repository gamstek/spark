import { describe, expect, it } from 'vitest';

import { formatDocumentTitle } from './use-document-title';

describe('formatDocumentTitle', () => {
  it('uses the activity title on the home page', () => {
    expect(formatDocumentTitle('春季抽奖', null)).toBe('春季抽奖');
  });

  it('prefixes the activity title on a child page', () => {
    expect(formatDocumentTitle('春季抽奖', '活动规则')).toBe(
      '活动规则 - 春季抽奖',
    );
  });
});
