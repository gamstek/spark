import { Button, Card, Flex, Heading, Table, TextField } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { api } from '../../api';
type Staff = { id: string; username: string; display_name: string; activity_ids: string[] };
export function StaffPage() {
  const [rows, setRows] = useState<Staff[]>([]);
  const load = () => api<Staff[]>('admin/staff').then(setRows);
  useEffect(() => {
    void load();
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await api('admin/staff', {
      method: 'POST',
      body: JSON.stringify({
        username: f.get('username'),
        displayName: f.get('displayName'),
        password: f.get('password'),
        activityIds: String(f.get('activityIds') || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      }),
    });
    e.currentTarget.reset();
    await load();
  }
  return (
    <>
      <Heading>工作人员</Heading>
      <Card>
        <form onSubmit={submit}>
          <Flex direction="column" gap="2">
            <TextField.Root name="username" placeholder="登录名" required />
            <TextField.Root name="displayName" placeholder="显示名称" required />
            <TextField.Root name="password" type="password" placeholder="初始密码" required />
            <TextField.Root name="activityIds" placeholder="活动 ID，多个用逗号分隔" />
            <Button type="submit">创建并授权</Button>
          </Flex>
        </form>
      </Card>
      <Table.Root variant="surface">
        <Table.Body>
          {rows.map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell>{r.display_name}</Table.Cell>
              <Table.Cell>{r.username}</Table.Cell>
              <Table.Cell>{r.activity_ids.join('、') || '未授权'}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </>
  );
}
