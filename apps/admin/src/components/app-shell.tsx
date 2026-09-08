import {
  Cross2Icon,
  DashboardIcon,
  ExclamationTriangleIcon,
  HamburgerMenuIcon,
  PersonIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ExitIcon,
} from '@radix-ui/react-icons';
import {
  Avatar,
  Button,
  Dialog,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
} from '@radix-ui/themes';
import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api, setCsrf } from '../api';
import { FeedbackCallout } from './feedback-callout';

const navigation = [
  { label: '活动管理', path: '/activities', icon: DashboardIcon },
  { label: '工作人员', path: '/staff', icon: PersonIcon },
  { label: '失败任务', path: '/jobs', icon: ExclamationTriangleIcon },
] as const;

function getPageTitle(path: string) {
  if (path.startsWith('/staff')) return '工作人员';
  if (path.startsWith('/jobs')) return '失败任务';
  if (path.includes('/prizes')) return '奖品与库存';
  if (path.includes('/participants')) return '参与者';
  if (path.includes('/redemptions')) return '核销记录';
  if (path.includes('/report')) return '数据概览';
  if (path.includes('/exports')) return '线索导出';
  if (path.endsWith('/new')) return '新建活动';
  if (/\/activities\/[^/]+/.test(path)) return '活动设置';
  return '活动管理';
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="app-sidebar__brand">
        <span
          className="brand-spark"
          aria-hidden="true"
        />
        <div>
          <Text
            as="div"
            className="app-wordmark"
          >
            Spark
          </Text>
          <Text
            as="div"
            className="app-sidebar__subtitle"
          >
            运营工作空间
          </Text>
        </div>
      </div>
      <div className="navigation-caption">运营</div>
      <nav className="app-navigation">
        {navigation.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onNavigate}
            className={({ isActive }) =>
              `app-navigation__link${isActive ? ' is-active' : ''}`
            }
          >
            <Icon
              width="18"
              height="18"
              aria-hidden="true"
            />
            <span>{label}</span>
            <ChevronRightIcon
              className="nav-arrow"
              aria-hidden="true"
            />
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [accountError, setAccountError] = useState('');
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setAccountError('');
    try {
      await api('admin/auth/logout', { method: 'POST' });
      setCsrf('');
      navigate('/login', { replace: true });
    } catch {
      setAccountError('退出登录失败，请稍后重试。');
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
      >
        跳至主要内容
      </a>
      <aside
        className="app-sidebar"
        aria-label="主导航"
      >
        <SidebarContent />
      </aside>
      <div className="app-workspace">
        <header className="app-topbar">
          <Flex
            align="center"
            gap="3"
          >
            <Dialog.Root
              open={open}
              onOpenChange={setOpen}
            >
              <Dialog.Trigger>
                <IconButton
                  className="app-topbar__menu"
                  variant="soft"
                  color="gray"
                  aria-label="打开导航"
                >
                  <HamburgerMenuIcon />
                </IconButton>
              </Dialog.Trigger>
              <Dialog.Content
                className="mobile-navigation"
                aria-describedby={undefined}
              >
                <Dialog.Title className="sr-only">工作空间导航</Dialog.Title>
                <Dialog.Close>
                  <IconButton
                    className="mobile-navigation__close"
                    aria-label="关闭导航"
                    variant="soft"
                    color="gray"
                  >
                    <Cross2Icon />
                  </IconButton>
                </Dialog.Close>
                <SidebarContent onNavigate={() => setOpen(false)} />
              </Dialog.Content>
            </Dialog.Root>
            <span className="topbar-context">工作空间</span>
            <ChevronRightIcon
              className="topbar-context"
              aria-hidden="true"
            />
            <Text
              size="2"
              weight="medium"
            >
              {getPageTitle(location.pathname)}
            </Text>
          </Flex>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button
                variant="ghost"
                size="3"
                color="gray"
                className="account-menu-trigger"
                aria-label="账号菜单"
                loading={loggingOut}
              >
                <Avatar
                  size="1"
                  radius="full"
                  variant="soft"
                  fallback={<PersonIcon />}
                />
                <span>管理员</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              variant="soft"
              align="end"
              style={{ minWidth: 200 }}
            >
              <DropdownMenu.Label>Spark 运营后台</DropdownMenu.Label>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                color="red"
                onSelect={() => void logout()}
                disabled={loggingOut}
              >
                <ExitIcon />
                退出登录
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="app-content"
        >
          {accountError && (
            <FeedbackCallout
              tone="error"
              message={accountError}
            />
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
