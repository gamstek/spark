import { describe, expect, it } from 'vitest';

import { activityEntryError } from './activity-entry-state';

describe('activityEntryError', () => {
  it('guides unauthenticated visitors back through the Official Account', () => {
    expect(activityEntryError('', true)).toBe(
      '请从公众号欢迎消息或“活动抽奖”菜单重新进入',
    );
  });

  it('prioritizes a replacement-link instruction for an invalid entry', () => {
    expect(activityEntryError('?entryError=invalid', false)).toBe(
      '活动入口已失效，请从公众号“活动抽奖”菜单获取新链接',
    );
  });

  it('does not show an entry error for an authenticated valid entry', () => {
    expect(activityEntryError('', false)).toBeNull();
  });
});
