import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  staffApi,
  type StaffMe,
  type StaffPrize,
  type StaffRecord,
} from './api';

export type TabKey = 'home' | 'prizes' | 'profile';

export interface StaffActivity {
  id: string;
  code: string;
  name: string;
}

interface StaffContextValue {
  /** 会话检查中 */
  authLoading: boolean;
  /** 是否已登录（以 /api/staff/auth/me 为准） */
  loggedIn: boolean;
  me: StaffMe | null;
  csrfToken: string | undefined;
  displayName: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  activities: StaffActivity[];
  currentActivityId: string;
  pickActivity: (id: string) => void;
  currentActivity: StaffActivity | null;

  prizes: StaffPrize[];
  records: StaffRecord[];

  /** 录入/扫码得到的兑奖码 */
  code: string;
  setCode: (v: string) => void;
}

const ACTIVITY_KEY = 'staff:activity-id';

const StaffContext = createContext<StaffContextValue | null>(null);

export function StaffRuntimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [currentActivityId, setCurrentActivityId] = useState(
    () => sessionStorage.getItem(ACTIVITY_KEY) ?? '',
  );
  const [code, setCode] = useState('');

  const meQuery = useQuery({
    queryKey: ['staff-me'],
    queryFn: async () => {
      try {
        return await staffApi.me();
      } catch (error) {
        if (error instanceof Error && error.name === 'ApiError') return null;
        throw error;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const loggedIn = !!meQuery.data?.id;

  const activitiesQuery = useQuery({
    queryKey: ['staff-activities'],
    queryFn: () => staffApi.activities(),
    enabled: loggedIn,
    refetchOnWindowFocus: false,
  });
  const activities = activitiesQuery.data ?? [];

  const effectiveActivityId =
    currentActivityId && activities.some((a) => a.id === currentActivityId)
      ? currentActivityId
      : (activities[0]?.id ?? '');

  const prizesQuery = useQuery({
    queryKey: ['staff-prizes', effectiveActivityId],
    queryFn: () => staffApi.prizes(effectiveActivityId),
    enabled: loggedIn && !!effectiveActivityId,
    refetchOnWindowFocus: false,
  });
  const recordsQuery = useQuery({
    queryKey: ['staff-records', effectiveActivityId],
    queryFn: () => staffApi.records(effectiveActivityId),
    enabled: loggedIn && !!effectiveActivityId,
    refetchOnWindowFocus: false,
  });

  const pickActivity = useCallback((id: string) => {
    setCurrentActivityId(id);
    sessionStorage.setItem(ACTIVITY_KEY, id);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      await staffApi.login(username, password);
      await queryClient.invalidateQueries({ queryKey: ['staff-me'] });
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    const csrfToken = meQuery.data?.csrfToken;
    try {
      if (csrfToken) await staffApi.logout(csrfToken);
    } finally {
      queryClient.setQueryData(['staff-me'], null);
      queryClient.clear();
    }
  }, [meQuery.data?.csrfToken, queryClient]);

  const value = useMemo<StaffContextValue>(
    () => ({
      authLoading: meQuery.isPending,
      loggedIn,
      me: meQuery.data ?? null,
      csrfToken: meQuery.data?.csrfToken,
      displayName: meQuery.data?.displayName || '工作人员',
      login,
      logout,
      activities,
      currentActivityId: effectiveActivityId,
      pickActivity,
      currentActivity:
        activities.find((a) => a.id === effectiveActivityId) ?? null,
      prizes: prizesQuery.data ?? [],
      records: recordsQuery.data ?? [],
      code,
      setCode,
    }),
    [
      meQuery.isPending,
      meQuery.data,
      loggedIn,
      login,
      logout,
      activities,
      effectiveActivityId,
      pickActivity,
      prizesQuery.data,
      recordsQuery.data,
      code,
    ],
  );

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff(): StaffContextValue {
  const ctx = useContext(StaffContext);
  if (!ctx)
    throw new Error('useStaff must be used within StaffRuntimeProvider');
  return ctx;
}
