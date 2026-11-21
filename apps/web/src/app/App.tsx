import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { BoardPage } from '../features/canvas/BoardPage';
import { applyStoredTheme, useUiStore } from '../stores/useUiStore';
import { useAuth } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-full items-center justify-center"><span className="sb-spinner" /></div>;
  return user ? <Navigate to="/" replace /> : children;
}

export function App() {
  const toast = useUiStore((state) => state.toast);
  const clearToast = useUiStore((state) => state.clearToast);

  useEffect(() => {
    applyStoredTheme();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(clearToast, 3200);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/board/:id"
          element={
            <ProtectedRoute>
              <BoardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {toast ? (
        <div
          role="status"
          className="sb-panel sb-fade-in fixed bottom-5 left-1/2 z-[300] -translate-x-1/2 px-4 py-2 text-[13px]"
          onClick={clearToast}
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
