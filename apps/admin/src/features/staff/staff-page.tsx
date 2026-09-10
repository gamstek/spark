import {
  AlertDialog,
  Avatar,
  Badge,
  Button,
  Dialog,
  DropdownMenu,
  Flex,
  Grid,
  Heading,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes';
import {
  CheckCircledIcon,
  LockClosedIcon,
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
import { GhostTable, GhostTableFooter } from '../../components/ghost-table';
import { TableRowActions } from '../../components/table-row-actions';
import {
  ActivityPermissionSelect,
  type ActivityOption,
} from './activity-permission-select';

type Staff = {
  id: string;
  username: string;
  display_name: string;
  activity_ids: string[];
  disabled_at: string | null;
};

const activityIdsFrom = (form: FormData) =>
  form.getAll('activityIds').map(String).filter(Boolean);

export function StaffPage() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [createError, setCreateError] = useState('');
  const [createActivityIds, setCreateActivityIds] = useState<string[]>([]);
  const [editingActivityIds, setEditingActivityIds] = useState<string[]>([]);
  const createPending = useRef(false);
  const [disablingStaff, setDisablingStaff] = useState<Staff | null>(null);
  const rowReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const restoreRowAfterLoading = useRef(false);

  useEffect(() => {
    if (!busyId && restoreRowAfterLoading.current) {
      restoreRowAfterLoading.current = false;
      if (document.activeElement === document.body)
        rowReturnFocusRef.current?.focus();
    }
  }, [busyId]);

  function returnRowFocus(event: Event) {
    event.preventDefault();
    if (busyId) restoreRowAfterLoading.current = true;
    else rowReturnFocusRef.current?.focus();
  }

  const load = useCallback(async () => {
    try {
      const [staffRows, activityRows] = await Promise.all([
        api<Staff[]>('admin/staff'),
        api<ActivityOption[]>('admin/activities'),
      ]);
      setRows(staffRows);
      setActivities(activityRows);
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
          activityIds: activityIdsFrom(form),
        }),
      });
      formElement.reset();
      setCreateActivityIds([]);
      setCreateOpen(false);
      setMessage('工作人员已创建并完成活动授权。');
      await load();
    } catch {
      setCreateError('工作人员创建失败，请检查登录名、密码和活动授权。');
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
          activityIds: activityIdsFrom(form),
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
          if (value) setCreateActivityIds([]);
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
              size="2"
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
            <Text
              size="2"
              color="gray"
            >
              账号创建后可随时修改活动授权范围。
            </Text>
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
              <div>
                <Text
                  as="div"
                  size="2"
                  weight="medium"
                >
                  可操作活动
                </Text>
                <div className="mt-1">
                  <ActivityPermissionSelect
                    activities={activities}
                    selectedIds={createActivityIds}
                    onChange={setCreateActivityIds}
                  />
                </div>
              </div>
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
            <div
              key={metric.label}
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
            </div>
          ))}
        </div>
      )}

      <section
        className="staff-directory-panel"
        aria-label="核销团队"
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
          <div className="table-panel">
            <GhostTable className="staff-table">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>显示名称</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>账号</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>活动权限</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">
                    授权数量
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>状态</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">
                    操作
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((staff) => (
                  <Table.Row
                    key={staff.id}
                    align="center"
                  >
                    <Table.RowHeaderCell>
                      {staff.display_name}
                    </Table.RowHeaderCell>
                    <Table.Cell>@{staff.username}</Table.Cell>
                    <Table.Cell>
                      <Flex gap="1">
                        {staff.activity_ids.length === 0 ? (
                          <Text
                            size="2"
                            color="gray"
                          >
                            尚未授权活动
                          </Text>
                        ) : (
                          <>
                            {staff.activity_ids
                              .slice(0, 3)
                              .map((activityId) => (
                                <Badge
                                  key={activityId}
                                  color="gray"
                                  variant="surface"
                                >
                                  {activities.find(
                                    (activity) => activity.id === activityId,
                                  )?.name ?? '未知活动'}
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
                    </Table.Cell>
                    <Table.Cell
                      justify="end"
                      className="is-numeric"
                    >
                      {staff.activity_ids.length}
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge
                        status={staff.disabled_at ? 'disabled' : 'enabled'}
                      />
                    </Table.Cell>
                    <Table.Cell justify="end">
                      <TableRowActions
                        label={`工作人员操作：${staff.username}`}
                        loading={busyId === staff.id}
                        onOpen={(trigger) => {
                          rowReturnFocusRef.current = trigger;
                        }}
                        onCloseAutoFocus={(event) => {
                          if (editingStaff || disablingStaff)
                            event.preventDefault();
                        }}
                      >
                        <DropdownMenu.Item
                          disabled={busyId === staff.id}
                          onSelect={() => {
                            setEditingStaff(staff);
                            setEditingActivityIds(staff.activity_ids);
                          }}
                        >
                          账号设置
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        {staff.disabled_at ? (
                          <DropdownMenu.Item
                            disabled={busyId === staff.id}
                            onSelect={() => void toggle(staff)}
                          >
                            启用账号
                          </DropdownMenu.Item>
                        ) : (
                          <DropdownMenu.Item
                            color="red"
                            disabled={busyId === staff.id}
                            onSelect={() => setDisablingStaff(staff)}
                          >
                            停用账号
                          </DropdownMenu.Item>
                        )}
                      </TableRowActions>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </GhostTable>
            <GhostTableFooter range={`共 ${rows.length} 个账号`} />
          </div>
        )}
      </section>

      <AlertDialog.Root
        open={Boolean(disablingStaff)}
        onOpenChange={(open) => {
          if (!open) setDisablingStaff(null);
        }}
      >
        <AlertDialog.Content
          maxWidth="440px"
          onCloseAutoFocus={returnRowFocus}
        >
          <AlertDialog.Title>停用工作人员账号？</AlertDialog.Title>
          <AlertDialog.Description size="2">
            {disablingStaff?.display_name}
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
                loading={busyId === disablingStaff?.id}
                onClick={() => {
                  if (disablingStaff) void toggle(disablingStaff);
                }}
              >
                确认停用
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>

      <Dialog.Root
        open={Boolean(editingStaff)}
        onOpenChange={(open) => {
          if (!open && !busyId) setEditingStaff(null);
        }}
      >
        <Dialog.Content
          maxWidth="560px"
          onCloseAutoFocus={returnRowFocus}
        >
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
                <div>
                  <Text
                    as="div"
                    size="2"
                    weight="medium"
                  >
                    可操作活动
                  </Text>
                  <div className="mt-1">
                    <ActivityPermissionSelect
                      activities={activities}
                      selectedIds={editingActivityIds}
                      onChange={setEditingActivityIds}
                    />
                  </div>
                </div>
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
