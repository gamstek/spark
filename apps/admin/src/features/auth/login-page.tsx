import { Button, Card, Flex, Heading, Text, TextField } from '@radix-ui/themes';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api, setCsrf } from '../../api';
import { FeedbackCallout } from '../../components/feedback';

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
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
      navigate('/activities');
    } catch {
      setError('账号或密码错误，请重试');
    } finally {
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
          Spark 运营台
        </div>
        <div>
          <Text className="login-kicker">展会活动控制台</Text>
          <Heading
            size="8"
            className="login-story-title"
          >
            让每一场活动，
            <br />
            从发布到核销都有据可查。
          </Heading>
          <Text
            as="p"
            size="3"
            className="login-story-copy"
          >
            在一个工作台管理活动配置、奖品库存、参与线索和现场核销。
          </Text>
        </div>
        <Text
          size="2"
          className="login-story-footnote"
        >
          Project Spark · 单组织运营环境
        </Text>
      </section>

      <section className="login-form-area">
        <Card
          size="4"
          className="login-card"
        >
          <Flex
            direction="column"
            gap="5"
          >
            <div>
              <Heading size="6">登录管理后台</Heading>
              <Text
                as="p"
                size="2"
                color="gray"
                mt="2"
              >
                使用管理员账号继续
              </Text>
            </div>
            <form onSubmit={submit}>
              <Flex
                direction="column"
                gap="4"
              >
                <label
                  className="field-label"
                  htmlFor="admin-username"
                >
                  <Text
                    size="2"
                    weight="medium"
                  >
                    管理员账号
                  </Text>
                </label>
                <TextField.Root
                  id="admin-username"
                  name="username"
                  placeholder="管理员账号"
                  size="3"
                  autoComplete="username"
                  required
                />
                <label
                  className="field-label"
                  htmlFor="admin-password"
                >
                  <Text
                    size="2"
                    weight="medium"
                  >
                    密码
                  </Text>
                </label>
                <TextField.Root
                  id="admin-password"
                  name="password"
                  type="password"
                  placeholder="密码"
                  size="3"
                  autoComplete="current-password"
                  required
                />
                {error && (
                  <FeedbackCallout
                    message={error}
                    tone="error"
                  />
                )}
                <Button
                  type="submit"
                  size="3"
                  loading={submitting}
                >
                  登录
                </Button>
              </Flex>
            </form>
          </Flex>
        </Card>
      </section>
    </main>
  );
}
