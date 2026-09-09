import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RuntimeStep, WinView } from '@spark/contracts';

import { activityApi, ApiError } from './api';
import { ACTIVITY } from './activity';
import { WIN } from './redemption';
import { LOTTERY_PRIZES, type PrizeItem } from './prizes';
import { TRANSITIONS } from './runtime-steps';

/** 正交视图：非状态机但需要独立预览的屏 */
export type DemoView = 'main' | 'info' | 'redeemed-success' | 'follow-success';

/** 页面展示用的活动信息（真实模式来自 /activity/:code/info，demo 模式用静态数据） */
export interface ActivityDisplay {
  code: string;
  title: string;
  slug: string;
  dates: string;
  organizer: string;
  rulesText: string;
  prizes: PrizeItem[];
}

export interface PrizeCodeView {
  code: string;
  qrUrl: string;
}

interface ActivityRuntimeValue {
  step: RuntimeStep;
  view: DemoView;
  /** DEV 下无微信会话时的静态预览模式 */
  demo: boolean;
  loading: boolean;
  activity: ActivityDisplay;
  win: WinView | null;
  prizeCode: PrizeCodeView | null;
  message: string | null;
  drawing: boolean;
  /** demo 预览模式的步骤切换（真实模式由服务端状态机驱动） */
  go: (next: RuntimeStep, opts?: { free?: boolean }) => void;
  openView: (view: DemoView) => void;
  closeView: () => void;
  reset: () => void;
  /** 首页「立即参与」：刷新运行时，由服务端决定下一步 */
  participate: () => Promise<void>;
  /** 关注页「我已关注」：重新校验关注状态 */
  verifySubscribe: () => Promise<void>;
  /** 获取钉钉表单外链并跳转 */
  startForm: () => Promise<void>;
  /** 抽奖 */
  draw: () => Promise<void>;
  /** 首页「我的奖品」 */
  showMyPrizes: () => void;
  setMessage: (message: string | null) => void;
}

const STORAGE_KEY = 'demo:activity:step';

/** 允许通过 ?step=X 直链预览任意屏（demo 专用） */
function readInitialStep(): RuntimeStep {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('step');
  if (fromQuery) return fromQuery.toUpperCase() as RuntimeStep;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) return stored as RuntimeStep;
  return 'NOT_STARTED';
}

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

const DEMO_PRIZES: PrizeItem[] = LOTTERY_PRIZES;

const ActivityRuntimeContext = createContext<ActivityRuntimeValue | null>(null);

