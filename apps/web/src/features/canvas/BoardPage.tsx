import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type Konva from 'konva';
import type { BoardSummary } from '@syncboard/shared';
import { boardsApi, setShareToken } from '../../app/api';
import { useToolStore } from '../../stores/useToolStore';
import { useUiStore } from '../../stores/useUiStore';
import { CollabProvider, useCollab } from '../collab/CollabProvider';
import { ShareModal } from '../dashboard/ShareModal';
import { BoardChrome } from './BoardChrome';
import { CanvasStage } from './CanvasStage';
import { CommentsPanel } from './CommentsPanel';
import { PropertiesInspector } from './PropertiesInspector';
import { ToolDock } from './ToolDock';
import { VersionHistoryDrawer } from './VersionHistoryDrawer';

function BoardWorkspace({
  board,
  watching,
  onBoardChange,
}: {
  board: BoardSummary;
  watching: boolean;
  onBoardChange: (board: BoardSummary) => void;
}) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const { elements, canWrite, role } = useCollab();
  const selection = useToolStore((state) => state.selection);
  const modal = useUiStore((state) => state.modal);
  const closeModal = useUiStore((state) => state.closeModal);
  const showToast = useUiStore((state) => state.showToast);

  const selected = elements.filter((element) => selection.includes(element.id));

  const onTitleChange = useCallback(
    async (title: string) => {
      try {
        const updated = await boardsApi.update(board.id, { title });
        onBoardChange(updated);
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : 'Could not rename board.');
      }
    },
    [board.id, onBoardChange, showToast],
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--sb-canvas)]">
      {watching ? (
        <div
          role="status"
          className="sb-pill pointer-events-none absolute left-1/2 top-[68px] z-30 -translate-x-1/2 px-3 py-1.5 text-[12px]"
        >
          Watching in read-only mode — your cursor is hidden from editors
        </div>
      ) : null}
      <CanvasStage boardId={board.id} stageRef={stageRef} />
      <BoardChrome
        board={board}
        stageRef={stageRef}
        onTitleChange={(title) => void onTitleChange(title)}
      />
      <ToolDock />
      <PropertiesInspector selected={selected} />
      <CommentsPanel
        boardId={board.id}
        role={role}
        open={modal === 'comments'}
        onClose={closeModal}
      />
      <VersionHistoryDrawer
        boardId={board.id}
        open={modal === 'history'}
        canRestore={canWrite}
        onClose={closeModal}
      />
      <ShareModal
        board={board}
        open={modal === 'share'}
        onClose={closeModal}
        onChanged={() => void boardsApi.get(board.id).then(onBoardChange)}
      />
    </div>
  );
}

export function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get('token');
  const watching = searchParams.get('watch') === '1';
  const [board, setBoard] = useState<BoardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setShareToken(shareToken);
    return () => setShareToken(null);
  }, [shareToken]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void boardsApi
      .get(id)
      .then((next) => {
        if (!cancelled) setBoard(next);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Board not found.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="sb-spinner" />
      </div>
    );
  }

  if (error || !board || !id) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[14px] text-[var(--sb-secondary)]">{error ?? 'Board not found.'}</p>
        <Link to="/" className="sb-btn sb-btn--secondary">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <CollabProvider boardId={board.id} role={board.role} watching={watching}>
      <BoardWorkspace board={board} watching={watching} onBoardChange={setBoard} />
    </CollabProvider>
  );
}
