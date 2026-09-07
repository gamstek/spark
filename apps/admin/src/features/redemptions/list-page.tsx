import { Heading, Table } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';

type Row = {
  id: string;
  prize_name: string;
  status: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
};

export function RedemptionsListPage() {
  const { id } = useParams();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api<Row[]>(`admin/activities/${id}/redemptions`).then(setRows);
  }, [id]);

  return (
    <>
      <Heading>核销列表</Heading>
      <Table.Root variant="surface">
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
              <Table.Cell>{row.prize_name}</Table.Cell>
              <Table.Cell>{row.status}</Table.Cell>
              <Table.Cell>{row.redeemed_by ?? '—'}</Table.Cell>
              <Table.Cell>{row.redeemed_at ?? '—'}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </>
  );
}
