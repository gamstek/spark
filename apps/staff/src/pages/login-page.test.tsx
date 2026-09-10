import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LoginPage } from './login-page';

const staffState = vi.hoisted(() => ({ loggedIn: false }));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <span>redirect:{to}</span>,
  useNavigate: () => vi.fn(),
}));

vi.mock('../lib/runtime', () => ({
  useStaff: () => ({ login: vi.fn(), loggedIn: staffState.loggedIn }),
}));

describe('LoginPage', () => {
  it('renders an accessible staff sign-in form', () => {
    staffState.loggedIn = false;
    const markup = renderToStaticMarkup(<LoginPage />);

    expect(markup).toContain('工作人员工作台');
    expect(markup).toContain('账号由管理员统一创建');
    expect(markup).toContain('账号');
    expect(markup).toContain('密码');
    expect(markup).toContain('autoComplete="username"');
    expect(markup).toContain('autoComplete="current-password"');
    expect(markup).toContain('进入工作台');
  });

  it('redirects an authenticated staff member to the workspace', () => {
    staffState.loggedIn = true;

    expect(renderToStaticMarkup(<LoginPage />)).toContain('redirect:/');
  });
});
