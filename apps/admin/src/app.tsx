import { Box, Flex, Heading, Theme } from '@radix-ui/themes';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './features/auth/login-page';
import { ActivitiesListPage } from './features/activities/list-page';
import { ActivityEditPage } from './features/activities/edit-page';
import { JobsPage } from './features/jobs/jobs-page';
import { ParticipantsPage } from './features/participants/participants-page';
import { PrizesPage } from './features/prizes/prizes-page';
import { StaffPage } from './features/staff/staff-page';
function Shell() {
  return (
    <Flex minHeight="100vh">
      <Box className="sidebar">
        <Heading size="5">Spark 运营台</Heading>
        <nav>
          {(
            [
              ['活动管理', 'activities'],
              ['工作人员', 'staff'],
              ['失败任务', 'jobs'],
            ] as const
          ).map(([label, path]) => (
            <NavLink key={path} to={path}>
              {label}
            </NavLink>
          ))}
        </nav>
      </Box>
      <Box className="content">
        <Routes>
          <Route index element={<Navigate to="activities" replace />} />
          <Route path="activities" element={<ActivitiesListPage />} />
          <Route path="activities/:id" element={<ActivityEditPage />} />
          <Route path="activities/:id/prizes" element={<PrizesPage />} />
          <Route path="activities/:id/participants" element={<ParticipantsPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="jobs" element={<JobsPage />} />
        </Routes>
      </Box>
    </Flex>
  );
}
export function App() {
  return (
    <Theme accentColor="indigo" grayColor="slate" radius="medium">
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="*" element={<Shell />} />
        </Routes>
      </BrowserRouter>
    </Theme>
  );
}
