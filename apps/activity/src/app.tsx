import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import { useRuntime } from './hooks/use-runtime';
import { resolveDevelopmentSimulation } from './lib/development-simulation';
import { ActivityRuntimeProvider } from './lib/runtime';
import { RuntimeScene } from './pages/runtime-scene';

const queryClient = new QueryClient();

function ActivityEntry() {
  const { activityCode = '' } = useParams();
  const simulateDevelopmentSession = resolveDevelopmentSimulation({
    mode: import.meta.env.VITE_WECHAT_MODE,
    development: import.meta.env.DEV,
  });
  return (
    <ActivityRuntimeProvider
      key={activityCode}
      code={activityCode}
      simulateDevelopmentSession={simulateDevelopmentSession}
    >
      <ActivityScene />
    </ActivityRuntimeProvider>
  );
}

function ActivityScene() {
  const { loading, loadError } = useRuntime();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[15px] text-ink">
        加载中…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-center text-[15px] text-ink">
        {loadError}
      </div>
    );
  }
  return <RuntimeScene />;
}

export function App() {
  return (
    <Theme
      appearance="light"
      grayColor="slate"
      radius="medium"
      scaling="100%"
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename="/activity">
          <Routes>
            <Route
              path=":activityCode/*"
              element={<ActivityEntry />}
            />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </Theme>
  );
}
