import { Button, Flex, Heading, Table } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
type Activity = { id: string; code: string; name: string; published_version_id: string | null };
export function ActivitiesListPage() {
  const [rows, setRows] = useState<Activity[]>([]);
  useEffect(() => {
    api<Activity[]>('admin/activities')
      .then(setRows)
      .catch(() => undefined);
  }, []);
  return (
    <>
      <Flex justify="between" align="center">
        <Heading>活动管理</Heading>
        <Button asChild>
          <Link to="new">新建活动</Link>
        </Button>
      </Flex>
      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>活动</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>访问路径</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>状态</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((row) => (
            <Table.Row key={row.id}>
              <Table.Cell>{row.name}</Table.Cell>
              <Table.Cell>/activity/{row.code}</Table.Cell>
              <Table.Cell>{row.published_version_id ? '已发布' : '草稿'}</Table.Cell>
              <Table.Cell>
                <Link to={row.id}>编辑</Link>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </>
  );
}
