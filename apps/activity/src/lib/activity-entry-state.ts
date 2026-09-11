const INVALID_ENTRY_MESSAGE =
  '活动入口已失效，请从公众号“活动抽奖”菜单获取新链接';
const UNAUTHORIZED_ENTRY_MESSAGE = '请从公众号欢迎消息或“活动抽奖”菜单重新进入';

export function activityEntryError(
  search: string,
  unauthorized: boolean,
): string | null {
  if (new URLSearchParams(search).get('entryError') === 'invalid') {
    return INVALID_ENTRY_MESSAGE;
  }
  return unauthorized ? UNAUTHORIZED_ENTRY_MESSAGE : null;
}

export function activityEntryRuntimeState({
  search,
  runtimeUnauthorized,
  simulateWechat,
  simulationError,
  runtimePending,
  infoPending,
}: {
  search: string;
  runtimeUnauthorized: boolean;
  simulateWechat: boolean;
  simulationError: string | null;
  runtimePending: boolean;
  infoPending: boolean;
}): {
  entryError: string | null;
  awaitingSimulatedSession: boolean;
  loading: boolean;
} {
  const entryError =
    activityEntryError(search, !simulateWechat && runtimeUnauthorized) ??
    simulationError;
  const awaitingSimulatedSession =
    simulateWechat && runtimeUnauthorized && !simulationError;
  return {
    entryError,
    awaitingSimulatedSession,
    loading:
      !entryError &&
      (runtimePending || infoPending || awaitingSimulatedSession),
  };
}

export async function simulateWechatSession({
  createSession,
  refetchRuntime,
  refetchInfo,
}: {
  createSession: () => Promise<unknown>;
  refetchRuntime: () => Promise<unknown>;
  refetchInfo: () => Promise<unknown>;
}): Promise<void> {
  await createSession();
  await Promise.all([refetchRuntime(), refetchInfo()]);
}
