import { Theme } from '@radix-ui/themes';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import { DemoRuntimeProvider } from './lib/runtime';
import { RuntimeScene } from './pages/runtime-scene';
import { DevStepToolbar } from './components/dev-step-toolbar';

function ActivityEntry() {
  const { activityCode } = useParams();
  return (
    <DemoRuntimeProvider key={activityCode}>
      <RuntimeScene />
      {import.meta.env.DEV && <DevStepToolbar />}
    </DemoRuntimeProvider>
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
      <BrowserRouter basename="/activity">
        <Routes>
          <Route
            path="*"
            element={<ActivityEntry />}
          />
        </Routes>
      </BrowserRouter>
    </Theme>
  );
}
