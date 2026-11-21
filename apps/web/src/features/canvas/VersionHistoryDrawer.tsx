import { useCallback, useEffect, useState } from 'react';
import { History, Plus, RotateCcw, X } from 'lucide-react';
import type { SnapshotDto } from '@syncboard/shared';
import { boardsApi } from '../../app/api';
import { Button, IconButton } from '../../components/ui';
import { useUiStore } from '../../stores/useUiStore';

interface VersionHistoryDrawerProps {
  boardId: string;
  open: boolean;
  canRestore: boolean;
  onClose: () => void;
}

export function VersionHistoryDrawer({ boardId, open, canRestore, onClose }: VersionHistoryDrawerProps) {
  const showToast = useUiStore((state) => state.showToast);
  const [snapshots, setSnapshots] = useState<SnapshotDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshots(await boardsApi.snapshots(boardId));
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not load versions.');
    } finally {
      setLoading(false);
    }
  }, [boardId, showToast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  async function saveVersion(): Promise<void> {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await boardsApi.createSnapshot(boardId, label.trim());
      setLabel('');
      await load();
      showToast('Version saved');
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not save version.');
    } finally {
      setBusy(false);
    }
  }

  async function restore(snapshot: SnapshotDto): Promise<void> {
    if (!canRestore) return;
    setBusy(true);
    try {
      await boardsApi.restoreSnapshot(boardId, snapshot.id);
      showToast(`Restored “${snapshot.label}”`);
      onClose();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not restore version.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="sb-panel pointer-events-auto absolute top-16 right-4 z-30 flex h-[min(560px,calc(100%-6rem))] w-[300px] flex-col sb-fade-in">
      <header className="flex items-center justify-between border-b border-[var(--sb-line)] px-3 py-2.5">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <History size={15} />
          Version history
        </div>
        <IconButton label="Close" icon={<X size={15} />} onClick={onClose} tooltip={false} small />
      </header>

      {canRestore ? (
        <div className="flex gap-2 border-b border-[var(--sb-line)] p-3">
          <input
            className="sb-input"
            placeholder="Checkpoint name"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void saveVersion();
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !label.trim()}
            onClick={() => void saveVersion()}
          >
            <Plus size={14} />
            Save
          </Button>
        </div>
      ) : null}

      <div className="sb-scroll flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="sb-spinner" />
          </div>
        ) : snapshots.length === 0 ? (
          <p className="sb-hint px-2 py-6 text-center">No checkpoints yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {snapshots.map((snapshot) => (
              <li
                key={snapshot.id}
                className="flex items-start justify-between gap-2 rounded-lg px-2 py-2 hover:bg-[var(--sb-hover)]"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{snapshot.label}</div>
                  <div className="sb-mono text-[11px] text-[var(--sb-muted)]">
                    {new Date(snapshot.createdAt).toLocaleString()}
                  </div>
                </div>
                {canRestore ? (
                  <IconButton
                    label="Restore"
                    icon={<RotateCcw size={14} />}
                    small
                    disabled={busy}
                    onClick={() => void restore(snapshot)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
