import { Button, Heading, Table } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { api } from '../../api';
type Job = { id: string; kind: string; attempts: number; lastError: string | null };
export function JobsPage() {
  const [rows, setRows] = useState<Job[]>([]);
  const load = () => api<Job[]>('admin/jobs/failed').then(setRows);
  useEffect(() => {
    void load();
  }, []);
  async function retry(id: string) {
    await api(`admin/jobs/${id}/retry`, { method: 'POST' });
    await load();
  }
  return (
    <>
      <Heading>失败任务</Heading>
      <Table.Root variant="surface">
        <Table.Body>
          {rows.map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell>{r.kind}</Table.Cell>
              <Table.Cell>{r.attempts} 次</Table.Cell>
              <Table.Cell>{r.lastError}</Table.Cell>
              <Table.Cell>
                <Button onClick={() => retry(r.id)}>重试</Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </>
  );
}
