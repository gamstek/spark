import { Button, Card, Flex, Text } from '@radix-ui/themes';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { FeedbackCallout } from '../../components/feedback-callout';
import { StatusBadge } from '../../components/status-badge';

type ExportView = {
  id: string;
  status: string;
  downloadUrl: string | null;
  rowCount: number | null;
};

export function ExportsPage() {
  const { id = '' } = useParams();
  const [view, setView] = useState<ExportView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function create() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const created = await api<{ jobId: string }>(
        `admin/activities/${id}/exports`,
        { method: 'POST' },
      );
      setView({
        id: created.jobId,
        status: 'PENDING',
        downloadUrl: null,
        rowCount: null,
      });
      setMessage('导出任务已创建，生成完成后即可下载。');
    } catch {
      setError('导出任务创建失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (!view) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await api<ExportView>(`admin/exports/${view.id}`);
      setView(next);
      setMessage(
        next.downloadUrl ? '文件已生成，可以下载。' : '任务仍在处理中。',
      );
    } catch {
      setError('导出状态刷新失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Flex justify="end">
        <Button
          variant="solid"
          onClick={create}
          loading={busy && !view}
        >
          生成 XLSX
        </Button>
      </Flex>

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

      <Card
        variant="classic"
        size="3"
      >
        <Flex
          direction="column"
          gap="4"
        >
          <Flex
            direction="column"
            gap="1"
          >
            <Text weight="bold">导出说明</Text>
            <Text
              size="2"
              color="gray"
            >
              文件包含任务创建时的数据快照，并会在生成 24 小时后自动过期。
            </Text>
          </Flex>

          {view ? (
            <Flex
              align="center"
              justify="between"
              gap="3"
              wrap="wrap"
            >
              <Flex
                align="center"
                gap="3"
                wrap="wrap"
              >
                <StatusBadge status={view.status} />
                <Text
                  size="2"
                  color="gray"
                >
                  {view.rowCount === null
                    ? '记录数将在生成后显示'
                    : `共 ${view.rowCount.toLocaleString('zh-CN')} 条记录`}
                </Text>
              </Flex>
              <Flex gap="2">
                <Button
                  variant="soft"
                  color="gray"
                  onClick={refresh}
                  loading={busy}
                >
                  刷新状态
                </Button>
                {view.downloadUrl && (
                  <Button
                    variant="solid"
                    asChild
                  >
                    <a href={view.downloadUrl}>下载文件</a>
                  </Button>
                )}
              </Flex>
            </Flex>
          ) : (
            <Text
              size="2"
              color="gray"
            >
              本页尚未创建导出任务。
            </Text>
          )}
        </Flex>
      </Card>
    </>
  );
}
