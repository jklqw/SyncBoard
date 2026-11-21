import {
  Archive,
  Clock3,
  FolderClosed,
  FolderPlus,
  LayoutGrid,
  LogOut,
  Moon,
  Star,
  Sun,
  Users,
} from 'lucide-react';
import { Avatar } from '../../components/ui';
import { useAuth } from '../../app/AuthProvider';
import type { AuthUser } from '../../app/api';
import type { BoardFilter } from '../../app/api';
import { useUiStore } from '../../stores/useUiStore';
import { cn } from '../../components/ui/cn';

export interface SidebarProps {
  filter: BoardFilter;
  onFilterChange: (filter: BoardFilter) => void;
  folder: string | null;
  onFolderChange: (folder: string | null) => void;
  folders: string[];
  onCreate: () => void;
}

const FILTERS: Array<{ id: BoardFilter; label: string; icon: typeof Clock3 }> = [
  { id: 'recent', label: 'Recent', icon: Clock3 },
  { id: 'favorites', label: 'Starred', icon: Star },
  { id: 'shared', label: 'Shared with me', icon: Users },
  { id: 'owned', label: 'My boards', icon: LayoutGrid },
  { id: 'archived', label: 'Archive', icon: Archive },
];

export function Sidebar({
  filter,
  onFilterChange,
  folder,
  onFolderChange,
  folders,
  onCreate,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  return (
    <aside
      className="flex w-[232px] flex-none flex-col border-r px-4 py-5"
      style={{ borderColor: 'var(--sb-line)', background: 'var(--sb-surface)' }}
    >
      <div className="flex items-center gap-2.5 px-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-[8px] border text-[13px] font-semibold"
          style={{ borderColor: 'var(--sb-line-strong)' }}
        >
          S
        </span>
        <span className="text-[14px] font-semibold tracking-[-0.02em]">SyncBoard</span>
      </div>

      <button
        type="button"
        className="sb-btn sb-btn--primary mt-6 w-full justify-start"
        onClick={onCreate}
      >
        <FolderPlus size={15} strokeWidth={1.9} />
        New board
      </button>

      <nav className="mt-7 flex flex-col gap-0.5" aria-label="Board filters">
        {FILTERS.map((item) => {
          const Icon = item.icon;
          const active = filter === item.id && folder === null;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                onFolderChange(null);
                onFilterChange(item.id);
              }}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                active ? 'font-medium' : 'hover:bg-[var(--sb-hover)]',
              )}
              style={active ? { background: 'var(--sb-accent-soft)', color: 'var(--sb-accent)' } : { color: 'var(--sb-secondary)' }}
            >
              <Icon size={16} strokeWidth={1.8} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-7 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--sb-muted)' }}>
        Folders
      </div>
      <div className="mt-2 flex flex-col gap-0.5 sb-scroll" style={{ maxHeight: '34vh', overflowY: 'auto' }}>
        {folders.length === 0 ? (
          <p className="px-2.5 py-1 text-[12px]" style={{ color: 'var(--sb-muted)' }}>
            No folders yet
          </p>
        ) : (
          folders.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onFolderChange(name)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px]',
                folder === name ? 'font-medium' : 'hover:bg-[var(--sb-hover)]',
              )}
              style={folder === name ? { background: 'var(--sb-accent-soft)', color: 'var(--sb-accent)' } : { color: 'var(--sb-secondary)' }}
            >
              <FolderClosed size={15} strokeWidth={1.8} />
              <span className="truncate">{name}</span>
            </button>
          ))
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--sb-line)' }}>
        <Avatar name={user?.displayName ?? 'User'} color={user?.avatarColor} size={30} presence="online" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium">{user?.displayName}</div>
          <div className="truncate text-[11px]" style={{ color: 'var(--sb-secondary)' }}>
            @{user?.username}
          </div>
        </div>
        <button
          type="button"
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          className="sb-icon-btn sb-icon-btn--sm"
          onClick={toggleTheme}
        >
          {theme === 'light' ? <Moon size={15} strokeWidth={1.8} /> : <Sun size={15} strokeWidth={1.8} />}
        </button>
        <button type="button" aria-label="Sign out" className="sb-icon-btn sb-icon-btn--sm" onClick={() => void logout()}>
          <LogOut size={15} strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  );
}

export function userInitials(user: AuthUser | null): string {
  if (!user) return '?';
  return user.displayName.slice(0, 1).toUpperCase();
}
