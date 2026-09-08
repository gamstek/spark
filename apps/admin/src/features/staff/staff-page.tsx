import {
  AlertDialog,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { api } from '../../api';
import { EmptyState } from '../../components/empty-state';
import { FeedbackCallout } from '../../components/feedback-callout';
import { LoadingState } from '../../components/loading-state';
import { PageHeader } from '../../components/page-header';
import { StatusBadge } from '../../components/status-badge';

type Staff = {
  id: string;
  username: string;
  display_name: string;
  activity_ids: string[];
  disabled_at: string | null;
};

const parseActivityIds = (value: FormDataEntryValue | null) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export function StaffPage() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const createPending = useRef(false);

  const load = useCallback(async () => {
    try {
      setRows(await api<Staff[]>('admin/staff'));
    } catch {
      setError('工作人员列表加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPending.current) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const missing = ['username', 'displayName', 'password'].find(
      (name) => !String(form.get(name) ?? '').trim(),
    );
    if (missing) {
      setCreateError('请填写登录名、显示名称和初始密码。');
      formElement
        .querySelector<HTMLInputElement>(`[name="${missing}"]`)
        ?.focus();
      return;
    }
    createPending.current = true;
    setCreateError('');
    setBusyId('create');
    setError('');
    setMessage('');
    try {
      await api('admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          username: form.get('username'),
          displayName: form.get('displayName'),
          password: form.get('password'),
          activityIds: parseActivityIds(form.get('activityIds')),
        }),
      });
      formElement.reset();
      setCreateOpen(false);
      setMessage('工作人员已创建并完成活动授权。');
      await load();
    } catch {
      setCreateError('工作人员创建失败，请检查登录名、密码和活动 ID。');
    } finally {
      setBusyId('');
      createPending.current = false;
    }
  }

  async function update(staff: Staff, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyId(staff.id);
    setError('');
    setMessage('');
    try {
      await api(`admin/staff/${staff.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: form.get('displayName'),
          activityIds: parseActivityIds(form.get('activityIds')),
        }),
      });
      const password = String(form.get('password') ?? '');
      if (password) {
        await api(`admin/staff/${staff.id}/password`, {
          method: 'POST',
          body: JSON.stringify({ password }),
        });
      }
      setMessage(`已保存 ${staff.display_name} 的账号设置。`);
      await load();
    } catch {
      setError('账号设置保存失败，请检查填写内容。');
    } finally {
      setBusyId('');
    }
  }

  async function toggle(staff: Staff) {
    setBusyId(staff.id);
    setError('');
    setMessage('');
    try {
      await api(`admin/staff/${staff.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ disabled: !staff.disabled_at }),
      });
      setMessage(
        staff.disabled_at
          ? `${staff.display_name} 已启用。`
          : `${staff.display_name} 已停用。`,
      );
      await load();
    } catch {
      setError('账号状态更新失败，请稍后重试。');
    } finally {
      setBusyId('');
    }
  }

  return (
    <Dialog.Root
      open={createOpen}
      onOpenChange={(value) => {
        if (!createPending.current) {
          setCreateOpen(value);
          setCreateError('');
        }
      }}
    >
      <PageHeader
        eyebrow="账号与权限"
        title="工作人员"
        description="创建核销账号，并限定每个账号可操作的活动。"
        actions={
          <Dialog.Trigger>
            <Button
              variant="solid"
              size="3"
            >
              创建工作人员
            </Button>
          </Dialog.Trigger>
        }
      />

      {error && (
        <FeedbackCallout
          message={error}
          tone="error"
        />
      )}
      {message && (
        <FeedbackCallout
          message={message}
          tone="success"
        />
      )}

      <Dialog.Content
        maxWidth="560px"
        className="staff-create-dialog"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <Dialog.Title>创建工作人员</Dialog.Title>
        <Dialog.Description
          size="2"
          mb="5"
        >
          设置核销账号及其可操作的活动范围。
        </Dialog.Description>
        <form
          onSubmit={submit}
          noValidate
          aria-busy={busyId === 'create'}
        >
          <Flex
            direction="column"
            gap="4"
          >
            <Flex
              direction="column"
              gap="1"
            >
              <Text
                size="2"
                color="gray"
              >
                活动 ID 使用英文逗号分隔。账号创建后可随时修改授权范围。
              </Text>
            </Flex>
            <Grid
              columns={{ initial: '1', sm: '2' }}
              gap="3"
            >
              <Text
                as="label"
                size="2"
                weight="medium"
              >
                登录名
                <TextField.Root
                  size="2"
                  variant="soft"
                  color="gray"
                  mt="1"
                  name="username"
                  autoComplete="username"
                  placeholder="例如：expo-shanghai"
                  required
                />
              </Text>
              <Text
                as="label"
                size="2"
                weight="medium"
              >
                显示名称
                <TextField.Root
                  size="2"
                  variant="soft"
                  color="gray"
                  mt="1"
                  name="displayName"
                  placeholder="例如：上海展会核销组"
                  required
                />
              </Text>
              <Text
                as="label"
                size="2"
                weight="medium"
              >
                初始密码
                <TextField.Root
                  size="2"
                  variant="soft"
                  color="gray"
                  mt="1"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </Text>
              <Text
                as="label"
                size="2"
                weight="medium"
              >
                可操作活动 ID
                <TextField.Root
                  size="2"
                  variant="soft"
                  color="gray"
                  mt="1"
                  name="activityIds"
                  placeholder="ID-1, ID-2"
                />
              </Text>
            </Grid>
            {createError && (
              <div role="alert">
                <FeedbackCallout
                  tone="error"
                  message={createError}
                />
              </div>
            )}
            <Flex
              justify="end"
              gap="3"
              className="dialog-actions"
            >
              <Dialog.Close>
                <Button
                  type="button"
                  variant="soft"
                  color="gray"
                  disabled={busyId === 'create'}
                >
                  取消
                </Button>
              </Dialog.Close>
              <Button
                variant="solid"
                type="submit"
                loading={busyId === 'create'}
              >
                创建并授权
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>

      {loading ? (
        <LoadingState label="正在加载工作人员" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无工作人员"
          description="创建账号后，工作人员即可登录移动核销平台。"
        />
      ) : (
        <Card
          variant="classic"
          size="3"
        >
          <Table.Root variant="ghost">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>账号</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>权限与资料</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((staff) => (
                <Table.Row key={staff.id}>
                  <Table.RowHeaderCell>
                    <Flex
                      direction="column"
                      gap="1"
                    >
                      <Text weight="bold">{staff.username}</Text>
                      <StatusBadge
                        status={staff.disabled_at ? 'DISABLED' : 'ACTIVE'}
                      >
                        {staff.disabled_at ? '已停用' : '正常'}
                      </StatusBadge>
                    </Flex>
                  </Table.RowHeaderCell>
                  <Table.Cell>
                    <form onSubmit={(event) => update(staff, event)}>
                      <Flex
                        direction="column"
                        gap="3"
                      >
                        <Grid
                          columns={{ initial: '1', md: '3' }}
                          gap="2"
                        >
                          <TextField.Root
                            size="2"
                            variant="soft"
                            color="gray"
                            name="displayName"
                            defaultValue={staff.display_name}
                            aria-label={`${staff.username} 的显示名称`}
                            required
                          />
                          <TextField.Root
                            size="2"
                            variant="soft"
                            color="gray"
                            name="activityIds"
                            defaultValue={staff.activity_ids.join(', ')}
                            aria-label={`${staff.username} 的活动权限`}
                            placeholder="活动 ID，以逗号分隔"
                          />
                          <TextField.Root
                            size="2"
                            variant="soft"
                            color="gray"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            aria-label={`${staff.username} 的新密码`}
                            placeholder="新密码（留空不修改）"
                          />
                        </Grid>
                        <Flex
                          justify="end"
                          gap="2"
                          wrap="wrap"
                        >
                          <Button
                            type="submit"
                            variant="solid"
                            loading={busyId === staff.id}
                          >
                            保存设置
                          </Button>
                          {staff.disabled_at ? (
                            <Button
                              type="button"
                              color="gray"
                              variant="soft"
                              onClick={() => toggle(staff)}
                            >
                              启用账号
                            </Button>
                          ) : (
                            <AlertDialog.Root>
                              <AlertDialog.Trigger>
                                <Button
                                  type="button"
                                  color="red"
                                  variant="outline"
                                >
                                  停用账号
                                </Button>
                              </AlertDialog.Trigger>
                              <AlertDialog.Content maxWidth="440px">
                                <AlertDialog.Title>
                                  停用工作人员账号？
                                </AlertDialog.Title>
                                <AlertDialog.Description size="2">
                                  {staff.display_name}
                                  将立即无法登录核销平台，已有核销记录不会受到影响。
                                </AlertDialog.Description>
                                <Flex
                                  gap="3"
                                  mt="4"
                                  justify="end"
                                >
                                  <AlertDialog.Cancel>
                                    <Button
                                      variant="soft"
                                      color="gray"
                                    >
                                      取消
                                    </Button>
                                  </AlertDialog.Cancel>
                                  <AlertDialog.Action>
                                    <Button
                                      variant="solid"
                                      color="red"
                                      onClick={() => toggle(staff)}
                                    >
                                      确认停用
                                    </Button>
                                  </AlertDialog.Action>
                                </Flex>
                              </AlertDialog.Content>
                            </AlertDialog.Root>
                          )}
                        </Flex>
                      </Flex>
                    </form>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Card>
      )}
    </Dialog.Root>
  );
}