export function ActivityRuntimeProvider({
  code,
  children,
}: {
  code: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<DemoView>('main');
  const [message, setMessage] = useState<string | null>(null);
  const [stepOverride, setStepOverride] = useState<RuntimeStep | null>(null);
  const [demoStep, setDemoStep] = useState<RuntimeStep>(readInitialStep);
  const [demoMode, setDemoMode] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (demoMode) sessionStorage.setItem(STORAGE_KEY, demoStep);
  }, [demoStep, demoMode]);

  const runtimeQuery = useQuery({
    queryKey: ['activity-runtime', code],
    queryFn: () => activityApi.runtime(code),
    enabled: !demoMode,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const infoQuery = useQuery({
    queryKey: ['activity-info', code],
    queryFn: () => activityApi.info(code),
    enabled: !demoMode,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // 无会话（401）：生产环境跳微信静默授权；DEV 退回 demo 预览，便于无公众号环境开发。
  useEffect(() => {
    if (demoMode) return;
    const error = runtimeQuery.error;
    if (!error) return;
    if (import.meta.env.DEV) {
      setDemoMode(true);
      return;
    }
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      !redirectingRef.current
    ) {
      redirectingRef.current = true;
      window.location.href = activityApi.oauthStartUrl(
        window.location.pathname + window.location.search,
      );
    }
  }, [runtimeQuery.error, demoMode]);

  // 服务端数据刷新后清除本地的错误性步骤覆盖
  useEffect(() => {
    if (runtimeQuery.data) setStepOverride(null);
  }, [runtimeQuery.data]);

  const runtime = demoMode ? null : (runtimeQuery.data ?? null);
  const info = demoMode ? null : (infoQuery.data ?? null);

  const activity = useMemo<ActivityDisplay>(() => {
    if (demoMode || !info)
      return {
        code: ACTIVITY.code,
        title: ACTIVITY.title,
        slug: ACTIVITY.slug,
        dates: ACTIVITY.dates,
        organizer: ACTIVITY.organizer,
        rulesText: ACTIVITY.rulesText,
        prizes: DEMO_PRIZES,
      };
    return {
      code: info.code,
      title: info.name,
      slug: ACTIVITY.slug,
      dates: `${formatDate(info.startsAt)} - ${formatDate(info.endsAt)}`,
      organizer: '',
      rulesText: info.rulesText,
      prizes: info.prizes.map((prize) => ({
        name: prize.name,
        imageUrl: prize.imageUrl ?? undefined,
      })),
    };
  }, [demoMode, info]);

  const step: RuntimeStep = demoMode
    ? demoStep
    : (stepOverride ?? runtime?.nextStep ?? 'NOT_STARTED');
  const win = demoMode ? WIN : (runtime?.win ?? null);

  const prizeCodeQuery = useQuery({
    queryKey: ['activity-prize-code', code],
    queryFn: () => activityApi.prizeCode(code),
    enabled: !demoMode && win?.redemptionStatus === 'WAIT_REDEEM',
    retry: false,
    refetchOnWindowFocus: false,
  });
  const prizeCode: PrizeCodeView | null = demoMode
    ? { code: '836 215', qrUrl: 'https://localhost/activity/demo?redeem=836215' }
    : (prizeCodeQuery.data ?? null);

  const refreshRuntime = useCallback(async () => {
    const data = await queryClient.fetchQuery({
      queryKey: ['activity-runtime', code],
      queryFn: () => activityApi.runtime(code),
      staleTime: 0,
    });
    queryClient.setQueryData(['activity-runtime', code], data);
    return data;
  }, [code, queryClient]);

  const csrfToken = runtime?.csrfToken;

  const participate = useCallback(async () => {
    if (demoMode) {
      setDemoStep('SUBSCRIBE');
      setView('main');
      return;
    }
    try {
      setMessage(null);
      const data = await refreshRuntime();
      if (data.nextStep === 'NOT_STARTED') {
        setMessage('活动尚未开始，请稍后再来');
      } else {
        setView('main');
      }
    } catch (error) {
      setMessage(messageForError(error));
    }
  }, [demoMode, refreshRuntime]);

  const verifySubscribe = useCallback(async () => {
    if (demoMode) {
      setDemoStep('FORM');
      setView('main');
      return;
    }
    try {
      setMessage(null);
      const data = await refreshRuntime();
      if (data.nextStep === 'SUBSCRIBE') {
        setMessage('尚未检测到关注，请完成关注后重试');
      } else {
        setView('main');
      }
    } catch (error) {
      setMessage(messageForError(error));
    }
  }, [demoMode, refreshRuntime]);

  const startForm = useCallback(async () => {
    if (demoMode) {
      setDemoStep('WAITING_FORM');
      setView('main');
      return;
    }
    try {
      setMessage(null);
      const { url } = await activityApi.formLink(code);
      window.location.href = url;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'FORM_NOT_AVAILABLE') {
        await refreshRuntime().catch(() => undefined);
        setView('main');
        return;
      }
      setMessage(messageForError(error));
    }
  }, [code, demoMode, refreshRuntime]);

  const draw = useCallback(async () => {
    if (demoMode) {
      setDemoStep('PRIZE');
      setView('main');
      return;
    }
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
      setView('main');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'OUT_OF_STOCK') setStepOverride('OUT_OF_STOCK');
        else if (error.code === 'SUBSCRIPTION_REQUIRED')
          setStepOverride('SUBSCRIBE');
        else if (error.code === 'LEAD_REQUIRED') setStepOverride('FORM');
        else if (error.code === 'ACTIVITY_ENDED')
          await refreshRuntime().catch(() => undefined);
        else setMessage(messageForError(error));
        if (error.code !== 'ACTIVITY_ENDED') setView('main');
      } else {
        setMessage(messageForError(error));
      }
    } finally {
      setDrawing(false);
    }
  }, [code, csrfToken, demoMode, queryClient, refreshRuntime]);

  const showMyPrizes = useCallback(() => {
    if (demoMode) {
      setDemoStep('REDEEMED');
      setView('main');
      return;
    }
    if (win) {
      setView('main');
      return;
    }
    setMessage('暂无奖品，先去参与活动吧');
  }, [demoMode, win]);

  const go = useCallback(
    (next: RuntimeStep, opts?: { free?: boolean }) => {
      if (!demoMode) {
        // 真实模式下仅允许纯展示型切换：已中奖用户查看奖品详情页
        if (next === 'REDEEMED' && win) {
          setStepOverride('REDEEMED');
          setView('main');
        }
        return;
      }
      const allowed = TRANSITIONS[demoStep] ?? [];
      if (opts?.free || allowed.includes(next)) {
        setDemoStep(next);
        setView('main');
      }
    },
    [demoMode, demoStep, win],
  );

  const value = useMemo<ActivityRuntimeValue>(
    () => ({
      step,
      view,
      demo: demoMode,
      loading: !demoMode && (runtimeQuery.isPending || infoQuery.isPending),
      activity,
      win,
      prizeCode,
      message,
      drawing,
      go,
      openView: (v) => setView(v),
      closeView: () => setView('main'),
      reset: () => {
        setDemoStep('NOT_STARTED');
        setView('main');
      },
      participate,
      verifySubscribe,
      startForm,
      draw,
      showMyPrizes,
      setMessage,
    }),
    [
      step,
      view,
      demoMode,
      runtimeQuery.isPending,
      infoQuery.isPending,
      activity,
      win,
      prizeCode,
      message,
      drawing,
      go,
      participate,
      verifySubscribe,
      startForm,
      draw,
      showMyPrizes,
    ],
  );

  return (
    <ActivityRuntimeContext.Provider value={value}>
      {children}
    </ActivityRuntimeContext.Provider>
  );
}

export function useRuntime(): ActivityRuntimeValue {
  const ctx = useContext(ActivityRuntimeContext);
  if (!ctx)
    throw new Error('useRuntime must be used within ActivityRuntimeProvider');
  return ctx;
}
