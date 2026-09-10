import {
  PlusIcon,
  MagnifyingGlassIcon,
  Cross2Icon,
  MixerHorizontalIcon,
} from '@radix-ui/react-icons';
import {
  Avatar,
  Button,
  DropdownMenu,
  Heading,
  IconButton,
  Select,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { api } from '../../api';
import { EmptyState, LoadingState } from '../../components/feedback';
import { GhostTable, GhostTableFooter } from '../../components/ghost-table';
import { PageHeader } from '../../components/page-header';
import { StatusBadge } from '../../components/status-badge';
import { TableRowActions } from '../../components/table-row-actions';

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
  const searchInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const statuses = ['草稿', '未开始', '进行中', '已结束'];
  const status = statuses.includes(params.get('status') ?? '')
    ? params.get('status')!
    : 'all';
  const filtered = rows.filter(
    (row) =>
      `${row.name} ${row.code}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (status === 'all' || statusOf(row) === status),
  );
  function updateFilter(key: string, value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (!value || (key === 'status' && value === 'all')) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    api<Activity[]>('admin/activities')
      .then(setRows)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="让每一场活动，都井然有序"
        description="查看活动状态，继续配置或追踪运营表现。"
        actions={
          <Button
            variant={
              !loading && !failed && rows.length === 0 ? 'ghost' : 'solid'
            }
            asChild
            size="2"
          >
            <Link to="new">
              <PlusIcon />
              新建活动
            </Link>
          </Button>
        }
      />

      {!loading && !failed && (
        <div className="activity-metrics">
          {[
            {
              label: '全部活动',
              value: rows.length,
              note: '全部已创建活动',
            },
            {
              label: '进行中',
              value: rows.filter((row) => statusOf(row) === '进行中').length,
              note: '已发布并开放参与',
            },
            {
              label: '草稿',
              value: rows.filter((row) => statusOf(row) === '草稿').length,
              note: '配置完成后即可发布',
            },
            {
              label: '已结束',
              value: rows.filter((row) => statusOf(row) === '已结束').length,
              note: '可继续查看运营记录',
            },
          ].map((metric) => (
            <div
              className="activity-metric"
              key={metric.label}
            >
              <div className="activity-metric-label">
                <span>{metric.label}</span>
              </div>
              <strong>{metric.value}</strong>
              <p>{metric.note}</p>
            </div>
          ))}
        </div>
      )}

      <section
        className="activity-collection"
        aria-label="活动列表"
      >
        {!loading && !failed && rows.length > 0 && (
          <div className="list-toolbar">
            <div className="activity-collection-copy">
              <Heading
                as="h2"
                size="4"
              >
                全部活动
              </Heading>
              <Text
                as="p"
                size="1"
                className="collection-description"
                color="gray"
              >
                共 {rows.length} 场活动，集中管理配置与运营记录。
              </Text>
            </div>
            <div className="activity-collection-tools">
              <TextField.Root
                ref={searchInput}
                variant="soft"
                color="gray"
                aria-label="搜索活动"
                placeholder="搜索活动名称或访问路径…"
                value={query}
                onChange={(event) => updateFilter('q', event.target.value)}
                className="activity-search"
                size="2"
              >
                <TextField.Slot>
                  <MagnifyingGlassIcon />
                </TextField.Slot>
                {query && (
                  <TextField.Slot>
                    <IconButton
                      variant="ghost"
                      color="gray"
                      aria-label="清除搜索"
                      onClick={() => {
                        updateFilter('q', '');
                        searchInput.current?.focus();
                      }}
                    >
                      <Cross2Icon />
                    </IconButton>
                  </TextField.Slot>
                )}
              </TextField.Root>
              <Select.Root
                value={status}
                onValueChange={(value) => updateFilter('status', value)}
                size="2"
              >
                <Select.Trigger
                  variant="ghost"
                  color="gray"
                  aria-label="活动状态"
                  className="status-filter"
                >
                  <MixerHorizontalIcon />
                  <span>{status === 'all' ? '全部状态' : status}</span>
                </Select.Trigger>
                <Select.Content
                  position="popper"
                  className="activity-filter-popup"
                >
                  <Select.Item value="all">全部状态</Select.Item>
                  {statuses.map((value) => (
                    <Select.Item
                      key={value}
                      value={value}
                    >
                      {value}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingState label="正在加载活动" />
        ) : failed ? (
          <EmptyState
            title="活动加载失败"
            description="请检查网络连接后刷新页面。"
          />
        ) : rows.length === 0 ? (
          <section className="activity-onboarding">
            <div className="onboarding-intro">
              <span
                className="onboarding-symbol"
                aria-hidden="true"
              >
                <PlusIcon
                  width="28"
                  height="28"
                />
              </span>
              <h2>还没有活动</h2>
              <p>
                把下一场活动，安排在这里。
                <br />
                从展会抽奖模板开始，逐步完成配置与发布。
              </p>
              <Button
                variant="solid"
                asChild
              >
                <Link to="new">创建第一个活动</Link>
              </Button>
            </div>
            <ol className="onboarding-guide">
              <li>
                <span>1</span>
                <div>
                  <h3>准备活动内容</h3>
                  <p>填写基本信息、参与规则和活动时间。</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <h3>设置奖品与库存</h3>
                  <p>配置奖项、库存数量和抽奖权重。</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <h3>发布，迎接参与</h3>
                  <p>确认配置后发布，集中查看线索与核销结果。</p>
                </div>
              </li>
            </ol>
          </section>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="没有找到匹配的活动"
            description="试试其他名称，或清除筛选查看全部活动。"
            action={
              <Button
                variant="ghost"
                onClick={() => setParams({})}
              >
                清除筛选
              </Button>
            }
          />
        ) : (
          <div className="table-panel">
            <GhostTable className="activity-table">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>活动</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>访问路径</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>状态</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>活动时间</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell justify="end">
                    操作
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filtered.map((row) => (
                  <Table.Row
                    key={row.id}
                    align="center"
                  >
                    <Table.RowHeaderCell>
                      <div className="activity-name">
                        <Avatar
                          size="2"
                          variant="soft"
                          fallback={row.name.slice(0, 1)}
                          aria-hidden="true"
                        />
                        <Text
                          as="div"
                          weight="medium"
                          className="activity-name-copy"
                          title={row.name}
                        >
                          {row.name}
                        </Text>
                      </div>
                    </Table.RowHeaderCell>
                    <Table.Cell>
                      <Text
                        as="div"
                        size="1"
                        className="activity-path"
                        title={`/activity/${row.code}`}
                      >
                        /activity/{row.code}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge status={statusOf(row)} />
                    </Table.Cell>
                    <Table.Cell>
                      <Text
                        size="2"
                        color="gray"
                      >
                        {formatDate(row.starts_at)} – {formatDate(row.ends_at)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell justify="end">
                      <TableRowActions label={`活动操作：${row.name}`}>
                        <DropdownMenu.Item asChild>
                          <Link to={row.id}>管理</Link>
                        </DropdownMenu.Item>
                      </TableRowActions>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </GhostTable>
            <GhostTableFooter
              range={`显示 ${filtered.length} 场活动 · 共 ${rows.length} 场`}
            >
              <Text size="1">时间以北京时间为准</Text>
            </GhostTableFooter>
          </div>
        )}
      </section>
    </>
  );
}
