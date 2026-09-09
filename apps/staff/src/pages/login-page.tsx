import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../lib/api';
import { ActionButton } from '../components/action-button';
import { PageShell } from '../components/page-shell';
import { useStaff } from '../lib/runtime';

export function LoginPage() {
  const { login } = useStaff();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const field =
    'h-[50px] w-full rounded-[10px] border border-line bg-white px-3 text-[15px] text-ink outline-none placeholder:text-sub';

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

  return (
    <PageShell className="flex min-h-screen flex-col">
      <header className="py-3 text-center text-[18px] text-ink">
        工作人员登录
      </header>
      <form
        className="flex flex-1 flex-col justify-center gap-4 px-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          className={field}
          placeholder="账号 / 用户名"
          value={username}
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className={field}
          type="password"
          placeholder="密码"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-center text-[13px] text-brand">{error}</p>}
        <ActionButton
          type="submit"
          disabled={submitting}
          className="mt-2 h-[58px] w-full"
        >
          {submitting ? '登录中…' : '登录'}
        </ActionButton>
      </form>
      <p className="pb-4 text-center text-[12px] text-sub">
        账号由管理员在后台创建
      </p>
    </PageShell>
  );
}
