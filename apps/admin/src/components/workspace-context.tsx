import {
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@radix-ui/react-icons';
import { Button, Text } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import {
  ActivityNav,
  activityContextEvent,
  type ActivityIdentity,
} from './activity-nav';
import { StatusBadge } from './status-badge';
import {
  failedJobsContextEvent,
  type FailedJobSummary,
} from './workspace-context-events';

type ContextActivity = ActivityIdentity & { id: string };
type ContextReport = { participants: number; pending: number; leads: number };

const jobLabels: Record<string, string> = {
  DINGTALK_CALLBACK: '钉钉表单回调',
  EXPORT: '线索导出',
  EXPIRE_REDEMPTION: '核销凭证过期',
};

function isRunning(activity: ContextActivity) {
  const now = Date.now();
  return Boolean(
    activity.published_version_id &&
    activity.starts_at &&
    Date.parse(activity.starts_at) <= now &&
    (!activity.ends_at || Date.parse(activity.ends_at) > now),
  );
}

export function WorkspaceContext({ pathname }: { pathname: string }) {
  const routeId = /^\/activities\/([^/]+)/.exec(pathname)?.[1];
  const activityId = routeId && routeId !== 'new' ? routeId : undefined;
  const [activity, setActivity] = useState<ContextActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState(false);
  const [report, setReport] = useState<ContextReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [jobs, setJobs] = useState<FailedJobSummary[] | null>(null);
  const [jobsLoading, setJobsLoading] = useState(true);

  useEffect(() => {
    let current = true;
    let updated = false;
    setActivity(null);
    setActivityLoading(true);
    setActivityError(false);
    function onUpdate(event: Event) {
      const detail = (
        event as CustomEvent<{ activityId: string; activity: ActivityIdentity }>
      ).detail;
      if (detail.activityId === activityId) {
        updated = true;
        setActivity({ ...detail.activity, id: detail.activityId });
        setActivityLoading(false);
      }
    }
    window.addEventListener(activityContextEvent, onUpdate);
    const request = activityId
      ? api<ContextActivity>(`admin/activities/${activityId}`).then(
          (detail) => ({ ...detail, id: activityId }),
        )
      : routeId === 'new'
        ? Promise.resolve(null)
        : api<ContextActivity[]>('admin/activities').then(
            (items) => items.find(isRunning) ?? null,
          );
    void request
      .then((detail) => {
        if (current && !updated) setActivity(detail);
      })
      .catch(() => {
        if (current && !updated) setActivityError(true);
      })
      .finally(() => {
        if (current) setActivityLoading(false);
      });
    return () => {
      current = false;
      window.removeEventListener(activityContextEvent, onUpdate);
    };
  }, [activityId, routeId]);

  const selectedId = activity?.id;
  useEffect(() => {
    let current = true;
    setReport(null);
    setReportLoading(Boolean(selectedId));
    if (selectedId) {
      void api<ContextReport>(`admin/activities/${selectedId}/report`)
        .then((data) => {
          if (current) setReport(data);
        })
        .catch(() => undefined)
        .finally(() => {
          if (current) setReportLoading(false);
        });
    }
    return () => {
      current = false;
    };
  }, [selectedId]);

  useEffect(() => {
    let current = true;
    let updated = false;
    function onUpdate(event: Event) {
      updated = true;
      setJobs((event as CustomEvent<FailedJobSummary[]>).detail);
      setJobsLoading(false);
    }
    window.addEventListener(failedJobsContextEvent, onUpdate);
    setJobs(null);
    setJobsLoading(true);
    void api<FailedJobSummary[]>('admin/jobs/failed')
      .then((data) => {
        if (current && !updated) setJobs(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (current) setJobsLoading(false);
      });
    return () => {
      current = false;
      window.removeEventListener(failedJobsContextEvent, onUpdate);
    };
  }, [pathname]);

  const title = pathname.startsWith('/staff')
    ? '现场协作'
    : pathname.startsWith('/jobs')
      ? '任务处理'
      : routeId === 'new'
        ? '创建活动'
        : '活动运营中心';

  return (
    <section
      className="workspace-context"
      aria-label="运营上下文"
    >
      <Text
        as="p"
        size="4"
        weight="medium"
        className="workspace-context__title"
      >
        {title}
      </Text>
      <Text
        as="p"
        size="2"
        className="workspace-context__description"
      >
        聚焦活动进展，及时处理现场运营任务。
      </Text>
      <section
        className="context-panel context-panel--activity"
        aria-label="当前活动"
      >
        <div className="context-panel__heading">
          <Text
            size="2"
            weight="medium"
          >
            当前活动
          </Text>
          {activity && (
            <Button
              asChild
              size="1"
              variant="ghost"
            >
              <Link to={`/activities/${activity.id}/report`}>
                查看数据 <ChevronRightIcon />
              </Link>
            </Button>
          )}
        </div>
        <div
          className="activity-context-identity"
          aria-busy={activityLoading}
        >
          {activity ? (
            <>
              <Text
                as="p"
                size="3"
                weight="medium"
                className="activity-context-name"
                title={activity.name}
              >
                {activity.name}
              </Text>
              <StatusBadge
                status={
                  isRunning(activity)
                    ? '进行中'
                    : activity.published_version_id
                      ? '已发布'
                      : '草稿'
                }
              />
              <Text
                as="p"
                size="1"
                className="activity-context-address"
                title={`/activity/${activity.code}`}
              >
                活动地址：/activity/{activity.code}
              </Text>
            </>
          ) : (
            <Text
              as="p"
              size="2"
              className="context-panel__muted"
            >
              {activityLoading
                ? '正在读取活动…'
                : activityError
                  ? '暂时无法读取当前活动'
                  : routeId === 'new'
                    ? '保存后可查看活动进展'
                    : '暂无进行中的活动'}
            </Text>
          )}
        </div>
        <div
          className="context-stats"
          aria-busy={reportLoading}
        >
          {activity && report
            ? (
                [
                  ['参与', report.participants],
                  ['待核销', report.pending],
                  ['有效线索', report.leads],
                ] as const
              ).map(([label, value]) => (
                <div
                  className="context-stat"
                  key={label}
                >
                  <strong>{value.toLocaleString('zh-CN')}</strong>
                  <span>{label}</span>
                </div>
              ))
            : activity && (
                <Text
                  size="1"
                  className="context-panel__muted"
                >
                  {reportLoading ? '正在读取活动数据…' : '暂时无法读取活动数据'}
                </Text>
              )}
        </div>
      </section>
      {activityId && <ActivityNav activityId={activityId} />}
      <section
        className="context-panel context-panel--tasks"
        aria-label="待处理"
      >
        <div className="context-panel__heading">
          <Text
            size="2"
            weight="medium"
          >
            待处理
          </Text>
          <Button
            asChild
            size="1"
            variant="ghost"
          >
            <Link to="/jobs">
              查看任务 <ChevronRightIcon />
            </Link>
          </Button>
        </div>
        <Text
          as="p"
          size="1"
          className="context-panel__muted context-task-summary"
        >
          {jobsLoading
            ? '正在读取失败任务…'
            : jobs === null
              ? '暂时无法读取失败任务'
              : jobs.length
                ? `最近 ${jobs.length} 项失败任务`
                : '当前没有失败任务'}
        </Text>
        {jobs?.slice(0, 3).map((job) => (
          <Link
            key={job.id}
            className="context-task"
            to="/jobs"
          >
            <ExclamationTriangleIcon aria-hidden="true" />
            <span>
              <span>检查{jobLabels[job.kind] ?? '后台任务'}</span>
              <small>已尝试 {job.attempts} 次，需检查原因</small>
            </span>
            <ChevronRightIcon aria-hidden="true" />
          </Link>
        ))}
      </section>
    </section>
  );
}
