export type ActivitySessionBootstrap =
  { authenticated: true } | { authenticated: false; redirectUrl: string };

export async function bootstrapActivitySession({
  simulateDevelopmentSession,
  createDevelopmentSession,
  createSession,
  refresh,
  redirect,
}: {
  simulateDevelopmentSession: boolean;
  createDevelopmentSession: () => Promise<unknown>;
  createSession: () => Promise<ActivitySessionBootstrap>;
  refresh: () => Promise<unknown>;
  redirect: (url: string) => void;
}): Promise<void> {
  if (simulateDevelopmentSession) {
    await createDevelopmentSession();
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
