import {
  AlertDialog,
  Card,
  Button,
  Flex,
  Heading,
  Text,
  TextField,
} from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { api } from '../../api';
import { FeedbackCallout, LoadingState } from '../../components/feedback';
import { PageHeader } from '../../components/page-header';
import { RequiredFieldMark } from '../../components/required-field-mark';
import {
  ConfigForm,
  getLotteryConfigError,
} from '../../templates/exhibition-lottery/config-form';
import {
  getActivityScheduleError,
  type ActivitySchedule,
} from './schedule-validation';

type Detail = {
  name: string;
  code: string;
  revision: number;
  starts_at?: string;
  draw_ends_at?: string;
  ends_at?: string;
  redeem_ends_at?: string;
  config?: Record<string, unknown>;
  published_version_id?: string | null;
};

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

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });

export function ActivityEditPage() {
  const { id = 'new' } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(id !== 'new');
  const [saving, setSaving] = useState(false);
  const [endingDraw, setEndingDraw] = useState(false);
  const savingRef = useRef(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'success' | 'error' | 'warning' | 'info'>(
    'info',
  );

  const locked = Boolean(
    detail?.published_version_id &&
    detail.starts_at &&
    new Date(detail.starts_at) <= new Date(),
  );
  const now = Date.now();
  const canEndDraw = Boolean(
    detail?.published_version_id &&
    detail.starts_at &&
    new Date(detail.starts_at).getTime() <= now &&
    detail.draw_ends_at &&
    new Date(detail.draw_ends_at).getTime() > now,
  );

  async function loadDetail() {
    if (!id || id === 'new') return;
    setLoading(true);
    try {
      setDetail(await api<Detail>(`admin/activities/${id}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [id]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage('');
    let uploadingHero = false;

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
      let heroAssetId = form.get('heroAssetId');
      const heroFile = form.get('heroFile');
      const hasHeroFile = heroFile instanceof File && heroFile.size > 0;
      const configFields = {
        formId: form.get('formId'),
        formUrl: form.get('formUrl'),
        prefillField: form.get('prefillField'),
        fieldMapping: {
          participationId: '参与编号',
          name: '姓名',
          phone: '手机号',
        },
        requireSubscribe: true,
        noPrizeWeight: Number(detail?.config?.noPrizeWeight ?? 1),
        heroAssetId: heroAssetId || (hasHeroFile ? 'pending-upload' : ''),
        rulesText: form.get('rulesText'),
      };
      const configError = getLotteryConfigError(configFields);
      if (configError) {
        setTone('error');
        setMessage(configError);
        return;
      }
      if (hasHeroFile) {
        uploadingHero = true;
        const uploaded = await api<{ id: string }>('admin/media', {
          method: 'POST',
          body: JSON.stringify({
            fileName: heroFile.name,
            contentBase64: await readBase64(heroFile),
          }),
        });
        heroAssetId = uploaded.id;
        uploadingHero = false;
      }
      const config = {
        ...configFields,
        heroAssetId,
      };

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
      setTone('success');
      setMessage('草稿已保存');
    } catch (error) {
      setTone('error');
      setMessage(
        uploadingHero
          ? '主图上传失败，请检查图片格式、大小和网络后重试。'
          : String(error).includes('VERSION_CONFLICT')
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

  if (loading) return <LoadingState label="正在加载活动配置" />;

  return (
    <>
      {id === 'new' && (
        <PageHeader
          eyebrow="创建活动"
          title="新建活动"
          description="首版使用展会抽奖模板，完成配置和奖品设置后即可发布。"
        />
      )}
      {id !== 'new' && detail?.code && (
        <Text
          as="p"
          size="2"
          color="gray"
          className="activity-address"
        >
          活动地址：/activity/{detail.code}
        </Text>
      )}

      {locked && (
        <FeedbackCallout
          tone="warning"
          message="活动已经开始，模板、规则、时间和奖项配置已锁定。"
        />
      )}
      {message && (
        <FeedbackCallout
          tone={tone}
          message={message}
        />
      )}

      <form
        className="editor-form"
        onSubmit={submit}
      >
        <div className="editor-form-content">
          <Card
            variant="classic"
            size="4"
            className="form-section"
          >
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
          </Card>

          <ConfigForm
            locked={locked}
            value={detail?.config}
          />

          <Card
            variant="classic"
            size="4"
            className="form-section"
          >
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
                    <TextField.Root
                      size="2"
                      variant="soft"
                      color="gray"
                      id={name}
                      name={name}
                      type="datetime-local"
                      defaultValue={toShanghaiInput(source)}
                      required
                      disabled={locked}
                    />
                  </Flex>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="editor-action-bar">
          <div className="editor-action-summary">
            <span
              className={`editor-state-dot${locked ? ' is-live' : ''}`}
              aria-hidden="true"
            />
            <div>
              <Text
                as="div"
                size="2"
                weight="medium"
              >
                {locked
                  ? '活动已开始'
                  : id === 'new'
                    ? '准备保存活动'
                    : '保存与发布'}
              </Text>
              <Text
                as="p"
                size="1"
                color="gray"
              >
                {locked
                  ? '活动配置已锁定，可前往奖品页补充库存。'
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
            <Button
              type="submit"
              size="3"
              variant={id === 'new' ? 'solid' : 'soft'}
              color={id === 'new' ? undefined : 'gray'}
              disabled={locked || saving}
              loading={saving}
            >
              保存草稿
            </Button>
            {id !== 'new' && (
              <Button
                variant="solid"
                type="button"
                size="3"
                onClick={publish}
                disabled={locked || saving}
              >
                发布活动
              </Button>
            )}
            {id !== 'new' && canEndDraw && (
              <AlertDialog.Root>
                <AlertDialog.Trigger>
                  <Button
                    type="button"
                    color="red"
                    variant="outline"
                    className="editor-danger-action"
                    size="3"
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
                  <Flex
                    gap="3"
                    mt="5"
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
                        onClick={endDraw}
                        loading={endingDraw}
                        disabled={endingDraw}
                      >
                        确认结束抽奖
                      </Button>
                    </AlertDialog.Action>
                  </Flex>
                </AlertDialog.Content>
              </AlertDialog.Root>
            )}
          </Flex>
        </div>
      </form>
    </>
  );
}
