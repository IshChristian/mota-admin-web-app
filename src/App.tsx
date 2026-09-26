import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Shell } from './components/Shell';
import { CookieConsent } from './components/CookieConsent';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import {
  AuditPage,
  DriverDetailPage,
  DriversPage,
  FinancePage,
  FinesPage,
  KycPage,
  LoansPage,
  OperationsMapPage,
  OverviewPage,
  ProfilePage,
  RegistrationsPage,
  RidesPage,
  SettingsPage,
  SupportPage,
  UserDetailPage,
  UsersPage,
} from './pages';
import { LoginPage } from './pages/LoginPage';
import { RolesCrudPage } from './pages/RolesCrudPage';
import { AdminInfoPage } from './pages/AdminInfoPage';
import { AdminStatusPage } from './pages/AdminStatusPage';
import { SafetyDisputesPage } from './pages/SafetyDisputesPage';
import { useEffect, useState } from 'react';

function OperationFeedback() {
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  useEffect(() => {
    const show = (event: Event) => setNotice((event as CustomEvent).detail);
    window.addEventListener('mota:operation', show);
    return () => window.removeEventListener('mota:operation', show);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return notice ? <div role="status" aria-live="polite" className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border px-5 py-3 shadow-xl ${notice.kind === 'error' ? 'border-red-400 bg-red-950 text-red-100' : 'border-lime bg-slate-900 text-white'}`}>{notice.message}<button type="button" aria-label="Dismiss message" className="ml-4" onClick={() => setNotice(null)}>×</button></div> : null;
}

function Protected() {
  const { staff } = useAuth();
  const location = useLocation();
  return staff ? <Shell /> : <Navigate to="/login" state={{ from: location.pathname }} replace />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="info/:page" element={<AdminInfoPage />} />
          <Route path="status/:type" element={<AdminStatusPage />} />
          <Route element={<Protected />}>
            <Route index element={<Navigate to="/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="drivers" element={<DriversPage />} />
            <Route path="drivers/:id" element={<DriverDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="rides" element={<RidesPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="loans" element={<LoansPage />} />
            <Route path="fines" element={<FinesPage />} />
            <Route path="registrations" element={<RegistrationsPage />} />
            <Route path="kyc" element={<KycPage />} />
            <Route path="roles" element={<RolesCrudPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="safety-disputes" element={<SafetyDisputesPage />} />
            <Route path="operations-map" element={<OperationsMapPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="people" element={<Navigate to="/users" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/status/404" replace />} />
        </Routes>
        <CookieConsent />
        <OperationFeedback />
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
