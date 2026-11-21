import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../app/api';
import { useAuth } from '../../app/AuthProvider';
import { Button } from '../../components/ui';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(field: keyof typeof form, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({ ...form, email: form.email.trim(), username: form.username.trim() });
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="A few details and you're ready to draw."
      footer={
        <span>
          Already have an account?{' '}
          <Link to="/login" className="font-medium no-underline" style={{ color: 'var(--sb-accent)' }}>
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3.5" noValidate>
        <div>
          <label className="sb-label" htmlFor="reg-name">Display name</label>
          <input
            id="reg-name"
            className="sb-input"
            value={form.displayName}
            onChange={(event) => update('displayName', event.target.value)}
            placeholder="Ada Lovelace"
            autoComplete="name"
            required
          />
        </div>
        <div>
          <label className="sb-label" htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            className="sb-input"
            type="email"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            placeholder="you@studio.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="sb-label" htmlFor="reg-username">Username</label>
          <input
            id="reg-username"
            className="sb-input"
            value={form.username}
            onChange={(event) => update('username', event.target.value)}
            placeholder="ada"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="sb-label" htmlFor="reg-password">Password <span className="normal-case tracking-normal">(8+ characters)</span></label>
          <input
            id="reg-password"
            className="sb-input"
            type="password"
            value={form.password}
            onChange={(event) => update('password', event.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>
        {error ? (
          <p role="alert" className="text-[12px]" style={{ color: 'var(--sb-danger)' }}>
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-1 w-full">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
