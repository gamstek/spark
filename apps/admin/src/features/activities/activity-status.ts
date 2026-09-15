import type { ActivityStatus } from '@spark/contracts';

export type ActivityStatusPresentation = {
  label: string;
  color: 'gray' | 'blue' | 'jade' | 'amber';
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

export function getActivityActions(status: ActivityStatus): {
  canPause: boolean;
  canResume: boolean;
  canEndDraw: boolean;
} {
  return {
    canPause: status === 'RUNNING',
    canResume: status === 'PAUSED',
    canEndDraw: status === 'RUNNING' || status === 'PAUSED',
  };
}
