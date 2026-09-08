import { TabNav } from '@radix-ui/themes';
import { Link, useLocation } from 'react-router-dom';

type ActivityNavProps = {
  activityId: string;
};

const activityNavigation = [
  ['活动设置', ''],
  ['奖品与库存', 'prizes'],
  ['参与者', 'participants'],
  ['核销记录', 'redemptions'],
  ['数据概览', 'report'],
  ['线索导出', 'exports'],
] as const;

export function ActivityNav({ activityId }: ActivityNavProps) {
  const { pathname } = useLocation();
  const basePath = `/activities/${activityId}`;

  return (
    <TabNav.Root
      className="activity-navigation"
      aria-label="活动功能"
    >
      {activityNavigation.map(([label, suffix]) => {
        const path = suffix ? `${basePath}/${suffix}` : basePath;

        return (
          <TabNav.Link
            key={path}
            asChild
            active={pathname === path}
          >
            <Link to={path}>{label}</Link>
          </TabNav.Link>
        );
      })}
    </TabNav.Root>
  );
}
