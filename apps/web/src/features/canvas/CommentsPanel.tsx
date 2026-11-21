import { useMemo, useState } from 'react';
import { Check, MessageCircle, X } from 'lucide-react';
import { canComment } from '@syncboard/shared';
import type { Role } from '@syncboard/shared';
import { Button, IconButton } from '../../components/ui';
import { useUiStore } from '../../stores/useUiStore';
import { useComments } from '../collab/useComments';
import { worldToScreen } from './utils/geometry';
import { useViewportStore } from '../../stores/useViewportStore';

interface CommentsPanelProps {
  boardId: string;
  role: Role;
  open: boolean;
  onClose: () => void;
}

export function CommentsPanel({ boardId, role, open, onClose }: CommentsPanelProps) {
  const { comments, loading, add, resolve } = useComments(boardId);
  const draft = useUiStore((state) => state.commentDraft);
  const setCommentDraft = useUiStore((state) => state.setCommentDraft);
  const showToast = useUiStore((state) => state.showToast);
  const camera = useViewportStore((state) => ({ x: state.x, y: state.y, scale: state.scale }));
  const [body, setBody] = useState('');
  const allowed = canComment(role);

  const roots = useMemo(
    () => comments.filter((comment) => !comment.parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [comments],
  );

  async function submit(): Promise<void> {
    if (!body.trim() || !allowed) return;
    try {
      await add({
        body: body.trim(),
        ...(draft?.x !== undefined ? { x: draft.x } : {}),
        ...(draft?.y !== undefined ? { y: draft.y } : {}),
        ...(draft?.elementId ? { elementId: draft.elementId } : {}),
      });
      setBody('');
      setCommentDraft(null);
      showToast('Comment posted');
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not post comment.');
    }
  }

  return (
    <>
      {roots
        .filter((comment) => comment.x != null && comment.y != null && !comment.resolved)
        .map((comment) => {
          const screen = worldToScreen({ x: comment.x!, y: comment.y! }, camera);
          return (
            <button
              key={`pin-${comment.id}`}
              type="button"
              className="pointer-events-auto absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border border-[var(--sb-line)] bg-[var(--sb-surface)] shadow-[var(--sb-shadow)]"
              style={{ left: screen.x, top: screen.y }}
              title={comment.body}
              onClick={() => {
                if (!open) useUiStore.getState().openModal('comments');
              }}
            >
              <MessageCircle size={13} className="text-[var(--sb-accent)]" />
            </button>
          );
        })}

      {open ? (
        <aside className="sb-panel pointer-events-auto absolute top-16 right-4 z-30 flex h-[min(560px,calc(100%-6rem))] w-[320px] flex-col sb-fade-in">
          <header className="flex items-center justify-between border-b border-[var(--sb-line)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <MessageCircle size={15} />
              Comments
            </div>
            <IconButton label="Close" icon={<X size={15} />} onClick={onClose} tooltip={false} small />
          </header>

          <div className="sb-scroll flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <span className="sb-spinner" />
              </div>
            ) : roots.length === 0 ? (
              <p className="sb-hint py-6 text-center">No comments yet. Click the canvas with comments open to pin one.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {roots.map((comment) => (
                  <li key={comment.id} className="rounded-lg border border-[var(--sb-line)] p-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium">{comment.authorName}</span>
                      <span className="sb-mono text-[10px] text-[var(--sb-muted)]">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className={`text-[13px] ${comment.resolved ? 'text-[var(--sb-muted)] line-through' : ''}`}>
                      {comment.body}
                    </p>
                    {allowed ? (
                      <button
                        type="button"
                        className="sb-btn sb-btn--ghost sb-btn--sm mt-2"
                        onClick={() => void resolve(comment.id, !comment.resolved)}
                      >
                        <Check size={13} />
                        {comment.resolved ? 'Reopen' : 'Resolve'}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {allowed ? (
            <div className="border-t border-[var(--sb-line)] p-3">
              {draft ? (
                <p className="sb-hint mb-2">
                  Pin at ({Math.round(draft.x)}, {Math.round(draft.y)})
                </p>
              ) : (
                <p className="sb-hint mb-2">Click the board to place a pin, then write a comment.</p>
              )}
              <textarea
                className="sb-input mb-2 min-h-[72px] resize-y"
                placeholder="Add a comment…"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
              <Button
                variant="primary"
                size="sm"
                disabled={!body.trim()}
                onClick={() => void submit()}
              >
                Post
              </Button>
            </div>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
