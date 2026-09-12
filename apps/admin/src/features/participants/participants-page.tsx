import { Button, DropdownMenu, Table } from '@radix-ui/themes';
import type { ActivityFormAnswers } from '@spark/contracts';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { EmptyState } from '../../components/empty-state';
import { FeedbackCallout } from '../../components/feedback-callout';
import { LoadingState } from '../../components/loading-state';
import { GhostTable, GhostTableFooter } from '../../components/ghost-table';
import { StatusBadge } from '../../components/status-badge';
import { TableRowActions } from '../../components/table-row-actions';
import { ParticipantDetailDialog } from './participant-detail-dialog';

type Participant = {
  id: string;
  lead_completed: boolean;
  lead_completed_at: string | null;
  answers: ActivityFormAnswers | null;
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
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Participant | null>(null);
  const rowReturnFocusRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setRows([]);
    setSelected(null);
    api<Participant[]>(`admin/activities/${id}/participants`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setRows(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('参与者数据加载失败，请稍后重试。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, attempt]);

  return (
    <>
      {error ? (
        <div
          className="participants-recovery"
          role="alert"
        >
          <FeedbackCallout
            message={error}
            tone="error"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAttempt((value) => value + 1)}
          >
            重试
          </Button>
        </div>
      ) : loading ? (
        <LoadingState label="正在加载参与者" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无参与者"
          description="活动产生参与记录后，参与者信息会显示在这里。"
        />
      ) : (
        <div className="table-panel">
          <GhostTable>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>姓名</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>单位</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>手机号码</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>线索状态</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>渠道</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>奖品</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>核销状态</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>参与时间</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">
                  操作
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={row.id}>
                  <Table.RowHeaderCell>
                    {row.answers?.name || '未填写'}
                  </Table.RowHeaderCell>
                  <Table.Cell>
                    {row.answers?.organization || '未填写'}
                  </Table.Cell>
                  <Table.Cell>{row.answers?.phone || '未填写'}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge
                      status={row.lead_completed ? 'COMPLETED' : 'PENDING'}
                    >
                      {row.lead_completed ? '已完成' : '待填写'}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>{row.channel_code || '直接访问'}</Table.Cell>
                  <Table.Cell>{row.prize_name || '未中奖'}</Table.Cell>
                  <Table.Cell>
                    {row.redemption_status ? (
                      <StatusBadge status={row.redemption_status} />
                    ) : (
                      '—'
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {dateTimeFormatter.format(new Date(row.created_at))}
                  </Table.Cell>
                  <Table.Cell justify="end">
                    {row.answers ? (
                      <TableRowActions
                        label={`参与者操作：${row.answers.name}`}
                        onOpen={(trigger) => {
                          rowReturnFocusRef.current = trigger;
                        }}
                        onCloseAutoFocus={(event) => {
                          if (selected) event.preventDefault();
                        }}
                      >
                        <DropdownMenu.Item onSelect={() => setSelected(row)}>
                          查看登记详情
                        </DropdownMenu.Item>
                      </TableRowActions>
                    ) : (
                      '暂无登记详情'
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </GhostTable>
          <GhostTableFooter
            range={`共 ${rows.length.toLocaleString('zh-CN')} 位参与者`}
          />
        </div>
      )}
      <ParticipantDetailDialog
        open={Boolean(selected)}
        answers={selected?.answers ?? null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          rowReturnFocusRef.current?.focus();
        }}
      />
    </>
  );
}
