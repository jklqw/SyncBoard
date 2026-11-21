import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { IconButton } from '../../components/ui';
import { useUiStore } from '../../stores/useUiStore';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  return (
    <div className="relative flex min-h-full w-full items-center justify-center px-6 py-16">
      <div className="absolute right-5 top-5">
        <IconButton
          label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          icon={theme === 'light' ? <Moon size={17} strokeWidth={1.8} /> : <Sun size={17} strokeWidth={1.8} />}
          onClick={toggleTheme}
          tooltip={false}
        />
      </div>

      <div className="grid w-full max-w-[900px] gap-12 md:grid-cols-[1fr_380px] md:items-center">
        <div className="hidden md:block">
          <Link to="/" className="inline-flex items-center gap-2.5 no-underline" style={{ color: 'inherit' }}>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[9px] border text-[15px] font-semibold"
              style={{ borderColor: 'var(--sb-line-strong)', background: 'var(--sb-surface)' }}
            >
              S
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">SyncBoard</span>
          </Link>
          <h2
            className="mt-10 max-w-[440px] text-[34px] font-semibold leading-[1.18] tracking-[-0.035em]"
            style={{ color: 'var(--sb-ink)' }}
          >
            A quiet place to think together.
          </h2>
          <p className="mt-4 max-w-[400px] text-[14px] leading-relaxed" style={{ color: 'var(--sb-secondary)' }}>
            Conflict-free collaboration on an infinite architectural canvas. Draw, connect, discuss —
            every edit converges, even offline.
          </p>
          <div className="mt-9 flex flex-wrap gap-2">
            <span className="sb-badge">CRDT sync</span>
            <span className="sb-badge">60 FPS canvas</span>
            <span className="sb-badge">Offline-first</span>
          </div>
        </div>

        <div className="sb-panel p-7">
          <h1 className="text-[20px] font-semibold tracking-[-0.025em]">{title}</h1>
          <p className="sb-hint mt-1.5">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-6 border-t pt-4 text-[13px]" style={{ borderColor: 'var(--sb-line)' }}>
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}
