import { describe, expect, it } from 'vitest';

import { activitySelectionLabel } from './activity-permission-select';

const activities = [
  { id: 'a1', name: '上海展会抽奖' },
  { id: 'a2', name: '年度客户答谢会' },
];

describe('activitySelectionLabel', () => {
  it('shows activity names instead of database ids', () => {
    expect(activitySelectionLabel(['a1', 'a2'], activities)).toBe(
      '上海展会抽奖、年度客户答谢会',
    );
  });

  it('provides an empty selection prompt', () => {
    expect(activitySelectionLabel([], activities)).toBe('请选择可操作活动');
  });
});
