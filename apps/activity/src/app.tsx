import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import { useRuntime } from './hooks/use-runtime';
import { useWechatEnvironment } from './hooks/use-wechat-environment';
import { ActivityRuntimeProvider } from './lib/runtime';
import { RuntimeScene } from './pages/runtime-scene';

const queryClient = new QueryClient();

function ActivityEntry() {
  const { activityCode = '' } = useParams();
  const wechat = useWechatEnvironment();
  if (!wechat.allowed) return <WechatBrowserRequired />;
  return (
    <ActivityRuntimeProvider
      key={activityCode}
      code={activityCode}
      simulateWechat={wechat.simulated}
    >
      <ActivityScene />
    </ActivityRuntimeProvider>
  );
}

function WechatBrowserRequired() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center bg-white px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-[#eef8f1] text-[32px]">
        微信
      </div>
      <h1 className="mt-5 text-[20px] font-medium text-ink">请使用微信打开</h1>
      <p className="mt-2 text-[14px] leading-6 text-sub">
        请复制当前页面链接，并在微信中打开后参与活动。
      </p>
    </main>
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
