import {
  AlertDialog,
  Button,
  Flex,
  Heading,
  Text,
  TextField,
} from '@radix-ui/themes';
import type { AdminActivityDetail } from '@spark/contracts';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { api } from '../../api';
import { updateActivityContext } from '../../components/activity-nav';
import { DateTimePicker } from '../../components/date-time-picker';
import { DialogActions } from '../../components/dialog-actions';
import {
  EmptyState,
  FeedbackCallout,
  LoadingState,
  Notification,
  NotificationViewport,
} from '../../components/feedback';
import { PageHeader } from '../../components/page-header';
import { RequiredFieldMark } from '../../components/required-field-mark';
import { StatusBadge } from '../../components/status-badge';
import {
  ConfigForm,
  getLotteryConfigError,
} from '../../templates/exhibition-lottery/config-form';
import {
  getActivityScheduleError,
  type ActivitySchedule,
} from './schedule-validation';
import { getActivityActions } from './activity-status';

const scheduleFields = [
  ['startsAt', '活动开始', '参与者可以进入活动'],
  ['drawEndsAt', '抽奖截止', '截止后不能产生新的中奖结果'],
  ['endsAt', '活动结束', '活动页面进入结束状态'],
  ['redeemEndsAt', '兑奖截止', '未核销奖品在此时间后过期'],
] as const;

const toShanghaiInput = (value?: string) =>
  value
    ? new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16)
    : '';

const fromShanghaiInput = (value: FormDataEntryValue | null) =>
  `${String(value)}:00+08:00`;

