import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../app/api';
import { useAuth } from '../../app/AuthProvider';
import { Button } from '../../components/ui';
import { AuthLayout } from './AuthLayout';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login({ identifier: identifier.trim(), password });
      const state = location.state as LocationState | null;
      navigate(state?.from ?? '/', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your workspace."
      footer={
        <span>
          New to SyncBoard?{' '}
          <Link to="/register" className="font-medium no-underline" style={{ color: 'var(--sb-accent)' }}>
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
        <div>
          <label className="sb-label" htmlFor="login-identifier">Email or username</label>
          <input
            id="login-identifier"
            className="sb-input"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="you@studio.com"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="sb-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="sb-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>
        {error ? (
          <p role="alert" className="text-[12px]" style={{ color: 'var(--sb-danger)' }}>
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-1 w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
