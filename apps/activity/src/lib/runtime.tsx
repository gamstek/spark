import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RuntimeStep } from '@spark/contracts';
import { useLocation, useNavigate } from 'react-router-dom';

import { activityApi, ApiError } from './api';
import { activityPath, activityViewFromPath } from './activity-route';
import {
  ActivityRuntimeContext,
  type ActivityDisplay,
  type ActivityRuntimeValue,
  type ActivityView,
} from './runtime-context';
import { bootstrapActivitySession } from './session-bootstrap';

const NETWORK_ERROR_MESSAGE = '网络异常，请稍后重试';

const ERROR_MESSAGES: Record<string, string> = {
  ACTIVITY_NOT_FOUND: '活动不存在',
  ACTIVITY_ENDED: '活动已结束',
  SUBSCRIPTION_REQUIRED: '请先关注公众号',
  LEAD_REQUIRED: '请先填写活动信息',
  OUT_OF_STOCK: '奖品已抽完',
  NOT_QUALIFIED: '暂不具备参与条件',
};

function messageForError(error: unknown): string {
  if (error instanceof ApiError)
    return ERROR_MESSAGES[error.code] ?? '操作失败，请稍后重试';
  return NETWORK_ERROR_MESSAGE;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

const EMPTY_ACTIVITY: ActivityDisplay = {
  code: '',
  title: '',
  startsAt: '',
  endsAt: '',
  dates: '',
  organizer: '',
  rulesText: '',
  noPrizeWeight: 0,
  prizes: [],
};

export function ActivityRuntimeProvider({
  code,
  simulateDevelopmentSession = false,
  children,
}: {
  code: string;
  simulateDevelopmentSession?: boolean;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const view = activityViewFromPath(location.pathname);
  const [message, setMessage] = useState<string | null>(null);
  const [stepOverride, setStepOverride] = useState<RuntimeStep | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [sessionBootstrapError, setSessionBootstrapError] = useState<
    string | null
  >(null);
  const bootstrappingSessionRef = useRef(false);

  const runtimeQuery = useQuery({
    queryKey: ['activity-runtime', code],
    queryFn: () => activityApi.runtime(code),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const infoQuery = useQuery({
    queryKey: ['activity-info', code],
    queryFn: () => activityApi.info(code),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const refetchRuntime = runtimeQuery.refetch;
  const refetchInfo = infoQuery.refetch;

  useEffect(() => {
    if (
      sessionBootstrapError ||
      (!isUnauthorized(runtimeQuery.error) &&
        !isUnauthorized(infoQuery.error)) ||
      bootstrappingSessionRef.current
    ) {
      return;
    }

    bootstrappingSessionRef.current = true;
    void bootstrapActivitySession({
      simulateDevelopmentSession,
      createDevelopmentSession: activityApi.createDevelopmentSession,
      createSession: () =>
        activityApi.bootstrapSession(
          code,
          `${window.location.pathname}${window.location.search}`,
        ),
      refresh: async () => {
        // A no-data query still in flight would otherwise be reused by refetch.
        await Promise.all([
          queryClient.cancelQueries({
            queryKey: ['activity-runtime', code],
            exact: true,
          }),
          queryClient.cancelQueries({
            queryKey: ['activity-info', code],
            exact: true,
          }),
        ]);
        await Promise.all([
          refetchRuntime({ throwOnError: true }),
          refetchInfo({ throwOnError: true }),
        ]);
      },
      redirect: (url) => window.location.assign(url),
    })
      .catch((error: unknown) => {
        setSessionBootstrapError(messageForError(error));
      })
      .finally(() => {
        bootstrappingSessionRef.current = false;
      });
  }, [
    code,
    infoQuery.error,
    queryClient,
    refetchInfo,
    refetchRuntime,
    runtimeQuery.error,
    sessionBootstrapError,
    simulateDevelopmentSession,
  ]);

  useEffect(() => {
    if (
      runtimeQuery.data &&
      infoQuery.data &&
      !runtimeQuery.error &&
      !infoQuery.error
    ) {
      setStepOverride(null);
      setSessionBootstrapError(null);
    }
  }, [infoQuery.data, infoQuery.error, runtimeQuery.data, runtimeQuery.error]);

  const runtime = runtimeQuery.data ?? null;
  const info = infoQuery.data ?? null;
  const activity = useMemo<ActivityDisplay>(() => {
    if (!info) return EMPTY_ACTIVITY;
    return {
      code: info.code,
      title: info.name,
      startsAt: info.startsAt,
      endsAt: info.endsAt,
      dates: `${formatDate(info.startsAt)} - ${formatDate(info.endsAt)}`,
      organizer: '',
      rulesText: info.rulesText,
      noPrizeWeight: info.noPrizeWeight,
      prizes: info.prizes.map((prize) => ({
        prizeLevel: prize.prizeLevel,
        name: prize.name,
        imageUrl: prize.imageUrl ?? undefined,
      })),
    };
  }, [info]);

  const step = stepOverride ?? runtime?.nextStep ?? 'NOT_STARTED';
  const win = runtime?.win ?? null;
  const prizeCodeQuery = useQuery({
    queryKey: ['activity-prize-code', code],
    queryFn: () => activityApi.prizeCode(code),
    enabled: win?.redemptionStatus === 'WAIT_REDEEM',
    retry: false,
    refetchOnWindowFocus: false,
  });

  const refreshRuntime = useCallback(async () => {
    const data = await queryClient.fetchQuery({
      queryKey: ['activity-runtime', code],
      queryFn: () => activityApi.runtime(code),
      staleTime: 0,
    });
    queryClient.setQueryData(['activity-runtime', code], data);
    return data;
  }, [code, queryClient]);

  const openView = useCallback(
    (nextView: ActivityView) => navigate(activityPath(code, nextView)),
    [code, navigate],
  );

  const closeView = useCallback(() => navigate(-1), [navigate]);

  const participate = useCallback(async () => {
    try {
      setMessage(null);
      const data = await refreshRuntime();
      if (data.nextStep === 'NOT_STARTED')
        setMessage('活动尚未开始，请稍后再来');
      else openView('flow');
    } catch (error) {
      setMessage(messageForError(error));
    }
  }, [openView, refreshRuntime]);

  const verifySubscribe = useCallback(async () => {
    try {
      setMessage(null);
      const data = await refreshRuntime();
      if (data.nextStep === 'SUBSCRIBE')
        setMessage('尚未检测到关注，请完成关注后重试');
    } catch (error) {
      setMessage(messageForError(error));
    }
  }, [refreshRuntime]);

  const startForm = useCallback(async () => {
    try {
      setMessage(null);
      const { url } = await activityApi.formLink(code);
      window.location.href = url;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'FORM_NOT_AVAILABLE') {
        await refreshRuntime().catch(() => undefined);
        return;
      }
      setMessage(messageForError(error));
    }
  }, [code, refreshRuntime]);

  const draw = useCallback(async () => {
    const csrfToken = runtime?.csrfToken;
    if (!csrfToken) {
      setMessage('会话已失效，请刷新页面重试');
      return;
    }
    setDrawing(true);
    try {
      setMessage(null);
      await activityApi.draw(code, csrfToken);
      await refreshRuntime();
      await queryClient.invalidateQueries({
        queryKey: ['activity-prize-code', code],
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'OUT_OF_STOCK') setStepOverride('OUT_OF_STOCK');
        else if (error.code === 'SUBSCRIPTION_REQUIRED')
          setStepOverride('SUBSCRIBE');
        else if (error.code === 'LEAD_REQUIRED') setStepOverride('FORM');
        else if (error.code === 'ACTIVITY_ENDED')
          await refreshRuntime().catch(() => undefined);
        else setMessage(messageForError(error));
      } else {
        setMessage(messageForError(error));
      }
    } finally {
      setDrawing(false);
    }
  }, [code, queryClient, refreshRuntime, runtime?.csrfToken]);

  const showPrize = useCallback(() => {
    if (win) openView('prizes');
  }, [openView, win]);

  const showMyPrizes = useCallback(() => {
    if (win) showPrize();
    else setMessage('暂无奖品，先去参与活动吧');
  }, [showPrize, win]);

  const initialError = runtimeQuery.error ?? infoQuery.error;
  const awaitingSessionBootstrap =
    !sessionBootstrapError &&
    (isUnauthorized(runtimeQuery.error) || isUnauthorized(infoQuery.error));
  const loading =
    runtimeQuery.isPending || infoQuery.isPending || awaitingSessionBootstrap;
  const loadError =
    sessionBootstrapError ??
    (initialError && !awaitingSessionBootstrap
      ? messageForError(initialError)
      : null);

  const value = useMemo<ActivityRuntimeValue>(
    () => ({
      step,
      view,
      loading,
      loadError,
      activity,
      win,
      prizeCode: prizeCodeQuery.data ?? null,
      message,
      drawing,
      openView,
      closeView,
      participate,
      verifySubscribe,
      startForm,
      draw,
      showPrize,
      showMyPrizes,
      setMessage,
    }),
    [
      step,
      view,
      loading,
      loadError,
      activity,
      win,
      prizeCodeQuery.data,
      message,
      drawing,
      openView,
      closeView,
      participate,
      verifySubscribe,
      startForm,
      draw,
      showPrize,
      showMyPrizes,
    ],
  );

  return (
    <ActivityRuntimeContext.Provider value={value}>
      {children}
    </ActivityRuntimeContext.Provider>
  );
}
