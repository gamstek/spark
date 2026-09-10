import {
  Button,
  DropdownMenu,
  Flex,
  Heading,
  Table,
  Text,
} from '@radix-ui/themes';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { FeedbackCallout } from '../../components/feedback-callout';
import { GhostTable, GhostTableFooter } from '../../components/ghost-table';
import { StatusBadge } from '../../components/status-badge';
import { TableRowActions } from '../../components/table-row-actions';

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
      <Flex
        justify="between"
        align="start"
        gap="4"
        wrap="wrap"
      >
        <div className="export-description">
          <Heading
            as="h2"
            size="4"
          >
            导出说明
          </Heading>
          <Text
            as="p"
            size="2"
            color="gray"
          >
            文件包含任务创建时的数据快照，并会在生成 24 小时后自动过期。
          </Text>
        </div>
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

      {view ? (
        <div className="table-panel">
          <GhostTable>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>导出任务</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>状态</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>记录数</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">
                  操作
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              <Table.Row align="center">
                <Table.RowHeaderCell>活动线索 XLSX</Table.RowHeaderCell>
                <Table.Cell>
                  <StatusBadge status={view.status} />
                </Table.Cell>
                <Table.Cell className="is-numeric">
                  {view.rowCount === null
                    ? '记录数将在生成后显示'
                    : `共 ${view.rowCount.toLocaleString('zh-CN')} 条记录`}
                </Table.Cell>
                <Table.Cell justify="end">
                  <TableRowActions
                    label={`导出操作：${view.id}`}
                    loading={busy}
                  >
                    <DropdownMenu.Item
                      onSelect={() => void refresh()}
                      disabled={busy}
                    >
                      刷新状态
                    </DropdownMenu.Item>
                    {view.downloadUrl && (
                      <DropdownMenu.Item asChild>
                        <a href={view.downloadUrl}>下载文件</a>
                      </DropdownMenu.Item>
                    )}
                  </TableRowActions>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </GhostTable>
          <GhostTableFooter range="本页最近创建的 1 个任务" />
        </div>
      ) : (
        <Text
          as="p"
          size="2"
          color="gray"
          className="export-empty"
        >
          本页尚未创建导出任务。
        </Text>
      )}
    </>
  );
}
