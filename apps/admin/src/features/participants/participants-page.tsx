import { Heading, Table } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
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
export function ParticipantsPage() {
  const { id } = useParams();
  const [rows, setRows] = useState<Participant[]>([]);
  useEffect(() => {
    api<Participant[]>(`admin/activities/${id}/participants`).then(setRows);
  }, [id]);
  return (
    <>
      <Heading>参与者与首次有效线索</Heading>
      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>姓名</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>手机号</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>留资状态</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>渠道</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>奖品/核销</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>参与时间</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell>{r.fields?.name || '—'}</Table.Cell>
              <Table.Cell>{r.fields?.phone || '—'}</Table.Cell>
              <Table.Cell>
                {r.lead_completed ? '已完成' : '等待回调'}
              </Table.Cell>
              <Table.Cell>{r.channel_code || 'direct'}</Table.Cell>
              <Table.Cell>
                {r.prize_name
                  ? `${r.prize_name} / ${r.redemption_status}`
                  : '—'}
              </Table.Cell>
              <Table.Cell>
                {new Date(r.created_at).toLocaleString('zh-CN', {
                  timeZone: 'Asia/Shanghai',
                })}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </>
  );
}
