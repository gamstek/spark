import {
  Button,
  Card,
  Flex,
  Heading,
  Table,
  TextField,
} from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { api } from '../../api';
type Staff = {
  id: string;
  username: string;
  display_name: string;
  activity_ids: string[];
  disabled_at: string | null;
};
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
  async function update(staff: Staff, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api(`admin/staff/${staff.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        displayName: form.get('displayName'),
        activityIds: String(form.get('activityIds') ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    });
    const password = String(form.get('password') ?? '');
    if (password) {
      await api(`admin/staff/${staff.id}/password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    }
    await load();
  }
  async function toggle(staff: Staff) {
    await api(`admin/staff/${staff.id}/status`, {
      method: 'POST',
      body: JSON.stringify({ disabled: !staff.disabled_at }),
    });
    await load();
  }
  return (
    <>
      <Heading>工作人员</Heading>
      <Card>
        <form onSubmit={submit}>
          <Flex
            direction="column"
            gap="2"
          >
            <TextField.Root
              name="username"
              placeholder="登录名"
              required
            />
            <TextField.Root
              name="displayName"
              placeholder="显示名称"
              required
            />
            <TextField.Root
              name="password"
              type="password"
              placeholder="初始密码"
              required
            />
            <TextField.Root
              name="activityIds"
              placeholder="活动 ID，多个用逗号分隔"
            />
            <Button type="submit">创建并授权</Button>
          </Flex>
        </form>
      </Card>
      <Table.Root variant="surface">
        <Table.Body>
          {rows.map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell>{r.username}</Table.Cell>
              <Table.Cell colSpan={2}>
                <form onSubmit={(event) => update(r, event)}>
                  <Flex
                    gap="2"
                    wrap="wrap"
                  >
                    <TextField.Root
                      name="displayName"
                      defaultValue={r.display_name}
                      required
                    />
                    <TextField.Root
                      name="activityIds"
                      defaultValue={r.activity_ids.join(',')}
                    />
                    <TextField.Root
                      name="password"
                      type="password"
                      placeholder="新密码（可选）"
                    />
                    <Button
                      type="submit"
                      variant="soft"
                    >
                      保存
                    </Button>
                    <Button
                      type="button"
                      color={r.disabled_at ? 'green' : 'red'}
                      variant="soft"
                      onClick={() => toggle(r)}
                    >
                      {r.disabled_at ? '启用' : '停用'}
                    </Button>
                  </Flex>
                </form>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </>
  );
}
