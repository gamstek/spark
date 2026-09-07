import {
  ChevronDownIcon,
  Cross2Icon,
  DashboardIcon,
  ExclamationTriangleIcon,
  HamburgerMenuIcon,
  PersonIcon,
} from '@radix-ui/react-icons';
import {
  Box,
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
} from '@radix-ui/themes';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

type AppShellProps = {
  children: ReactNode;
};

const navigation = [
  {
    label: '活动管理',
    path: '/activities',
    icon: DashboardIcon,
  },
  {
    label: '工作人员',
    path: '/staff',
    icon: PersonIcon,
  },
  {
    label: '失败任务',
    path: '/jobs',
    icon: ExclamationTriangleIcon,
  },
] as const;

function getPageTitle(pathname: string) {
  if (pathname.startsWith('/staff')) return '工作人员';
  if (pathname.startsWith('/jobs')) return '失败任务';
  if (pathname.includes('/prizes')) return '奖品与库存';
  if (pathname.includes('/participants')) return '参与者';
  if (pathname.includes('/redemptions')) return '核销记录';
  if (pathname.includes('/report')) return '数据概览';
  if (pathname.includes('/exports')) return '线索导出';
  if (/\/activities\/[^/]+/.test(pathname)) return '活动设置';
  return '活动管理';
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside
        className={`app-sidebar${navigationOpen ? ' is-open' : ''}`}
        aria-label="主导航"
      >
        <Flex
          align="center"
          justify="between"
          className="app-sidebar__brand"
        >
          <div>
            <Text
              as="div"
              size="5"
              weight="bold"
              className="app-wordmark"
            >
              Spark
            </Text>
            <Text
              as="div"
              size="1"
              className="app-sidebar__subtitle"
            >
              活动运营工作台
            </Text>
          </div>
          <IconButton
            className="app-sidebar__close"
            variant="ghost"
            color="gray"
            aria-label="关闭导航"
            onClick={() => setNavigationOpen(false)}
          >
            <Cross2Icon />
          </IconButton>
        </Flex>

        <nav className="app-navigation">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `app-navigation__link${isActive ? ' is-active' : ''}`
              }
              onClick={() => setNavigationOpen(false)}
            >
              <Icon
                width="18"
                height="18"
                aria-hidden="true"
              />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <Box className="app-sidebar__context">
          <Text
            as="div"
            size="1"
            color="gray"
          >
            当前环境
          </Text>
          <Flex
            align="center"
            gap="2"
            mt="1"
          >
            <span className="environment-dot" />
            <Text
              size="2"
              weight="medium"
            >
              生产环境
            </Text>
          </Flex>
        </Box>
      </aside>

      {navigationOpen && (
        <button
          type="button"
          className="app-sidebar__scrim"
          aria-label="关闭导航"
          onClick={() => setNavigationOpen(false)}
        />
      )}

      <div className="app-workspace">
        <header className="app-topbar">
          <Flex
            align="center"
            gap="3"
          >
            <IconButton
              className="app-topbar__menu"
              variant="soft"
              color="gray"
              aria-label="打开导航"
              onClick={() => setNavigationOpen(true)}
            >
              <HamburgerMenuIcon />
            </IconButton>
            <Text
              size="3"
              weight="medium"
            >
              {getPageTitle(location.pathname)}
            </Text>
          </Flex>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button
                variant="ghost"
                color="gray"
                className="account-trigger"
              >
                <span className="account-avatar">运</span>
                运营账号
                <ChevronDownIcon />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Label>当前会话</DropdownMenu.Label>
              <DropdownMenu.Item disabled>运营管理员</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
