import { cn } from './cn';

export interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
  presence?: 'online' | 'away' | 'offline';
  className?: string;
}

function hashColor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0;
  }
  const palette = ['#6B8CAE', '#5B8E7D', '#B08968', '#A37A94', '#7C7B8A', '#C2705D', '#8A9A5B'];
  const value = Math.abs(hash) % palette.length;
  return palette[value] ?? '#6B8CAE';
}

export function Avatar({ name, color, size = 28, presence, className }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span className={cn('relative inline-flex flex-none', className)} style={{ width: size, height: size }}>
      <span
        className="sb-avatar"
        title={name}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(9, Math.round(size * 0.35)),
          background: color ?? hashColor(name),
        }}
      >
        {initials || '?'}
      </span>
      {presence ? (
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[var(--sb-surface)]"
          style={{
            width: Math.max(7, size * 0.28),
            height: Math.max(7, size * 0.28),
            background:
              presence === 'online'
                ? 'var(--sb-success)'
                : presence === 'away'
                  ? 'var(--sb-warning)'
                  : 'var(--sb-muted)',
          }}
        />
      ) : null}
    </span>
  );
}
