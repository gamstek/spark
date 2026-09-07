import { Badge } from '@radix-ui/themes';
import type { ComponentProps, ReactNode } from 'react';

type BadgeColor = ComponentProps<typeof Badge>['color'];

type StatusBadgeProps = {
  status: string;
  children?: ReactNode;
};

const statusPresentation: Record<string, { label: string; color: BadgeColor }> =
  {
    草稿: { label: '草稿', color: 'gray' },
    未开始: { label: '未开始', color: 'blue' },
    已发布: { label: '已发布', color: 'iris' },
    进行中: { label: '进行中', color: 'jade' },
    已结束: { label: '已结束', color: 'gray' },
    已完成: { label: '已完成', color: 'jade' },
    处理中: { label: '处理中', color: 'amber' },
    失败: { label: '失败', color: 'tomato' },
    已过期: { label: '已过期', color: 'gray' },
    已启用: { label: '已启用', color: 'jade' },
    已停用: { label: '已停用', color: 'gray' },
    draft: { label: '草稿', color: 'gray' },
    scheduled: { label: '待开始', color: 'blue' },
    published: { label: '已发布', color: 'iris' },
    active: { label: '进行中', color: 'jade' },
    running: { label: '进行中', color: 'jade' },
    ended: { label: '已结束', color: 'gray' },
    completed: { label: '已完成', color: 'jade' },
    pending: { label: '处理中', color: 'amber' },
    processing: { label: '处理中', color: 'blue' },
    failed: { label: '失败', color: 'tomato' },
    expired: { label: '已过期', color: 'gray' },
    enabled: { label: '已启用', color: 'jade' },
    disabled: { label: '已停用', color: 'gray' },
  };

export function StatusBadge({ status, children }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const presentation = statusPresentation[normalizedStatus] ?? {
    label: status,
    color: 'gray' as const,
  };

  return (
    <Badge
      color={presentation.color}
      variant="soft"
      highContrast
    >
      <span
        className="status-badge__dot"
        aria-hidden="true"
      />
      {children ?? presentation.label}
    </Badge>
  );
}
