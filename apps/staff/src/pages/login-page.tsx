import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { ApiError } from '../lib/api';
import { PageShell } from '../components/page-shell';
import { useStaff } from '../lib/runtime';

export function LoginPage() {
  const { loggedIn, login } = useStaff();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const field =
    'h-14 w-full rounded-xl border border-[#dedfe3] bg-white px-4 text-base text-ink outline-none transition placeholder:text-[#b2b2b2] focus:border-brand focus:ring-4 focus:ring-[#cf102c]/10';

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('请输入账号和密码');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'UNAUTHORIZED'
          ? '账号或密码错误'
          : '登录失败，请稍后重试',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loggedIn) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return (
    <PageShell className="relative flex min-h-dvh flex-col overflow-hidden bg-[#f6f6f8]">
      <div
        aria-hidden="true"
        className="absolute -top-28 -right-32 h-72 w-72 rounded-full border-[44px] border-white/10"
      />

      <header className="relative overflow-hidden bg-brand px-6 pt-[72px] pb-20 text-white">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[0_10px_28px_rgba(93,0,17,0.2)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 32 32"
            className="h-7 w-7 fill-none stroke-brand"
          >
            <path
              d="M16 3.5 26 7v7.6c0 6.2-4.1 11.5-10 13.9-5.9-2.4-10-7.7-10-13.9V7l10-3.5Z"
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
            <path
              d="m11.5 16 3 3 6.5-7"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="mb-2 text-sm font-medium tracking-[0.18em] text-white/70">
          SPARK
        </p>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
          工作人员工作台
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/75">
          登录后进行奖品核销与现场管理
        </p>
      </header>

      <form
        className="relative -mt-8 mx-4 rounded-2xl bg-white px-5 pt-7 pb-6 shadow-[0_12px_36px_rgba(27,27,31,0.09)]"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">
              账号
            </span>
            <input
              className={field}
              placeholder="请输入工作人员账号"
              value={username}
              autoComplete="username"
              inputMode="text"
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">
              密码
            </span>
            <input
              className={field}
              type="password"
              placeholder="请输入密码"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>

        <div
          aria-live="polite"
          className="min-h-9 pt-3 text-sm text-brand"
        >
          {error}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex h-14 w-full items-center justify-center rounded-xl bg-brand text-[17px] font-semibold text-white shadow-[0_8px_18px_rgba(207,16,44,0.22)] transition active:translate-y-px active:bg-[#b80e27] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? '正在登录…' : '进入工作台'}
        </button>
      </form>

      <footer className="mt-auto px-6 py-8 text-center">
        <p className="text-[13px] leading-5 text-weak">
          账号由管理员统一创建
          <br />
          如无法登录，请联系现场负责人
        </p>
      </footer>
    </PageShell>
  );
}
