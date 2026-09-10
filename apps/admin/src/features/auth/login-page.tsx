import {
  ArrowRightIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  LockClosedIcon,
} from '@radix-ui/react-icons';
import {
  Button,
  Flex,
  Heading,
  IconButton,
  Text,
  TextField,
} from '@radix-ui/themes';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setCsrf } from '../../api';
import { FeedbackCallout } from '../../components/feedback';

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);
  const pending = useRef(false);
  const username = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    if (!String(data.get('username')).trim() || !data.get('password')) {
      setError('请输入管理员账号和密码');
      (!String(data.get('username')).trim()
        ? username
        : password
      ).current?.focus();
      return;
    }
    pending.current = true;
    setError('');
    setSubmitting(true);
    try {
      await api('admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: data.get('username'),
          password: data.get('password'),
        }),
      });
      const me = await api<{ csrfToken: string }>('admin/auth/me');
      setCsrf(me.csrfToken);
      navigate('/activities', { replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(
        /INVALID_CREDENTIALS|UNAUTHORIZED|Unauthorized|401/.test(message)
          ? '账号或密码错误，请重试'
          : '登录暂时失败，请检查网络连接后重试。',
      );
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }
  return (
    <main className="login-page">
      <section
        className="login-story"
        aria-label="Spark 运营台介绍"
      >
        <div className="login-wordmark">
          <span
            className="brand-spark"
            aria-hidden="true"
          />
          Spark<span className="login-brand-caption">活动运营工作台</span>
        </div>
        <div className="login-brand-story">
          <span className="login-story-label">让每一次参与，都更有价值</span>
          <Heading
            as="h2"
            className="login-story-heading"
          >
            精彩活动，
            <br />
            从这里开启。
          </Heading>
          <Text
            as="p"
            className="login-story-description"
          >
            从活动筹备到现场核销，
            <br />
            把每个环节，安排得井然有序。
          </Text>
          <div className="login-story-flow">
            <span>活动配置</span>
            <span aria-hidden="true">／</span>
            <span>奖品管理</span>
            <span aria-hidden="true">／</span>
            <span>现场核销</span>
          </div>
        </div>
        <div className="login-story-footer">
          <span>Spark</span>
          <span>连接品牌与每一次相遇</span>
        </div>
      </section>
      <section className="login-form-area">
        <div className="login-card">
          <span
            className="login-emblem"
            aria-hidden="true"
          >
            S
          </span>
          <Heading
            as="h1"
            size="7"
          >
            登录 Spark
          </Heading>
          <Text
            as="p"
            size="2"
            color="gray"
            mt="3"
            mb="6"
          >
            进入你的活动运营工作空间。
          </Text>
          <form
            onSubmit={submit}
            noValidate
            aria-busy={submitting}
          >
            <Flex
              direction="column"
              gap="4"
              className="login-fields"
            >
              <div className="login-field">
                <label htmlFor="admin-username">管理员账号</label>
                <TextField.Root
                  variant="soft"
                  color="gray"
                  ref={username}
                  id="admin-username"
                  name="username"
                  placeholder="输入管理员账号"
                  size="3"
                  autoComplete="username"
                  required
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>
              <div className="login-field">
                <label htmlFor="admin-password">密码</label>
                <TextField.Root
                  variant="soft"
                  color="gray"
                  ref={password}
                  id="admin-password"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  placeholder="输入密码"
                  size="3"
                  autoComplete="current-password"
                  required
                  aria-describedby={error ? 'login-error' : undefined}
                >
                  <TextField.Slot side="right">
                    <IconButton
                      type="button"
                      variant="ghost"
                      color="gray"
                      aria-label={visible ? '隐藏密码' : '显示密码'}
                      aria-pressed={visible}
                      onClick={() => setVisible((value) => !value)}
                    >
                      {visible ? <EyeClosedIcon /> : <EyeOpenIcon />}
                    </IconButton>
                  </TextField.Slot>
                </TextField.Root>
              </div>
              {error && (
                <div
                  id="login-error"
                  role="alert"
                >
                  <FeedbackCallout
                    message={error}
                    tone="error"
                  />
                </div>
              )}
              <Button
                variant="solid"
                type="submit"
                size="3"
                loading={submitting}
              >
                登录
                <ArrowRightIcon />
              </Button>
            </Flex>
          </form>
          <div className="login-security">
            <LockClosedIcon aria-hidden="true" />
            <span>仅限授权管理员访问</span>
          </div>
        </div>
        <Text
          size="1"
          className="login-help"
        >
          账号由管理员统一创建。如需帮助，请联系系统管理员。
        </Text>
      </section>
    </main>
  );
}
