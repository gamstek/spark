import { Card, Table } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { EmptyState } from '../../components/empty-state';
import { FeedbackCallout } from '../../components/feedback-callout';
import { LoadingState } from '../../components/loading-state';
import { StatusBadge } from '../../components/status-badge';

type Redemption = {
  id: string;
  prize_name: string;
  status: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Shanghai',
});

export function RedemptionsListPage() {
  const { id = '' } = useParams();
  const [rows, setRows] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api<Redemption[]>(`admin/activities/${id}/redemptions`)
      .then(setRows)
      .catch(() => setError('核销记录加载失败，请稍后重试。'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <>
      {error && (
        <FeedbackCallout
          message={error}
          tone="error"
        />
      )}
      {loading ? (
        <LoadingState label="正在加载核销记录" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无核销记录"
          description="参与者中奖后，相应凭证会显示在这里。"
        />
      ) : (
        <Card
          variant="classic"
          size="3"
        >
          <Table.Root variant="ghost">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>奖品</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>状态</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>核销人员</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>核销时间</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={row.id}>
                  <Table.RowHeaderCell>{row.prize_name}</Table.RowHeaderCell>
                  <Table.Cell>
                    <StatusBadge status={row.status} />
                  </Table.Cell>
                  <Table.Cell>{row.redeemed_by ?? '尚未核销'}</Table.Cell>
                  <Table.Cell>
                    {row.redeemed_at
                      ? dateTimeFormatter.format(new Date(row.redeemed_at))
                      : '—'}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Card>
      )}
    </>
  );
}
