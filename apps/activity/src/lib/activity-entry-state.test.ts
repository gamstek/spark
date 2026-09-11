import { describe, expect, it } from 'vitest';

import {
  activityEntryError,
  activityEntryRuntimeState,
  simulateWechatSession,
} from './activity-entry-state';

describe('activityEntryError', () => {
  it('guides unauthenticated visitors back through the Official Account', () => {
    expect(activityEntryError('', true)).toBe(
      '请从公众号欢迎消息或“活动抽奖”菜单重新进入',
    );
  });

  it('prioritizes a replacement-link instruction for an invalid entry', () => {
    expect(activityEntryError('?entryError=invalid', true)).toBe(
      '活动入口已失效，请从公众号“活动抽奖”菜单获取新链接',
    );
  });

  it('does not show an entry error for an authenticated valid entry', () => {
    expect(activityEntryError('', false)).toBeNull();
  });

  it('unblocks the runtime when an invalid-entry query is removed and runtime recovers', () => {
    const staleEntry = activityEntryRuntimeState({
      search: '?entryError=invalid',
      runtimeUnauthorized: true,
      simulateWechat: false,
      simulationError: null,
      runtimePending: false,
      infoPending: true,
    });
    const recoveredRuntime = activityEntryRuntimeState({
      search: '',
      runtimeUnauthorized: false,
      simulateWechat: false,
      simulationError: null,
      runtimePending: false,
      infoPending: false,
    });

    expect(staleEntry).toEqual({
      entryError: '活动入口已失效，请从公众号“活动抽奖”菜单获取新链接',
      awaitingSimulatedSession: false,
      loading: false,
    });
    expect(recoveredRuntime).toEqual({
      entryError: null,
      awaitingSimulatedSession: false,
      loading: false,
    });
  });

  it('shows production re-entry guidance without redirecting or keeping loading active', () => {
    expect(
      activityEntryRuntimeState({
        search: '',
        runtimeUnauthorized: true,
        simulateWechat: false,
        simulationError: null,
        runtimePending: false,
        infoPending: true,
      }),
    ).toEqual({
      entryError: '请从公众号欢迎消息或“活动抽奖”菜单重新进入',
      awaitingSimulatedSession: false,
      loading: false,
    });
  });

  it('creates a development session then refetches both runtime resources', async () => {
    const calls: string[] = [];

    await simulateWechatSession({
      createSession: async () => {
        calls.push('session');
      },
      refetchRuntime: async () => {
        calls.push('runtime');
      },
      refetchInfo: async () => {
        calls.push('info');
      },
    });

    expect(calls).toEqual(['session', 'runtime', 'info']);
  });
});
