import { Button, Card, Flex, Table, Text } from '@radix-ui/themes';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { EmptyState } from '../../components/empty-state';
import { FeedbackCallout } from '../../components/feedback-callout';
import { LoadingState } from '../../components/loading-state';
import { PageHeader } from '../../components/page-header';
import { StatusBadge } from '../../components/status-badge';

type Job = {
  id: string;
  kind: string;
  attempts: number;
  lastError: string | null;
};

const jobLabels: Record<string, string> = {
  DINGTALK_CALLBACK: '钉钉表单回调',
  EXPORT: '线索导出',
  EXPIRE_REDEMPTION: '核销凭证过期',
};

export function JobsPage() {
  const [rows, setRows] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await api<Job[]>('admin/jobs/failed'));
    } catch {
      setError('失败任务加载失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(job: Job) {
    setRetryingId(job.id);
    setError('');
    setMessage('');
    try {
      await api(`admin/jobs/${job.id}/retry`, { method: 'POST' });
      setMessage('任务已重新进入处理队列。');
      await load();
    } catch {
      setError('任务重试失败，请检查服务状态后再次操作。');
    } finally {
      setRetryingId('');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="系统维护"
        title="失败任务"
        description="查看多次执行失败的后台任务，并在问题排除后重新处理。"
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
      {loading ? (
        <LoadingState label="正在加载失败任务" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="没有失败任务"
          description="后台任务运行正常，无需人工处理。"
        />
      ) : (
        <Card>
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>任务</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>状态</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>最近错误</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">
                  操作
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((job) => (
                <Table.Row key={job.id}>
                  <Table.RowHeaderCell>
                    <Flex
                      direction="column"
                      gap="1"
                    >
                      <Text weight="bold">
                        {jobLabels[job.kind] ?? job.kind}
                      </Text>
                      <Text
                        size="1"
                        color="gray"
                      >
                        {job.id}
                      </Text>
                    </Flex>
                  </Table.RowHeaderCell>
                  <Table.Cell>
                    <StatusBadge status="FAILED">
                      已失败 {job.attempts} 次
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text
                      size="2"
                      color={job.lastError ? undefined : 'gray'}
                    >
                      {job.lastError || '未记录错误详情'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell justify="end">
                    <Button
                      variant="soft"
                      onClick={() => retry(job)}
                      loading={retryingId === job.id}
                    >
                      重新处理
                    </Button>
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
