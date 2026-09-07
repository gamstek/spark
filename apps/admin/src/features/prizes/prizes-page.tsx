import {
  Button,
  Card,
  Flex,
  Heading,
  Table,
  TextField,
} from '@radix-ui/themes';
import { randomUUID } from '../../random';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
type Prize = {
  id: string;
  prize_name: string;
  total_stock: number;
  awarded_stock: number;
  weight: string;
};
export function PrizesPage() {
  const { id } = useParams();
  const [rows, setRows] = useState<Prize[]>([]);
  const [message, setMessage] = useState('');
  const [started, setStarted] = useState(false);
  const load = () =>
    api<Prize[]>(`admin/prizes/activities/${id}`).then(setRows);
  useEffect(() => {
    void load();
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
    });
  }, [id]);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await api(`admin/prizes/activities/${id}`, {
      method: 'POST',
      body: JSON.stringify({
        name: f.get('name'),
        totalStock: Number(f.get('stock')),
        weight: Number(f.get('weight')),
      }),
    });
    await load();
  }
  async function add(prizeId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await api(`admin/prizes/activity-prizes/${prizeId}/stock`, {
      method: 'POST',
      body: JSON.stringify({
        quantity: Number(f.get('quantity')),
        operationId: randomUUID(),
      }),
    });
    setMessage('库存已添加');
    await load();
  }
  return (
    <>
      <Heading>奖品与库存</Heading>
      <p>运行后仅允许添加库存，不能减少或删除奖项。</p>
      <Table.Root variant="surface">
        <Table.Body>
          {rows.map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell>{r.prize_name}</Table.Cell>
              <Table.Cell>
                {r.awarded_stock}/{r.total_stock}
              </Table.Cell>
              <Table.Cell>
                <form onSubmit={(e) => add(r.id, e)}>
                  <Flex gap="2">
                    <TextField.Root
                      name="quantity"
                      type="number"
                      min="1"
                      placeholder="增加数量"
                    />
                    <Button type="submit">添加库存</Button>
                  </Flex>
                </form>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      {!started && (
        <Card>
          <form onSubmit={create}>
            <Flex gap="2">
              <TextField.Root
                name="name"
                placeholder="奖品名称"
                required
              />
              <TextField.Root
                name="stock"
                type="number"
                min="0"
                placeholder="初始库存"
                required
              />
              <TextField.Root
                name="weight"
                type="number"
                min="0.000001"
                step="any"
                placeholder="权重"
                required
              />
              <Button type="submit">新增奖项</Button>
            </Flex>
          </form>
        </Card>
      )}
      {message && <p>{message}</p>}
    </>
  );
}
