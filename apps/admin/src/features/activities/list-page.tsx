import { ArrowRightIcon, PlusIcon } from '@radix-ui/react-icons';
import { Button, Code, Table, Text } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../../api';
import { EmptyState, LoadingState } from '../../components/feedback';
import { PageHeader } from '../../components/page-header';
import { StatusBadge } from '../../components/status-badge';

type Activity = {
  id: string;
  code: string;
  name: string;
  published_version_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

function statusOf(activity: Activity): string {
  if (!activity.published_version_id) return '草稿';
  const now = Date.now();
  if (activity.starts_at && now < new Date(activity.starts_at).getTime())
    return '未开始';
  if (activity.ends_at && now >= new Date(activity.ends_at).getTime())
    return '已结束';
  return '进行中';
}

function formatDate(value: string | null): string {
  if (!value) return '未设置';
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivitiesListPage() {
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<Activity[]>('admin/activities')
      .then(setRows)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="活动运营"
        title="活动管理"
        description="创建活动、确认发布状态，并进入各活动的运营工作区。"
        actions={
          <Button
            asChild
            size="3"
          >
            <Link to="new">
              <PlusIcon />
              新建活动
            </Link>
          </Button>
        }
      />

      {loading ? (
        <LoadingState label="正在加载活动" />
      ) : failed ? (
        <EmptyState
          title="活动加载失败"
          description="请检查网络连接后刷新页面。"
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="还没有活动"
          description="从展会抽奖模板开始配置第一场活动。"
          action={
            <Button asChild>
              <Link to="new">创建第一个活动</Link>
            </Button>
          }
        />
      ) : (
        <div className="table-panel">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>活动</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>访问路径</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>活动时间</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>状态</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell justify="end">
                  操作
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row
                  key={row.id}
                  align="center"
                >
                  <Table.RowHeaderCell>
                    <Text weight="medium">{row.name}</Text>
                  </Table.RowHeaderCell>
                  <Table.Cell>
                    <Code variant="ghost">/activity/{row.code}</Code>
                  </Table.Cell>
                  <Table.Cell>
                    <Text
                      size="2"
                      color="gray"
                    >
                      {formatDate(row.starts_at)} – {formatDate(row.ends_at)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={statusOf(row)} />
                  </Table.Cell>
                  <Table.Cell justify="end">
                    <Button
                      asChild
                      variant="ghost"
                    >
                      <Link to={row.id}>
                        管理
                        <ArrowRightIcon />
                      </Link>
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </div>
      )}
    </>
  );
}
