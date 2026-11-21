import { useNavigate } from 'react-router-dom';
import { Copy, MoreHorizontal, Star, Trash2, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import type { BoardSummary } from '@syncboard/shared';
import { Dropdown, IconButton } from '../../components/ui';
import { useState } from 'react';

interface BoardCardProps {
  board: BoardSummary;
  onFavorite: (board: BoardSummary) => void;
  onDuplicate: (board: BoardSummary) => void;
  onRemove: (board: BoardSummary) => void;
  onArchive: (board: BoardSummary) => void;
  onRename: (board: BoardSummary) => void;
  onShare: (board: BoardSummary) => void;
}

/** A quiet, deterministic little preview so cards feel crafted without fetching thumbnails. */
function BoardPreview({ seed }: { seed: string }) {
  const number = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const variant = number % 3;
  return (
    <div
      className="relative h-[108px] w-full overflow-hidden border-b"
      style={{ background: 'var(--sb-canvas)', borderColor: 'var(--sb-line)' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 240 108" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`dots-${seed}`} width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="var(--sb-grid)" />
          </pattern>
        </defs>
        <rect width="240" height="108" fill={`url(#dots-${seed})`} />
        {variant === 0 ? (
          <g stroke="var(--sb-ink)" strokeWidth="1.3" fill="none" opacity="0.62">
            <rect x="26" y="24" width="54" height="28" rx="3" />
            <rect x="126" y="22" width="54" height="28" rx="14" />
            <rect x="76" y="68" width="58" height="26" rx="3" />
            <path d="M80 38 H126 M103 52 V68 M133 50 Q104 60 104 68" strokeDasharray="4 3" />
          </g>
        ) : variant === 1 ? (
          <g stroke="var(--sb-ink)" strokeWidth="1.3" fill="none" opacity="0.62">
            <path d="M30 78 L30 38 L92 38 M92 38 L92 70 L160 70 M92 38 L176 26" />
            <circle cx="30" cy="78" r="4" fill="var(--sb-surface)" />
            <circle cx="160" cy="70" r="4" fill="var(--sb-surface)" />
            <circle cx="176" cy="26" r="4" fill="var(--sb-surface)" />
          </g>
        ) : (
          <g stroke="var(--sb-ink)" strokeWidth="1.3" fill="none" opacity="0.62">
            <rect x="82" y="16" width="76" height="26" rx="4" />
            <rect x="26" y="66" width="62" height="24" rx="4" />
            <rect x="152" y="66" width="62" height="24" rx="4" />
            <path d="M120 42 V54 M57 66 V54 H183 V66" />
          </g>
        )}
      </svg>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function BoardCard({
  board,
  onFavorite,
  onDuplicate,
  onRemove,
  onArchive,
  onRename,
  onShare,
}: BoardCardProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article
      className="sb-panel group relative flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--sb-shadow-lg)]"
      aria-label={`Board ${board.title}`}
    >
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => navigate(`/board/${board.id}`)}
        aria-label={`Open ${board.title}`}
      >
        <BoardPreview seed={board.id} />
      </button>
      <div className="flex items-start justify-between gap-2 px-3.5 py-3">
        <div className="min-w-0">
          <button
            type="button"
            className="max-w-full truncate text-left text-[13px] font-medium hover:underline"
            onClick={() => navigate(`/board/${board.id}`)}
          >
            {board.title}
          </button>
          <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--sb-secondary)' }}>
            {board.folderName ? `${board.folderName} · ` : ''}
            {formatDate(board.updatedAt)} · {board.role.toLowerCase()}
          </p>
        </div>
        <div className="flex flex-none items-center gap-0.5">
          {board.isFavorite ? (
            <Star size={13} fill="currentColor" style={{ color: 'var(--sb-accent)' }} aria-label="Starred" />
          ) : null}
          <div onClick={(event) => event.stopPropagation()}>
            <Dropdown
              open={menuOpen}
              onOpenChange={setMenuOpen}
              trigger={
                <IconButton
                  label={`Options for ${board.title}`}
                  icon={<MoreHorizontal size={16} strokeWidth={1.8} />}
                  small
                  tooltip={false}
                />
              }
              items={[
                { label: 'Rename', icon: <Pencil size={14} />, onSelect: () => onRename(board) },
                { label: board.isFavorite ? 'Remove star' : 'Add to starred', icon: <Star size={14} />, onSelect: () => onFavorite(board) },
                { label: 'Share…', icon: <UsersIcon />, onSelect: () => onShare(board) },
                { label: 'Duplicate', icon: <Copy size={14} />, onSelect: () => onDuplicate(board) },
                { label: board.isArchived ? 'Unarchive' : 'Archive', icon: board.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />, onSelect: () => onArchive(board) },
                { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onSelect: () => onRemove(board) },
              ]}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
