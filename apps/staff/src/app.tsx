import { useEffect } from 'react';
import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import { StaffRuntimeProvider, useStaff } from './lib/runtime';
import { EnterCodePage } from './pages/enter-code-page';
import { HomePage } from './pages/home-page';
import { LoginPage } from './pages/login-page';
import { PrizeStockPage } from './pages/prize-stock-page';
import { ProfilePage } from './pages/profile-page';
import { RedeemConfirmPage } from './pages/redeem-confirm-page';
import { RedeemSuccessPage } from './pages/redeem-success-page';
import { RulesPage } from './pages/rules-page';
import { ScanPage } from './pages/scan-page';
import { TodosPage } from './pages/todos-page';

const queryClient = new QueryClient();

/** 登录守卫：以 /api/staff/auth/me 为准；支持 ?code= 兑奖码深链直达核销确认。 */
function RequireAuth() {
  const { loggedIn, authLoading, setCode } = useStaff();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (!codeParam) return;
    setCode(codeParam);
    navigate('/redeem/confirm', { replace: true });
  }, [searchParams, navigate, setCode]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[15px] text-ink">
        加载中…
      </div>
    );
  }
  if (!loggedIn && pathname !== '/login') {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }
  return <Outlet />;
}

export function App() {
  return (
    <Theme>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename="/staff">
          <StaffRuntimeProvider>
            <Routes>
              <Route
                path="/login"
                element={<LoginPage />}
              />
              <Route element={<RequireAuth />}>
                <Route
                  path="/"
                  element={<HomePage />}
                />
                <Route
                  path="/profile"
                  element={<ProfilePage />}
                />
                <Route
                  path="/prizes"
                  element={<PrizeStockPage />}
                />
                <Route
                  path="/scan"
                  element={<ScanPage />}
                />
                <Route
                  path="/enter"
                  element={<EnterCodePage />}
                />
                <Route
                  path="/redeem/confirm"
                  element={<RedeemConfirmPage />}
                />
                <Route
                  path="/redeem/success"
                  element={<RedeemSuccessPage />}
                />
                <Route
                  path="/redeem/already"
                  element={<RedeemSuccessPage />}
                />
                <Route
                  path="/todos"
                  element={<TodosPage />}
                />
                <Route
                  path="/rules"
                  element={<RulesPage />}
                />
                <Route
                  path="*"
                  element={
                    <Navigate
                      to="/"
                      replace
                    />
                  }
                />
              </Route>
            </Routes>
          </StaffRuntimeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Theme>
  );
}
