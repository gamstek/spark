import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import { ActivityRuntimeProvider, useRuntime } from './lib/runtime';
import { RuntimeScene } from './pages/runtime-scene';
import { DevStepToolbar } from './components/dev-step-toolbar';

const queryClient = new QueryClient();

function ActivityEntry() {
  const { activityCode = '' } = useParams();
  return (
    <ActivityRuntimeProvider
      key={activityCode}
      code={activityCode}
    >
      <ActivityScene />
    </ActivityRuntimeProvider>
  );
}

function ActivityScene() {
  const { demo, loading } = useRuntime();
  if (loading && !demo) {
    return (
      <div className="flex h-full items-center justify-center text-[15px] text-ink">
        加载中…
      </div>
    );
  }
  return (
    <>
      <RuntimeScene />
      {import.meta.env.DEV && demo && <DevStepToolbar />}
    </>
  );
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
              path="*"
              element={<ActivityEntry />}
            />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </Theme>
  );
}
