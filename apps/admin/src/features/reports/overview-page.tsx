import { Card, Flex, Grid, Table, Text } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { EmptyState } from '../../components/empty-state';
import { FeedbackCallout } from '../../components/feedback-callout';
import { LoadingState } from '../../components/loading-state';

type Report = {
  visits: number;
  uniqueVisitors: number;
  participants: number;
  leads: number;
  subscribed: number;
  awarded: number;
  available: number;
  pending: number;
  redeemed: number;
  expired: number;
  channels: { code: string; visitors: number }[];
  prizes: { name: string; awarded: number; redeemed: number }[];
};

export function ReportsOverviewPage() {
  const { id = '' } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api<Report>(`admin/activities/${id}/report`)
      .then(setReport)
      .catch(() => setError('活动数据加载失败，请稍后重试。'))
      .finally(() => setLoading(false));
  }, [id]);

  const metrics = report
    ? ([
        ['页面访问', report.visits],
        ['访问人数', report.uniqueVisitors],
        ['参与人数', report.participants],
        ['有效线索', report.leads],
        ['已关注', report.subscribed],
        ['已中奖', report.awarded],
        ['可用库存', report.available],
        ['待核销', report.pending],
        ['已核销', report.redeemed],
        ['已过期', report.expired],
      ] as const)
    : [];

  return (
    <>
      {error && (
        <FeedbackCallout
          message={error}
          tone="error"
        />
      )}
      {loading ? (
        <LoadingState label="正在汇总活动数据" />
      ) : !report ? (
        <EmptyState
          title="暂无统计数据"
          description="活动产生访问和参与记录后，统计结果会显示在这里。"
        />
      ) : (
        <Flex
          direction="column"
          gap="5"
        >
          <Grid
            columns={{ initial: '2', md: '5' }}
            gap="3"
          >
            {metrics.map(([label, value]) => (
              <Card
                variant="classic"
                size="3"
                key={label}
                className="report-metric"
              >
                <Flex
                  direction="column"
                  gap="1"
                >
                  <Text
                    size="2"
                    color="gray"
                  >
                    {label}
                  </Text>
                  <Text
                    className="metric"
                    size="7"
                    weight="bold"
                    highContrast
                  >
                    {value.toLocaleString('zh-CN')}
                  </Text>
                </Flex>
              </Card>
            ))}
          </Grid>

          <Grid
            columns={{ initial: '1', lg: '2' }}
            gap="4"
          >
            <Card
              variant="classic"
              size="3"
            >
              <Flex
                direction="column"
                gap="3"
              >
                <Text
                  size="4"
                  weight="bold"
                >
                  渠道访问
                </Text>
                {report.channels.length === 0 ? (
                  <Text color="gray">暂无渠道访问数据</Text>
                ) : (
                  <Table.Root className="report-table">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>渠道</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell justify="end">
                          访问人数
                        </Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {report.channels.map((channel) => (
                        <Table.Row key={channel.code}>
                          <Table.RowHeaderCell>
                            {channel.code || '直接访问'}
                          </Table.RowHeaderCell>
                          <Table.Cell justify="end">
                            {channel.visitors.toLocaleString('zh-CN')}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Flex>
            </Card>

            <Card
              variant="classic"
              size="3"
            >
              <Flex
                direction="column"
                gap="3"
              >
                <Text
                  size="4"
                  weight="bold"
                >
                  奖品表现
                </Text>
                {report.prizes.length === 0 ? (
                  <Text color="gray">暂无中奖数据</Text>
                ) : (
                  <Table.Root className="report-table">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>奖品</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell justify="end">
                          中奖
                        </Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell justify="end">
                          核销
                        </Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {report.prizes.map((prize) => (
                        <Table.Row key={prize.name}>
                          <Table.RowHeaderCell>
                            {prize.name}
                          </Table.RowHeaderCell>
                          <Table.Cell justify="end">{prize.awarded}</Table.Cell>
                          <Table.Cell justify="end">
                            {prize.redeemed}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                )}
              </Flex>
            </Card>
          </Grid>
        </Flex>
      )}
    </>
  );
}
