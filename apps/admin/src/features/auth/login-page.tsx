import { Button, Card, Flex, Heading, TextField } from '@radix-ui/themes';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setCsrf } from '../../api';
export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api('admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: data.get('username'), password: data.get('password') }),
      });
      const me = await api<{ csrfToken: string }>('admin/auth/me');
      setCsrf(me.csrfToken);
      navigate('/activities');
    } catch {
      setError('账号或密码错误，请重试');
    }
  }
  return (
    <main className="login">
      <Card size="4">
        <form onSubmit={submit}>
          <Flex direction="column" gap="4">
            <Heading>Spark 运营管理后台</Heading>
            <TextField.Root name="username" placeholder="管理员账号" required />
            <TextField.Root name="password" type="password" placeholder="密码" required />
            {error && <p className="error">{error}</p>}
            <Button type="submit">登录</Button>
          </Flex>
        </form>
      </Card>
    </main>
  );
}
