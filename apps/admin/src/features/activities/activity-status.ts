import type { ActivityStatus } from '@spark/contracts';

export type ActivityStatusPresentation = {
  label: string;
  color: 'gray' | 'blue' | 'jade' | 'amber';
};

export type ActivityActions = {
  canPause: boolean;
  canResume: boolean;
  canEndDraw: boolean;
};

const activityStatusPresentations: Record<
  ActivityStatus,
  ActivityStatusPresentation
> = {
  DRAFT: { label: '草稿', color: 'gray' },
  UPCOMING: { label: '未开始', color: 'blue' },
  RUNNING: { label: '进行中', color: 'jade' },
  PAUSED: { label: '已暂停', color: 'amber' },
  DRAW_ENDED: { label: '抽奖已结束', color: 'gray' },
  ENDED: { label: '活动已结束', color: 'gray' },
};

export function getActivityStatusPresentation(
  status: ActivityStatus,
): ActivityStatusPresentation {
  return activityStatusPresentations[status];
}

const activityActions: Record<ActivityStatus, ActivityActions> = {
  DRAFT: { canPause: false, canResume: false, canEndDraw: false },
  UPCOMING: { canPause: false, canResume: false, canEndDraw: false },
  RUNNING: { canPause: true, canResume: false, canEndDraw: true },
  PAUSED: { canPause: false, canResume: true, canEndDraw: true },
  DRAW_ENDED: { canPause: false, canResume: false, canEndDraw: false },
  ENDED: { canPause: false, canResume: false, canEndDraw: false },
};

export function getActivityActions(status: ActivityStatus): ActivityActions {
  return activityActions[status];
}
