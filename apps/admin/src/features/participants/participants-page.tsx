import { Card, Table, Text } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { ActivityNav } from '../../components/activity-nav';
import { EmptyState } from '../../components/empty-state';
import { FeedbackCallout } from '../../components/feedback-callout';
import { LoadingState } from '../../components/loading-state';
import { PageHeader } from '../../components/page-header';
import { StatusBadge } from '../../components/status-badge';

type Participant = {
  id: string;
  lead_completed: boolean;
  lead_completed_at: string | null;
  fields: { name?: string; phone?: string } | null;
  created_at: string;
  channel_code: string | null;
  prize_name: string | null;
  redemption_status: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Shanghai',
});

export function ParticipantsPage() {
  const { id = '' } = useParams();
  const [rows, setRows] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api<Participant[]>(`admin/activities/${id}/participants`)
      .then(setRows)
      .catch(() => setError('参与者数据加载失败，请稍后重试。'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <>
      <PageHeader
        eyebrow="活动运营"
        title="参与者"
        description="查看参与记录、首次有效线索和中奖核销状态。"
      />
      <ActivityNav activityId={id} />

      {error && (
        <FeedbackCallout
          message={error}
          tone="error"
        />
      )}
      {loading ? (
        <LoadingState label="正在加载参与者" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无参与者"
          description="活动产生参与记录后，参与者信息会显示在这里。"
        />
      ) : (
        <Card
          variant="classic"
          size="3"
        >
          <Table.Root variant="ghost">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>参与者</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>手机号码</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>线索状态</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>渠道</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>奖品与核销</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>参与时间</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={row.id}>
                  <Table.RowHeaderCell>
                    {row.fields?.name || '未填写'}
                  </Table.RowHeaderCell>
                  <Table.Cell>{row.fields?.phone || '未填写'}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge
                      status={row.lead_completed ? 'COMPLETED' : 'PENDING'}
                    >
                      {row.lead_completed ? '已完成' : '等待回调'}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>{row.channel_code || '直接访问'}</Table.Cell>
                  <Table.Cell>
                    {row.prize_name ? (
                      <>
                        <Text
                          as="div"
                          weight="medium"
                        >
                          {row.prize_name}
                        </Text>
                        {row.redemption_status && (
                          <StatusBadge status={row.redemption_status} />
                        )}
                      </>
                    ) : (
                      '未中奖'
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {dateTimeFormatter.format(new Date(row.created_at))}
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
