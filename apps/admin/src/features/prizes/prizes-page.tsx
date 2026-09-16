import { PlusIcon } from '@radix-ui/react-icons';
import {
  Button,
  Dialog,
  DropdownMenu,
  Flex,
  Heading,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes';
import type { ActivityStatus } from '@spark/contracts';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { api } from '../../api';
import { DialogActions } from '../../components/dialog-actions';
import {
  EmptyState,
  FeedbackCallout,
  LoadingState,
  Notification,
  NotificationViewport,
} from '../../components/feedback';
import { RequiredFieldMark } from '../../components/required-field-mark';
import { GhostTable, GhostTableFooter } from '../../components/ghost-table';
import { TableRowActions } from '../../components/table-row-actions';
import { randomUUID } from '../../random';
import { getPrizeLevel } from './prize-level';

type Prize = {
  id: string;
  prize_level: string;
  prize_name: string;
  prize_image_url: string | null;
  total_stock: number;
  awarded_stock: number;
};

type StockAttempt = {
  operationId: string;
  quantity: number;
};

type ActivityDetail = {
  revision: number;
  published_version_id: string | null;
  starts_at: string | null;
  status: ActivityStatus;
  serverNow: string;
  config: Record<string, unknown>;
};

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });

export function PrizesPage() {
  const { id = '' } = useParams();
  const [rows, setRows] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [winningProbability, setWinningProbability] = useState('0');
  const [halfDayPrizeLimits, setHalfDayPrizeLimits] = useState<
    Record<string, string>
  >({});
  const [savingDrawRules, setSavingDrawRules] = useState(false);
  const [creatingPrize, setCreatingPrize] = useState(false);
  const creatingPrizeRef = useRef(false);
  const [stockPrize, setStockPrize] = useState<Prize | null>(null);
  const [stockAttempts, setStockAttempts] = useState<
    Record<string, StockAttempt>
  >({});
  const [stockValidationErrorPrizeId, setStockValidationErrorPrizeId] =
    useState('');
  const [stockBusy, setStockBusy] = useState(false);
  const stockBusyRef = useRef(false);
  const stockReturnFocusRef = useRef<HTMLButtonElement | null>(null);

  const load = async () => {
    setRows(await api<Prize[]>(`admin/prizes/activities/${id}`));
  };

  useEffect(() => {
    Promise.all([
      load(),
      api<ActivityDetail>(`admin/activities/${id}`).then((activity) => {
        setActivity(activity);
        setWinningProbability(String(activity.config?.winningProbability ?? 0));
        const savedLimits =
          (activity.config?.halfDayPrizeLimits as Record<string, number>) ?? {};
        setHalfDayPrizeLimits(
          Object.fromEntries(
            Object.entries(savedLimits).map(([prizeId, limit]) => [
              prizeId,
              String(limit),
            ]),
          ),
        );
      }),
    ])
      .catch(() => setError('奖品数据加载失败，请刷新后重试。'))
      .finally(() => setLoading(false));
  }, [id]);

  async function saveDrawRules(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activity || savingDrawRules) return;
    const probability = Number(winningProbability);
    const limits = Object.fromEntries(
      rows.map((row) => [row.id, Number(halfDayPrizeLimits[row.id] ?? 0)]),
    );
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
      setError('中奖概率必须是 0 到 100 之间的数字。');
      return;
    }
    if (
      Object.values(limits).some(
        (limit) => !Number.isSafeInteger(limit) || limit < 0,
      )
    ) {
      setError('每半天中奖数量必须是大于或等于 0 的整数。');
      return;
    }
    setSavingDrawRules(true);
    setError('');
    setMessage('');
    try {
      await api<{
        winningProbability: number;
        halfDayPrizeLimits: Record<string, number>;
      }>(`admin/prizes/activities/${id}/draw-rules`, {
        method: 'PATCH',
        body: JSON.stringify({
          winningProbability: probability,
          halfDayPrizeLimits: limits,
        }),
      });
      setActivity((current) =>
        current
          ? {
              ...current,
              config: {
                ...current.config,
                winningProbability: probability,
                halfDayPrizeLimits: limits,
              },
            }
          : current,
      );
      setMessage('抽奖规则已保存');
    } catch (caught) {
      setError(
        String(caught).includes('VERSION_CONFLICT')
          ? '活动已被其他人修改，请刷新后重试。'
          : '抽奖规则保存失败，请稍后重试。',
      );
    } finally {
      setSavingDrawRules(false);
    }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingPrizeRef.current) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const image = form.get('image');
    if (!(image instanceof File) || image.size === 0) {
      setError('请选择奖品图片。');
      return;
    }
    creatingPrizeRef.current = true;
    setCreatingPrize(true);
    setError('');
    setMessage('');
    let uploadingImage = true;
    try {
      const uploaded = await api<{ id: string }>('admin/media', {
        method: 'POST',
        body: JSON.stringify({
          fileName: image.name,
          contentBase64: await readBase64(image),
        }),
      });
      uploadingImage = false;
      await api(`admin/prizes/activities/${id}`, {
        method: 'POST',
        body: JSON.stringify({
          prizeLevel: form.get('prizeLevel'),
          name: form.get('name'),
          imageAssetId: uploaded.id,
          totalStock: Number(form.get('stock')),
          weight: 1,
        }),
      });
      formElement.reset();
      setMessage('奖项已新增');
      await load();
    } catch {
      setError(
        uploadingImage
          ? '奖品图片上传失败，请使用不超过 5 MB 的 JPEG、PNG 或 WebP 图片。'
          : '新增奖项失败，请检查名称、图片和库存。',
      );
    } finally {
      creatingPrizeRef.current = false;
      setCreatingPrize(false);
    }
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stockPrize || stockBusyRef.current) return;
    stockBusyRef.current = true;
    setStockBusy(true);
    const prizeId = stockPrize.id;
    const form = new FormData(event.currentTarget);
    const attempt =
      stockAttempts[prizeId] ??
      ({
        quantity: Number(form.get('quantity')),
        operationId: randomUUID(),
      } satisfies StockAttempt);
    setStockAttempts((current) => ({ ...current, [prizeId]: attempt }));
    setStockValidationErrorPrizeId('');
    setError('');
    setMessage('');
    try {
      await api(`admin/prizes/activity-prizes/${prizeId}/stock`, {
        method: 'POST',
        body: JSON.stringify(attempt),
      });
      setStockAttempts((current) => {
        const next = { ...current };
        delete next[prizeId];
        return next;
      });
      setStockPrize(null);
      setMessage('库存已添加');
      try {
        await load();
      } catch {
        setError('库存数据刷新失败，请刷新页面查看最新结果。');
      }
    } catch (caught) {
      if (
        caught instanceof Error &&
        caught.message.includes('INVALID_STOCK_QUANTITY')
      ) {
        setStockAttempts((current) => {
          const next = { ...current };
          delete next[prizeId];
          return next;
        });
        setStockValidationErrorPrizeId(prizeId);
      }
    } finally {
      stockBusyRef.current = false;
      setStockBusy(false);
    }
  }

  const currentStockAttempt = stockPrize
    ? stockAttempts[stockPrize.id]
    : undefined;
  const currentStockAttemptIsUncertain = stockPrize
    ? Boolean(currentStockAttempt && !stockBusy)
    : false;
  const currentStockValidationFailed = stockPrize
    ? stockValidationErrorPrizeId === stockPrize.id
    : false;
  const started = Boolean(
    activity && !['DRAFT', 'UPCOMING'].includes(activity.status),
  );
  if (loading) return <LoadingState label="正在加载奖品与库存" />;

  return (
    <>
      <NotificationViewport>
        {message && (
          <Notification
            tone="success"
            message={message}
            onDismiss={() => setMessage('')}
          />
        )}
        {error && (
          <Notification
            tone="error"
            message={error}
            onDismiss={() => setError('')}
          />
        )}
      </NotificationViewport>

      <section className="form-section activity-form-section">
        <div className="form-section-heading">
          <Text
            size="1"
            color="iris"
            weight="bold"
          >
            抽奖配置
          </Text>
          <Heading size="4">抽奖规则</Heading>
          <Text
            as="p"
            size="2"
            color="gray"
          >
            先按总中奖概率判断，再按上海时间的上午、下午时段控制各奖项中奖数量。
          </Text>
        </div>
        <form
          className="draw-rules-form"
          onSubmit={saveDrawRules}
          noValidate
        >
          <div className="draw-rules-probability">
            <div>
              <Text
                as="div"
                size="2"
                weight="medium"
              >
                总中奖概率
              </Text>
              <Text
                as="p"
                size="1"
                color="gray"
              >
                每次抽奖先执行此概率；设置为 0% 时默认不中奖。
              </Text>
            </div>
            <Flex
              className="probability-input"
              align="center"
              gap="2"
            >
              <label
                className="visually-hidden"
                htmlFor="winning-probability"
              >
                中奖概率
              </label>
              <TextField.Root
                id="winning-probability"
                name="winningProbability"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={winningProbability}
                onChange={(event) => setWinningProbability(event.target.value)}
                disabled={savingDrawRules}
                required
              />
              <Text
                size="3"
                weight="medium"
                aria-hidden="true"
              >
                %
              </Text>
            </Flex>
          </div>
          <div className="draw-rule-list">
            <div className="draw-rule-list-heading">
              <Text
                size="2"
                weight="medium"
              >
                各奖项半天上限
              </Text>
              <Text
                size="1"
                color="gray"
              >
                0 个表示该奖项当前不中奖
              </Text>
            </div>
            {rows.length ? (
              rows.map((row) => (
                <div
                  className="draw-rule-row"
                  key={row.id}
                >
                  <div className="draw-rule-prize">
                    <Text
                      size="2"
                      weight="medium"
                    >
                      {row.prize_level}
                    </Text>
                    <Text
                      size="1"
                      color="gray"
                    >
                      {row.prize_name}
                    </Text>
                  </div>
                  <label
                    className="draw-rule-limit-label"
                    htmlFor={`half-day-limit-${row.id}`}
                  >
                    <span>{row.prize_level}半天中奖数量</span>
                    <TextField.Root
                      id={`half-day-limit-${row.id}`}
                      type="number"
                      min="0"
                      step="1"
                      value={halfDayPrizeLimits[row.id] ?? '0'}
                      onChange={(event) =>
                        setHalfDayPrizeLimits((current) => ({
                          ...current,
                          [row.id]: event.target.value,
                        }))
                      }
                      disabled={savingDrawRules}
                      required
                    />
                    <Text
                      size="2"
                      color="gray"
                    >
                      个 / 半天
                    </Text>
                  </label>
                </div>
              ))
            ) : (
              <Text
                className="draw-rule-empty"
                size="2"
                color="gray"
              >
                新增奖项后，可在这里设置对应的半天中奖数量。
              </Text>
            )}
          </div>
          <Flex
            className="draw-rules-actions"
            justify="end"
          >
            <Button
              type="submit"
              variant="solid"
              loading={savingDrawRules}
              disabled={savingDrawRules}
            >
              保存抽奖规则
            </Button>
          </Flex>
        </form>
      </section>

      {rows.length === 0 ? (
        <EmptyState
          title="还没有配置奖品"
          description="至少添加一个奖项后才能发布活动。"
        />
      ) : (
        <div className="table-panel">
          <GhostTable>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>奖项等级</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>奖品</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">
                  已发放
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">
                  可用库存
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">
                  总库存
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">
                  操作
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row
                  key={row.id}
                  align="center"
                >
                  <Table.Cell>{row.prize_level}</Table.Cell>
                  <Table.RowHeaderCell>
                    <Flex
                      align="center"
                      gap="3"
                    >
                      {row.prize_image_url && (
                        <img
                          className="prize-table-image"
                          src={row.prize_image_url}
                          alt=""
                        />
                      )}
                      <Text weight="medium">{row.prize_name}</Text>
                    </Flex>
                  </Table.RowHeaderCell>
                  <Table.Cell
                    justify="end"
                    className="is-numeric"
                  >
                    {row.awarded_stock}
                  </Table.Cell>
                  <Table.Cell
                    justify="end"
                    className="is-numeric"
                  >
                    <Text weight="bold">
                      {row.total_stock - row.awarded_stock}
                    </Text>
                  </Table.Cell>
                  <Table.Cell
                    justify="end"
                    className="is-numeric"
                  >
                    {row.total_stock}
                  </Table.Cell>
                  <Table.Cell justify="end">
                    <TableRowActions
                      label={`奖品操作：${row.prize_name}`}
                      onOpen={(trigger) => {
                        stockReturnFocusRef.current = trigger;
                      }}
                      onCloseAutoFocus={(event) => {
                        if (stockPrize) event.preventDefault();
                      }}
                    >
                      <DropdownMenu.Item onSelect={() => setStockPrize(row)}>
                        添加库存
                      </DropdownMenu.Item>
                    </TableRowActions>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </GhostTable>
          <GhostTableFooter range={`共 ${rows.length} 个奖项`} />
        </div>
      )}

      {!started && (
        <section className="form-section activity-form-section prize-create-section">
          <div className="form-section-heading">
            <Text
              size="1"
              color="iris"
              weight="bold"
            >
              奖项配置
            </Text>
            <Heading size="4">新增奖项</Heading>
            <Text
              as="p"
              size="2"
              color="gray"
            >
              点击新增后自动按顺序设置奖项等级，可按活动需要继续添加。
            </Text>
          </div>
          <form
            className="prize-create-panel"
            onSubmit={create}
            noValidate
          >
            <div className="form-grid form-grid-prize">
              <div className="prize-level-block">
                <Text
                  size="2"
                  weight="medium"
                >
                  奖项等级
                </Text>
                <Text
                  className="prize-level-preview"
                  size="3"
                  weight="bold"
                >
                  {getPrizeLevel(rows.length)}
                </Text>
                <input
                  type="hidden"
                  name="prizeLevel"
                  value={getPrizeLevel(rows.length)}
                />
              </div>
              <Flex
                direction="column"
                gap="2"
              >
                <label
                  className="field-label"
                  htmlFor="prize-name"
                >
                  <Text
                    size="2"
                    weight="medium"
                  >
                    奖品名称 <RequiredFieldMark />
                  </Text>
                </label>
                <TextField.Root
                  size="2"
                  variant="soft"
                  color="gray"
                  id="prize-name"
                  name="name"
                  placeholder="奖品名称"
                  required
                  disabled={creatingPrize}
                />
              </Flex>
              <Flex
                direction="column"
                gap="2"
              >
                <label
                  className="field-label"
                  htmlFor="prize-image"
                >
                  <Text
                    size="2"
                    weight="medium"
                  >
                    奖品图片 <RequiredFieldMark />
                  </Text>
                  <Text
                    size="1"
                    color="gray"
                  >
                    JPEG、PNG 或 WebP，最大 5 MB
                  </Text>
                </label>
                <input
                  id="prize-image"
                  className="file-input"
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  disabled={creatingPrize}
                />
              </Flex>
              <Flex
                direction="column"
                gap="2"
              >
                <label
                  className="field-label"
                  htmlFor="prize-stock"
                >
                  <Text
                    size="2"
                    weight="medium"
                  >
                    初始库存 <RequiredFieldMark />
                  </Text>
                </label>
                <TextField.Root
                  size="2"
                  variant="soft"
                  color="gray"
                  id="prize-stock"
                  name="stock"
                  type="number"
                  min="0"
                  placeholder="初始库存"
                  required
                  disabled={creatingPrize}
                />
              </Flex>
              <Flex
                className="prize-create-action"
                align="end"
              >
                <Button
                  variant="solid"
                  type="submit"
                  disabled={creatingPrize}
                  loading={creatingPrize}
                >
                  <PlusIcon />
                  新增奖项
                </Button>
              </Flex>
            </div>
          </form>
        </section>
      )}

      <Dialog.Root
        open={Boolean(stockPrize)}
        onOpenChange={(open) => {
          if (!open && !stockBusyRef.current) setStockPrize(null);
        }}
      >
        <Dialog.Content
          maxWidth="420px"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            stockReturnFocusRef.current?.focus();
          }}
        >
          <Dialog.Title>添加库存</Dialog.Title>
          <Dialog.Description
            size="2"
            color="gray"
          >
            为“{stockPrize?.prize_name}”增加库存。该操作不能撤销或减少库存。
          </Dialog.Description>
          <form
            onSubmit={add}
            noValidate
          >
            <Flex
              direction="column"
              gap="2"
              mt="5"
            >
              <label
                className="field-label"
                htmlFor="stock-quantity"
              >
                <Text
                  size="2"
                  weight="medium"
                >
                  增加数量
                </Text>
              </label>
              <TextField.Root
                size="2"
                variant="soft"
                color="gray"
                id="stock-quantity"
                name="quantity"
                type="number"
                min="1"
                placeholder="增加数量"
                required
                autoFocus
                defaultValue={currentStockAttempt?.quantity}
                disabled={Boolean(currentStockAttempt)}
              />
            </Flex>
            {currentStockAttemptIsUncertain && (
              <Flex mt="4">
                <FeedbackCallout
                  tone="warning"
                  message="本次添加结果尚未确认，请按原数量重试。重试不会重复增加库存。"
                />
              </Flex>
            )}
            {currentStockValidationFailed && (
              <Flex mt="4">
                <FeedbackCallout
                  tone="error"
                  message="增加数量无效，请输入安全范围内的正整数。"
                />
              </Flex>
            )}
            <DialogActions>
              <Dialog.Close>
                <Button
                  type="button"
                  variant="soft"
                  color="gray"
                  disabled={stockBusy}
                >
                  取消
                </Button>
              </Dialog.Close>
              <Button
                variant="solid"
                type="submit"
                loading={stockBusy}
              >
                {currentStockAttemptIsUncertain ? '重试添加' : '确认添加'}
              </Button>
            </DialogActions>
          </form>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
