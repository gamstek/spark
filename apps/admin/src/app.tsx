import { Flex, Spinner, Theme } from '@radix-ui/themes';
import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components';
import { LoginPage } from './features/auth/login-page';
import { ActivitiesListPage } from './features/activities/list-page';
import { ActivityEditPage } from './features/activities/edit-page';
import { JobsPage } from './features/jobs/jobs-page';
import { ParticipantsPage } from './features/participants/participants-page';
import { PrizesPage } from './features/prizes/prizes-page';
import { StaffPage } from './features/staff/staff-page';
import { ReportsOverviewPage } from './features/reports/overview-page';
import { RedemptionsListPage } from './features/redemptions/list-page';
import { ExportsPage } from './features/exports/exports-page';
import { restoreAdminSession } from './api';
function Shell() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    restoreAdminSession().then(() => setReady(true));
  }, []);
  if (!ready) {
    return (
      <Flex
        align="center"
        justify="center"
        minHeight="100vh"
      >
        <Spinner size="3" />
      </Flex>
    );
  }
  return (
    <AppShell>
      <Routes>
        <Route
          index
          element={
            <Navigate
              to="activities"
              replace
            />
          }
        />
        <Route
          path="activities"
          element={<ActivitiesListPage />}
        />
        <Route
          path="activities/:id"
          element={<ActivityEditPage />}
        />
        <Route
          path="activities/:id/prizes"
          element={<PrizesPage />}
        />
        <Route
          path="activities/:id/participants"
          element={<ParticipantsPage />}
        />
        <Route
          path="activities/:id/report"
          element={<ReportsOverviewPage />}
        />
        <Route
          path="activities/:id/redemptions"
          element={<RedemptionsListPage />}
        />
        <Route
          path="activities/:id/exports"
          element={<ExportsPage />}
        />
        <Route
          path="staff"
          element={<StaffPage />}
        />
        <Route
          path="jobs"
          element={<JobsPage />}
        />
      </Routes>
    </AppShell>
  );
}
export function App() {
  return (
    <Theme
      accentColor="indigo"
      grayColor="sage"
      radius="medium"
      scaling="100%"
    >
      <BrowserRouter basename="/admin">
        <Routes>
          <Route
            path="login"
            element={<LoginPage />}
          />
          <Route
            path="*"
            element={<Shell />}
          />
        </Routes>
      </BrowserRouter>
    </Theme>
  );
}
