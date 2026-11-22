import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        role="status"
        aria-label="Loading"
      >
        <span className="sb-spinner" />
      </div>
    );
  }
  if (!user) {
    // A share/watch link is a narrowly scoped, server-validated credential.
    // Let it through to the board route; all API and WS access is still
    // checked against the token by the server.
    const shareToken = new URLSearchParams(location.search).get('token');
    if (location.pathname.startsWith('/board/') && shareToken) return children;
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search + location.hash }}
        replace
      />
    );
  }
  return children;
}
