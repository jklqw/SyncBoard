import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Download, History, MessageCircle, Presentation, Share2 } from 'lucide-react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import type { BoardSummary } from '@syncboard/shared';
import { Avatar, Badge, Dropdown, IconButton } from '../../components/ui';
import { useUiStore } from '../../stores/useUiStore';
import { useViewportStore } from '../../stores/useViewportStore';
import { useCollab } from '../collab/CollabProvider';
import { exportPdf, exportPng, exportSvg } from '../export';

interface BoardChromeProps {
  board: BoardSummary;
  stageRef: RefObject<Konva.Stage | null>;
  onTitleChange: (title: string) => void;
}

function syncTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'online') return 'success';
  if (status === 'reconnecting' || status === 'connecting') return 'warning';
  if (status === 'offline') return 'danger';
  return 'neutral';
}

function syncLabel(status: string): string {
  if (status === 'online') return 'Connected';
  if (status === 'reconnecting') return 'Reconnecting…';
  if (status === 'connecting') return 'Connecting…';
  return 'Offline';
}

export function BoardChrome({ board, stageRef, onTitleChange }: BoardChromeProps) {
  const { peers, canWrite, status, setPresenting, elements } = useCollab();
  const presenting = useUiStore((state) => state.presenting);
  const followingName = useUiStore((state) => state.followingName);
  const syncStatus = useUiStore((state) => state.syncStatus);
  const openModal = useUiStore((state) => state.openModal);
  const setFollowingName = useUiStore((state) => state.setFollowingName);
  const showToast = useUiStore((state) => state.showToast);
  const scale = useViewportStore((state) => state.scale);
  const reset = useViewportStore((state) => state.reset);
  const [title, setTitle] = useState(board.title);
  const titleRef = useRef(board.title);

  useEffect(() => {
    setTitle(board.title);
    titleRef.current = board.title;
  }, [board.title]);

  // Watchers are intentionally not surfaced as live collaborators in the UI.
  const others = peers.filter((peer) => peer.user && !peer.watching);

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4">
        <div className="sb-pill pointer-events-auto gap-1.5 px-2 py-1.5">
          <Link to="/" className="sb-icon-btn" aria-label="Back to dashboard">
            <ChevronLeft size={16} />
          </Link>
          <div className="sb-divider" />
          <input
            className="min-w-[120px] max-w-[240px] border-none bg-transparent px-1 text-[13px] font-medium outline-none"
            value={title}
            disabled={!canWrite}
            aria-label="Board title"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              const next = title.trim() || 'Untitled board';
              setTitle(next);
              if (next !== titleRef.current) {
                titleRef.current = next;
                onTitleChange(next);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
            }}
          />
          <Badge tone={syncTone(syncStatus || status)}>{syncLabel(syncStatus || status)}</Badge>
        </div>

        <div className="sb-pill pointer-events-auto gap-1 px-2 py-1.5">
          <div className="flex items-center pl-1">
            {others.slice(0, 5).map((peer) => (
              <Avatar
                key={peer.clientId}
                name={peer.user?.name ?? 'Peer'}
                color={peer.user?.color}
                size={26}
                className="-ml-1.5 first:ml-0"
                presence="online"
              />
            ))}
            {others.length > 5 ? (
              <span className="sb-mono ml-1 text-[11px] text-[var(--sb-secondary)]">
                +{others.length - 5}
              </span>
            ) : null}
          </div>
          <div className="sb-divider" />
          <IconButton
            label={presenting ? 'Stop presenting' : 'Present'}
            icon={<Presentation size={15} />}
            active={presenting}
            disabled={!canWrite}
            onClick={() => setPresenting(!presenting)}
          />
          <IconButton
            label="Share"
            icon={<Share2 size={15} />}
            onClick={() => openModal('share')}
          />
          <Dropdown
            align="end"
            heading="Export"
            trigger={<IconButton label="Export" icon={<Download size={15} />} />}
            items={[
              {
                label: 'PNG (2×)',
                onSelect: () => {
                  const stage = stageRef.current;
                  if (!stage) return;
                  exportPng({ elements, stage, filename: `${board.title || 'syncboard'}.png` });
                },
              },
              {
                label: 'SVG',
                onSelect: () => exportSvg(elements, `${board.title || 'syncboard'}.svg`),
              },
              {
                label: 'PDF',
                onSelect: () => {
                  const stage = stageRef.current;
                  if (!stage) return;
                  void exportPdf(elements, stage, `${board.title || 'syncboard'}.pdf`).catch(
                    (cause) => {
                      showToast(cause instanceof Error ? cause.message : 'PDF export failed.');
                    },
                  );
                },
              },
            ]}
          />
          <IconButton
            label="Comments"
            icon={<MessageCircle size={15} />}
            onClick={() => openModal('comments')}
          />
          <IconButton
            label="Version history"
            icon={<History size={15} />}
            onClick={() => openModal('history')}
          />
          <div className="sb-divider" />
          <button
            type="button"
            className="sb-btn sb-btn--ghost sb-btn--sm sb-mono"
            onClick={reset}
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>
        </div>
      </div>

      {followingName ? (
        <button
          type="button"
          className="sb-panel pointer-events-auto absolute top-16 left-1/2 z-20 -translate-x-1/2 px-4 py-2 text-[13px] sb-fade-in"
          onClick={() => setFollowingName(null)}
        >
          Following <strong>{followingName}</strong> — click to stop
        </button>
      ) : null}
    </>
  );
}
