export type ActivitySessionBootstrap =
  { authenticated: true } | { authenticated: false; redirectUrl: string };

export async function bootstrapActivitySession({
  simulateWechat,
  createSimulatedSession,
  createSession,
  refresh,
  redirect,
}: {
  simulateWechat: boolean;
  createSimulatedSession: () => Promise<unknown>;
  createSession: () => Promise<ActivitySessionBootstrap>;
  refresh: () => Promise<unknown>;
  redirect: (url: string) => void;
}): Promise<void> {
  if (simulateWechat) {
    await createSimulatedSession();
    await refresh();
    return;
  }

  const session = await createSession();
  if (session.authenticated) {
    await refresh();
    return;
  }

  redirect(session.redirectUrl);
}
