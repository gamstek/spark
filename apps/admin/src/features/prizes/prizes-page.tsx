import { PlusIcon } from '@radix-ui/react-icons';
import {
  Button,
  Dialog,
  Flex,
  Heading,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { api } from '../../api';
import { ActivityNav } from '../../components/activity-nav';
import {
  EmptyState,
  FeedbackCallout,
  LoadingState,
} from '../../components/feedback';
import { PageHeader } from '../../components/page-header';
import { randomUUID } from '../../random';

type Prize = {
  id: string;
  prize_name: string;
  total_stock: number;
  awarded_stock: number;
  weight: string;
};

export function PrizesPage() {
  const { id = '' } = useParams();
  const [rows, setRows] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [stockPrize, setStockPrize] = useState<Prize | null>(null);

  const load = async () => {
    setRows(await api<Prize[]>(`admin/prizes/activities/${id}`));
  };

  useEffect(() => {
    Promise.all([
      load(),
      api<{ published_version_id: string | null; starts_at: string | null }>(
        `admin/activities/${id}`,
      ).then((activity) => {
        setStarted(
          Boolean(
            activity.published_version_id &&
            activity.starts_at &&
            new Date(activity.starts_at) <= new Date(),
          ),
        );
      }),
    ])
      .catch(() => setError('奖品数据加载失败，请刷新后重试。'))
      .finally(() => setLoading(false));
  }, [id]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError('');
    try {
      await api(`admin/prizes/activities/${id}`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          totalStock: Number(form.get('stock')),
          weight: Number(form.get('weight')),
        }),
      });
      formElement.reset();
      setMessage('奖项已新增');
      await load();
    } catch {
      setError('新增奖项失败，请检查名称、库存和权重。');
    }
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stockPrize) return;
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await api(`admin/prizes/activity-prizes/${stockPrize.id}/stock`, {
        method: 'POST',
        body: JSON.stringify({
          quantity: Number(form.get('quantity')),
          operationId: randomUUID(),
        }),
      });
      setStockPrize(null);
      setMessage('库存已添加');
      await load();
    } catch {
      setError('库存添加失败，请确认数量后重试。');
    }
  }

  if (loading) return <LoadingState label="正在加载奖品与库存" />;

  return (
    <>
      <PageHeader
        eyebrow="活动运营"
        title="奖品与库存"
        description="运行后只能添加库存，已发放数量和历史中奖结果不会被修改。"
      />
      <ActivityNav activityId={id} />

      {message && (
        <FeedbackCallout
          tone="success"
          message={message}
        />
      )}
      {error && (
        <FeedbackCallout
          tone="error"
          message={error}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="还没有配置奖品"
          description="至少添加一个奖项后才能发布活动。"
        />
      ) : (
        <div className="table-panel">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>奖品</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>已发放</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>可用库存</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>总库存</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>权重</Table.ColumnHeaderCell>
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
                  <Table.RowHeaderCell>
                    <Text weight="medium">{row.prize_name}</Text>
                  </Table.RowHeaderCell>
                  <Table.Cell>{row.awarded_stock}</Table.Cell>
                  <Table.Cell>
                    <Text weight="bold">
                      {row.total_stock - row.awarded_stock}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>{row.total_stock}</Table.Cell>
                  <Table.Cell>{row.weight}</Table.Cell>
                  <Table.Cell justify="end">
                    <Button
                      variant="soft"
                      onClick={() => setStockPrize(row)}
                    >
                      添加库存
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </div>
      )}

      {!started && (
        <section className="form-section">
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
              权重只参与有库存奖品之间的随机选择。
            </Text>
          </div>
          <form onSubmit={create}>
            <div className="form-grid form-grid-prize">
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
                    奖品名称
                  </Text>
                </label>
                <TextField.Root
                  id="prize-name"
                  name="name"
                  placeholder="奖品名称"
                  required
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
                    初始库存
                  </Text>
                </label>
                <TextField.Root
                  id="prize-stock"
                  name="stock"
                  type="number"
                  min="0"
                  placeholder="初始库存"
                  required
                />
              </Flex>
              <Flex
                direction="column"
                gap="2"
              >
                <label
                  className="field-label"
                  htmlFor="prize-weight"
                >
                  <Text
                    size="2"
                    weight="medium"
                  >
                    抽奖权重
                  </Text>
                </label>
                <TextField.Root
                  id="prize-weight"
                  name="weight"
                  type="number"
                  min="0.000001"
                  step="any"
                  placeholder="权重"
                  required
                />
              </Flex>
              <Flex align="end">
                <Button type="submit">
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
        onOpenChange={(open) => !open && setStockPrize(null)}
      >
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>添加库存</Dialog.Title>
          <Dialog.Description
            size="2"
            color="gray"
          >
            为“{stockPrize?.prize_name}”增加库存。该操作不能撤销或减少库存。
          </Dialog.Description>
          <form onSubmit={add}>
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
                id="stock-quantity"
                name="quantity"
                type="number"
                min="1"
                placeholder="增加数量"
                required
                autoFocus
              />
            </Flex>
            <Flex
              gap="3"
              mt="5"
              justify="end"
            >
              <Dialog.Close>
                <Button
                  type="button"
                  variant="soft"
                  color="gray"
                >
                  取消
                </Button>
              </Dialog.Close>
              <Button type="submit">确认添加</Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
