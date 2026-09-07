import { NavLink } from 'react-router-dom';

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
  const basePath = `/activities/${activityId}`;

  return (
    <nav
      className="activity-navigation"
      aria-label="活动功能"
    >
      {activityNavigation.map(([label, suffix]) => {
        const path = suffix ? `${basePath}/${suffix}` : basePath;

        return (
          <NavLink
            key={path}
            to={path}
            end={!suffix}
            className={({ isActive }) =>
              `activity-navigation__link${isActive ? ' is-active' : ''}`
            }
          >
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
