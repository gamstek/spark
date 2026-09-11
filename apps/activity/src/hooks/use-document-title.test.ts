import { describe, expect, it } from 'vitest';

import {
  formatDocumentTitle,
  setTemporaryDocumentTitle,
} from './use-document-title';

describe('formatDocumentTitle', () => {
  it('uses the activity title on the home page', () => {
    expect(formatDocumentTitle('春季抽奖', null)).toBe('春季抽奖');
  });

  it('prefixes the activity title on a child page', () => {
    expect(formatDocumentTitle('春季抽奖', '活动规则')).toBe(
      '活动规则 - 春季抽奖',
    );
  });

  it('restores the previous title when a static route unmounts', () => {
    const target = { title: '活动首页 - Gamstek 营销活动' } as Document;

    const restore = setTemporaryDocumentTitle(
      target,
      '活动入口无效 - Gamstek 营销活动',
    );

    expect(target.title).toBe('活动入口无效 - Gamstek 营销活动');
    restore();
    expect(target.title).toBe('活动首页 - Gamstek 营销活动');
  });
});
