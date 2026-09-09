import {
  AlertDialog,
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Heading,
  Text,
  TextField,
} from '@radix-ui/themes';
import {
  CheckCircledIcon,
  LockClosedIcon,
  Pencil2Icon,
  PersonIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
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
import { RequiredFieldMark } from '../../components/required-field-mark';
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
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
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
      setEditingStaff(null);
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
              <PlusIcon />
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
                <RequiredFieldMark />
                <TextField.Root
                  size="2"
                  variant="soft"
                  color="gray"
                  mt="1"
                  name="username"
                  aria-label="登录名"
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
                <RequiredFieldMark />
                <TextField.Root
                  size="2"
                  variant="soft"
                  color="gray"
                  mt="1"
                  name="displayName"
                  aria-label="显示名称"
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
                <RequiredFieldMark />
                <TextField.Root
                  size="2"
                  variant="soft"
                  color="gray"
                  mt="1"
                  name="password"
                  aria-label="初始密码"
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
                  aria-label="可操作活动 ID"
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

      {!loading && rows.length > 0 && (
        <div className="staff-overview">
          {[
            {
              label: '全部账号',
              value: rows.length,
              note: '已创建的核销账号',
              icon: PersonIcon,
              tone: 'violet',
            },
            {
              label: '正常使用',
              value: rows.filter((staff) => !staff.disabled_at).length,
              note: '当前可以登录核销端',
              icon: CheckCircledIcon,
              tone: 'teal',
            },
            {
              label: '已停用',
              value: rows.filter((staff) => staff.disabled_at).length,
              note: '暂时无法登录',
              icon: LockClosedIcon,
              tone: 'amber',
            },
          ].map((metric) => (
            <Card
              key={metric.label}
              variant="classic"
              size="3"
              className={`staff-metric tone-${metric.tone}`}
            >
              <div className="staff-metric__heading">
                <Text
                  size="2"
                  color="gray"
                >
                  {metric.label}
                </Text>
                <span
                  className="staff-metric__icon"
                  aria-hidden="true"
                >
                  <metric.icon />
                </span>
              </div>
              <strong>{metric.value}</strong>
              <Text
                as="p"
                size="1"
                color="gray"
              >
                {metric.note}
              </Text>
            </Card>
          ))}
        </div>
      )}

      <Card
        variant="classic"
        size={{ initial: '3', sm: '4' }}
        className="staff-directory-panel"
      >
        {!loading && rows.length > 0 && (
          <div className="staff-directory-heading">
            <div>
              <Flex
                align="center"
                gap="2"
              >
                <Heading
                  as="h2"
                  size="4"
                >
                  核销团队
                </Heading>
                <Badge
                  color="gray"
                  variant="soft"
                >
                  {rows.length}
                </Badge>
              </Flex>
              <Text
                as="p"
                size="2"
                color="gray"
              >
                查看账号状态与活动授权，需要修改时再打开账号设置。
              </Text>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingState label="正在加载工作人员" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="暂无工作人员"
            description="创建账号后，工作人员即可登录移动核销平台。"
          />
        ) : (
          <div className="staff-directory">
            {rows.map((staff) => (
              <article
                className={`staff-account${staff.disabled_at ? ' is-disabled' : ''}`}
                key={staff.id}
              >
                <div className="staff-account__identity">
                  <Avatar
                    size="3"
                    variant="soft"
                    color={staff.disabled_at ? 'gray' : 'iris'}
                    fallback={staff.display_name.slice(0, 1)}
                    aria-hidden="true"
                  />
                  <div className="staff-account__name">
                    <Flex
                      align="center"
                      gap="2"
                      wrap="wrap"
                    >
                      <Text weight="bold">{staff.display_name}</Text>
                      <StatusBadge
                        status={staff.disabled_at ? 'disabled' : 'enabled'}
                      />
                    </Flex>
                    <Text
                      size="2"
                      color="gray"
                    >
                      @{staff.username}
                    </Text>
                  </div>
                </div>

                <div className="staff-account__permissions">
                  <Text
                    size="1"
                    color="gray"
                    weight="medium"
                  >
                    可操作活动 · {staff.activity_ids.length}
                  </Text>
                  <Flex
                    gap="1"
                    wrap="wrap"
                  >
                    {staff.activity_ids.length === 0 ? (
                      <Text
                        size="2"
                        color="gray"
                      >
                        尚未授权活动
                      </Text>
                    ) : (
                      <>
                        {staff.activity_ids.slice(0, 3).map((activityId) => (
                          <Badge
                            key={activityId}
                            color="gray"
                            variant="surface"
                          >
                            {activityId}
                          </Badge>
                        ))}
                        {staff.activity_ids.length > 3 && (
                          <Badge
                            color="gray"
                            variant="soft"
                          >
                            +{staff.activity_ids.length - 3}
                          </Badge>
                        )}
                      </>
                    )}
                  </Flex>
                </div>

                <Flex
                  className="staff-account__actions"
                  gap="2"
                  align="center"
                  justify="end"
                  wrap="wrap"
                >
                  <Button
                    type="button"
                    size="2"
                    variant="soft"
                    color="gray"
                    onClick={() => setEditingStaff(staff)}
                  >
                    <Pencil2Icon />
                    账号设置
                  </Button>
                  {staff.disabled_at ? (
                    <Button
                      type="button"
                      size="2"
                      color="iris"
                      variant="soft"
                      loading={busyId === staff.id}
                      onClick={() => toggle(staff)}
                    >
                      启用账号
                    </Button>
                  ) : (
                    <AlertDialog.Root>
                      <AlertDialog.Trigger>
                        <Button
                          type="button"
                          size="2"
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
                              type="button"
                              variant="soft"
                              color="gray"
                            >
                              取消
                            </Button>
                          </AlertDialog.Cancel>
                          <AlertDialog.Action>
                            <Button
                              type="button"
                              variant="solid"
                              color="red"
                              loading={busyId === staff.id}
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
              </article>
            ))}
          </div>
        )}
      </Card>

      <Dialog.Root
        open={Boolean(editingStaff)}
        onOpenChange={(open) => {
          if (!open && !busyId) setEditingStaff(null);
        }}
      >
        <Dialog.Content maxWidth="560px">
          <Dialog.Title>账号设置</Dialog.Title>
          <Dialog.Description
            size="2"
            mb="5"
          >
            修改 {editingStaff?.display_name} 的显示名称、活动授权或登录密码。
          </Dialog.Description>
          {editingStaff && (
            <form
              onSubmit={(event) => update(editingStaff, event)}
              aria-busy={busyId === editingStaff.id}
            >
              <Flex
                direction="column"
                gap="4"
              >
                <div className="staff-edit-identity">
                  <Avatar
                    size="3"
                    variant="soft"
                    fallback={editingStaff.display_name.slice(0, 1)}
                    aria-hidden="true"
                  />
                  <div>
                    <Text
                      as="div"
                      weight="bold"
                    >
                      {editingStaff.display_name}
                    </Text>
                    <Text
                      size="2"
                      color="gray"
                    >
                      登录名 @{editingStaff.username} 不可修改
                    </Text>
                  </div>
                </div>
                <Text
                  as="label"
                  size="2"
                  weight="medium"
                >
                  显示名称
                  <RequiredFieldMark />
                  <TextField.Root
                    size="2"
                    variant="soft"
                    color="gray"
                    mt="1"
                    name="displayName"
                    aria-label="显示名称"
                    defaultValue={editingStaff.display_name}
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
                    aria-label="可操作活动 ID"
                    defaultValue={editingStaff.activity_ids.join(', ')}
                    placeholder="活动 ID，以英文逗号分隔"
                  />
                </Text>
                <Text
                  as="label"
                  size="2"
                  weight="medium"
                >
                  重置密码
                  <TextField.Root
                    size="2"
                    variant="soft"
                    color="gray"
                    mt="1"
                    name="password"
                    aria-label="重置密码"
                    type="password"
                    autoComplete="new-password"
                    placeholder="留空则不修改"
                  />
                </Text>
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
                      disabled={busyId === editingStaff.id}
                    >
                      取消
                    </Button>
                  </Dialog.Close>
                  <Button
                    type="submit"
                    variant="solid"
                    loading={busyId === editingStaff.id}
                  >
                    保存设置
                  </Button>
                </Flex>
              </Flex>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Dialog.Root>
  );
}
