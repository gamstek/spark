import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { BottomTabBar } from '../components/bottom-tab-bar';
import { PageShell } from '../components/page-shell';
import type { TabKey } from '../lib/runtime';

const TAB_PATH: Record<TabKey, string> = {
  home: '/',
  prizes: '/prizes',
  profile: '/profile',
};

/** 三大 Tab 容器：背景图（可选）+ 内容 + 底部 tab 栏。 */
export function AppShell({
  children,
  bg,
}: {
  children: ReactNode;
  bg?: string;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active: TabKey =
    pathname === '/prizes'
      ? 'prizes'
      : pathname === '/profile'
        ? 'profile'
        : 'home';

  return (
    <PageShell className="relative">
      {bg && (
        <img
          src={bg}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="relative flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
        <BottomTabBar
          active={active}
          onChange={(k) => navigate(TAB_PATH[k])}
        />
      </div>
    </PageShell>
  );
}
