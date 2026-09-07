import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';

const queryClient = new QueryClient();

function ActivityEntry() {
  const { activityCode } = useParams();
  return <main><h1>Project Spark</h1><p>活动：{activityCode}</p></main>;
}

export function App() {
  return (
    <Theme>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename="/activity">
          <Routes><Route path=":activityCode" element={<ActivityEntry />} /></Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </Theme>
  );
}