export function ActivityEditPage() {
  const { id = 'new' } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AdminActivityDetail | null>(null);
  const [loading, setLoading] = useState(id !== 'new');
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [endingDraw, setEndingDraw] = useState(false);
  const [changingRuntimeState, setChangingRuntimeState] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'success' | 'error' | 'warning' | 'info'>(
    'info',
  );

  const activityStatus = id === 'new' ? 'DRAFT' : detail?.status;
  const { canPause, canResume, canEndDraw } = activityStatus
    ? getActivityActions(activityStatus)
    : { canPause: false, canResume: false, canEndDraw: false };
  const locked = activityStatus !== 'DRAFT' && activityStatus !== 'UPCOMING';
  const paused = activityStatus === 'PAUSED';
  const drawEnded = activityStatus === 'DRAW_ENDED';
  const activityEnded = activityStatus === 'ENDED';

  async function loadDetail() {
    if (!id || id === 'new') return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const nextDetail = await api<AdminActivityDetail>(
        `admin/activities/${id}`,
      );
      setDetail(nextDetail);
      updateActivityContext(id, nextDetail);
    } catch (error) {
      setDetail(null);
      setLoadFailed(true);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail().catch(() => undefined);
  }, [id]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage('');
    try {
      const form = new FormData(event.currentTarget);
      const schedule = Object.fromEntries(
        scheduleFields.map(([name]) => [name, String(form.get(name) ?? '')]),
      ) as ActivitySchedule;
      const scheduleError = getActivityScheduleError(schedule);
      if (scheduleError) {
        setTone('error');
        setMessage(scheduleError);
        return;
      }
      const configFields = {
        ...detail?.config,
        requireSubscribe: true,
        winningProbability: Number(detail?.config?.winningProbability ?? 0),
        halfDayPrizeLimits: detail?.config?.halfDayPrizeLimits ?? {},
        rulesText: form.get('rulesText'),
      };
      const configError = getLotteryConfigError(configFields);
      if (configError) {
        setTone('error');
        setMessage(configError);
        return;
      }
      const config = configFields;

      if (id === 'new') {
        const created = await api<{ id: string }>('admin/activities', {
          method: 'POST',
          body: JSON.stringify({
            name: form.get('name'),
            templateId: 'exhibition-lottery',
            templateVersion: 1,
            config,
            startsAt: fromShanghaiInput(schedule.startsAt),
            drawEndsAt: fromShanghaiInput(schedule.drawEndsAt),
            endsAt: fromShanghaiInput(schedule.endsAt),
            redeemEndsAt: fromShanghaiInput(schedule.redeemEndsAt),
          }),
        });
        navigate(`/activities/${created.id}`);
        return;
      }

      const saved = await api<{ revision: number }>(
        `admin/activities/${id}/draft`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            expectedRevision: detail?.revision,
            name: form.get('name'),
            config,
            startsAt: fromShanghaiInput(schedule.startsAt),
            drawEndsAt: fromShanghaiInput(schedule.drawEndsAt),
            endsAt: fromShanghaiInput(schedule.endsAt),
            redeemEndsAt: fromShanghaiInput(schedule.redeemEndsAt),
          }),
        },
      );
      setDetail((current) =>
        current ? { ...current, revision: saved.revision } : current,
      );
      if (detail)
        updateActivityContext(id, {
          ...detail,
          name: String(form.get('name') ?? ''),
        });
      setTone('success');
      setMessage('草稿已保存');
    } catch (error) {
      setTone('error');
      setMessage(
        String(error).includes('VERSION_CONFLICT')
          ? '版本已被其他人修改，请刷新后重试'
          : '保存失败，请检查配置',
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function publish() {
    try {
      await api(`admin/activities/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ expectedRevision: detail?.revision }),
      });
      await loadDetail();
      setTone('success');
      setMessage('活动已发布');
    } catch {
      setTone('error');
      setMessage('发布失败，请检查时间、模板和奖项');
    }
  }

  async function endDraw() {
    setEndingDraw(true);
    try {
      await api(`admin/activities/${id}/end-draw`, { method: 'POST' });
      await loadDetail();
      setTone('warning');
      setMessage('抽奖已提前结束');
    } catch {
      setTone('error');
      setMessage('结束抽奖失败，活动可能尚未开始或已经结束。');
    } finally {
      setEndingDraw(false);
    }
  }

  async function changeRuntimeState(nextPaused: boolean) {
    if (changingRuntimeState) return;
    setChangingRuntimeState(true);
    setMessage('');
    try {
      await api(`admin/activities/${id}/${nextPaused ? 'pause' : 'resume'}`, {
        method: 'POST',
      });
      await loadDetail();
      setTone(nextPaused ? 'warning' : 'success');
      setMessage(nextPaused ? '活动已暂停' : '活动已恢复');
    } catch {
      setTone('error');
      setMessage(
        nextPaused
          ? '暂停失败，活动可能已经暂停或结束。'
          : '恢复失败，活动可能已经恢复或结束。',
      );
    } finally {
      setChangingRuntimeState(false);
    }
  }

  if (loading) return <LoadingState label="正在加载活动配置" />;
  if (!activityStatus || (id !== 'new' && (loadFailed || !detail)))
    return (
      <EmptyState
        title="活动配置加载失败"
        description={message || '请重试后继续操作。'}
        action={
          <Button
            variant="soft"
            onClick={() => void loadDetail().catch(() => undefined)}
          >
            重试
          </Button>
        }
      />
    );

  return (
    <>
      {id === 'new' && (
        <PageHeader
          title="新建活动"
          description="首版使用展会抽奖模板，完成配置和奖品设置后即可发布。"
        />
      )}
      {locked && (
        <FeedbackCallout
          tone="warning"
          message="活动已经开始，模板、规则、时间和奖项配置已锁定。"
        />
      )}
      <NotificationViewport>
        {message && (
          <Notification
            tone={tone}
            message={message}
            onDismiss={() => setMessage('')}
          />
        )}
      </NotificationViewport>

      <form
        className="editor-form"
        onSubmit={submit}
        noValidate
      >
        <div className="editor-form-content">
          <section className="form-section activity-form-section">
            <div className="form-section-heading">
              <Text
                size="1"
                color="iris"
                weight="bold"
              >
                基本信息
              </Text>
              <Heading
                as="h2"
                size="4"
              >
                活动名称
              </Heading>
              <Text
                as="p"
                size="2"
                color="gray"
              >
                名称会出现在运营后台和活动页面。
              </Text>
            </div>
            <Flex
              direction="column"
              gap="2"
            >
              <label
                className="field-label"
                htmlFor="activity-name"
              >
                <Text
                  size="2"
                  weight="medium"
                >
                  活动名称
                  <RequiredFieldMark />
                </Text>
              </label>
              <TextField.Root
                variant="soft"
                color="gray"
                id="activity-name"
                name="name"
                placeholder="活动名称"
                defaultValue={detail?.name}
                size="2"
                required
                disabled={locked}
              />
            </Flex>
          </section>

          <ConfigForm
            locked={locked}
            value={detail?.config}
          />

          <section className="form-section activity-form-section">
            <div className="form-section-heading">
              <Text
                size="1"
                color="iris"
                weight="bold"
              >
                时间安排
              </Text>
              <Heading
                as="h2"
                size="4"
              >
                活动与兑奖周期
              </Heading>
              <Text
                as="p"
                size="2"
                color="gray"
              >
                所有时间按上海时区填写，发布后活动运行以服务端时间为准。
              </Text>
            </div>
            <div className="form-grid">
              {scheduleFields.map(([name, label, description]) => {
                const source = {
                  startsAt: detail?.starts_at,
                  drawEndsAt: detail?.draw_ends_at,
                  endsAt: detail?.ends_at,
                  redeemEndsAt: detail?.redeem_ends_at,
                }[name];
                return (
                  <Flex
                    key={name}
                    direction="column"
                    gap="2"
                  >
                    <label
                      className="field-label"
                      htmlFor={name}
                    >
                      <Text
                        size="2"
                        weight="medium"
                      >
                        {label}
                        <RequiredFieldMark />
                      </Text>
                      <Text
                        size="1"
                        color="gray"
                      >
                        {description}
                      </Text>
                    </label>
                    <DateTimePicker
                      id={name}
                      name={name}
                      label={label}
                      defaultValue={toShanghaiInput(source)}
                      required
                      disabled={locked}
                    />
                  </Flex>
                );
              })}
            </div>
          </section>
        </div>

        <section
          className="editor-action-bar publication-status-panel"
          aria-label="发布状态"
        >
          <Text
            className="publication-status-caption"
            size="1"
            color="gray"
          >
            活动上线
          </Text>
          <Flex
            justify="between"
            align="center"
            gap="3"
          >
            <Heading
              as="h2"
              size="3"
            >
              发布状态
            </Heading>
            <StatusBadge status={activityStatus} />
          </Flex>
          <div className="editor-action-summary">
            <span
              className={`editor-state-dot${paused ? ' is-paused' : locked ? ' is-live' : ''}`}
              aria-hidden="true"
            />
            <div>
              <Text
                as="div"
                size="2"
                weight="medium"
              >
                {activityEnded
                  ? '活动已结束'
                  : drawEnded
                    ? '抽奖已结束'
                    : locked
                      ? paused
                        ? '活动暂停中'
                        : '活动已开始'
                      : id === 'new'
                        ? '准备保存活动'
                        : '保存与发布'}
              </Text>
              <Text
                as="p"
                size="1"
                color="gray"
              >
                {activityEnded
                  ? '活动已结束，不再接受新的参与或抽奖。'
                  : drawEnded
                    ? '活动不再接受新的抽奖，已中奖用户仍可按原期限兑奖。'
                    : locked
                      ? paused
                        ? '新参与和抽奖已停止，兑奖与后台运营不受影响。'
                        : '活动配置已锁定，可暂停活动或前往奖品页补充库存。'
                      : id === 'new'
                        ? '先保存基本配置，再设置奖品并发布。'
                        : '保存当前修改后，即可发布给参与者。'}
              </Text>
            </div>
          </div>
          <Flex
            className="editor-action-buttons"
            gap="3"
            wrap="wrap"
            justify="end"
          >
            {id !== 'new' && (
              <Button
                variant="solid"
                type="button"
                size="2"
                onClick={publish}
                disabled={locked || saving}
              >
                发布活动
              </Button>
            )}
            <Button
              type="submit"
              size="2"
              variant="outline"
              color="gray"
              disabled={locked || saving}
              loading={saving}
            >
              保存草稿
            </Button>
            {(canPause || canResume) &&
              (paused ? (
                <Button
                  type="button"
                  variant="solid"
                  color="jade"
                  size="2"
                  onClick={() => void changeRuntimeState(false)}
                  loading={changingRuntimeState}
                  disabled={changingRuntimeState || endingDraw}
                >
                  恢复活动
                </Button>
              ) : (
                <AlertDialog.Root>
                  <AlertDialog.Trigger>
                    <Button
                      type="button"
                      variant="outline"
                      color="amber"
                      size="2"
                      disabled={changingRuntimeState || endingDraw}
                    >
                      暂停活动
                    </Button>
                  </AlertDialog.Trigger>
                  <AlertDialog.Content maxWidth="460px">
                    <AlertDialog.Title>确认暂停活动？</AlertDialog.Title>
                    <AlertDialog.Description size="2">
                      暂停期间不会接受新的参与和抽奖；已中奖用户仍可正常兑奖，活动截止时间不会顺延。
                    </AlertDialog.Description>
                    <DialogActions>
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
                          color="amber"
                          onClick={() => void changeRuntimeState(true)}
                        >
                          确认暂停活动
                        </Button>
                      </AlertDialog.Action>
                    </DialogActions>
                  </AlertDialog.Content>
                </AlertDialog.Root>
              ))}
            {id !== 'new' && canEndDraw && (
              <div className="publication-danger-zone">
                <AlertDialog.Root>
                  <AlertDialog.Trigger>
                    <Button
                      type="button"
                      color="red"
                      variant="outline"
                      className="editor-danger-action"
                      size="2"
                      disabled={saving}
                    >
                      提前结束抽奖
                    </Button>
                  </AlertDialog.Trigger>
                  <AlertDialog.Content maxWidth="460px">
                    <AlertDialog.Title>确认提前结束抽奖？</AlertDialog.Title>
                    <AlertDialog.Description size="2">
                      结束后不会再产生新的中奖结果，现有中奖者仍可在兑奖期限内核销。
                    </AlertDialog.Description>
                    <DialogActions>
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
                          onClick={endDraw}
                          loading={endingDraw}
                          disabled={endingDraw}
                        >
                          确认结束抽奖
                        </Button>
                      </AlertDialog.Action>
                    </DialogActions>
                  </AlertDialog.Content>
                </AlertDialog.Root>
              </div>
            )}
          </Flex>
        </section>
      </form>
    </>
  );
}
