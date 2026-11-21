import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import type { BoardSummary } from '@syncboard/shared';
import { boardsApi, type BoardFilter } from '../../app/api';
import { Button, Badge } from '../../components/ui';
import { useUiStore } from '../../stores/useUiStore';
import { BoardCard } from './BoardCard';
import { CreateBoardDialog } from './CreateBoardDialog';
import { ShareModal } from './ShareModal';
import { Sidebar } from './Sidebar';

const FILTER_TITLES: Record<BoardFilter, string> = {
  recent: 'Recent boards',
  owned: 'My boards',
  shared: 'Shared with me',
  favorites: 'Starred boards',
  archived: 'Archive',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const showToast = useUiStore((state) => state.showToast);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilter>('recent');
  const [folder, setFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareBoard, setShareBoard] = useState<BoardSummary | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const load = useCallback(
    async (cursor?: string, append = false): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const result = await boardsApi.list({
          filter,
          ...(folder !== null ? { folder } : {}),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          limit: 24,
          ...(cursor ? { cursor } : {}),
        });
        setBoards((current) => (append ? [...current, ...result.items] : result.items));
        setNextCursor(result.nextCursor);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load boards.');
      } finally {
        setLoading(false);
      }
    },
    [filter, folder, debouncedSearch],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    boardsApi
      .list({ filter: 'recent', limit: 100 })
      .then((result) => {
        if (cancelled) return;
        const names = new Set<string>();
        for (const board of result.items) {
          if (board.folderName) names.add(board.folderName);
        }
        setFolders([...names].sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [boards]);

  const title = useMemo(() => {
    if (folder) return folder;
    return FILTER_TITLES[filter];
  }, [filter, folder]);

  async function mutate(action: () => Promise<unknown>, success: string): Promise<void> {
    try {
      await action();
      showToast(success);
      await load();
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Something went wrong.');
    }
  }

  async function rename(board: BoardSummary): Promise<void> {
    const value = window.prompt('Board title', board.title);
    if (value === null || value.trim() === '' || value.trim() === board.title) return;
    await mutate(
      () => boardsApi.update(board.id, { title: value.trim() }),
      'Board renamed',
    );
  }

  return (
    <div className="flex h-full w-full" style={{ background: 'var(--sb-paper)' }}>
      <Sidebar
        filter={filter}
        onFilterChange={setFilter}
        folder={folder}
        onFolderChange={setFolder}
        folders={folders}
        onCreate={() => setCreateOpen(true)}
      />

      <main className="sb-scroll min-w-0 flex-1 overflow-y-auto">
        <header
          className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b px-7 py-4 backdrop-blur-sm"
          style={{ background: 'var(--sb-paper)', borderColor: 'var(--sb-line)' }}
        >
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold tracking-[-0.025em]">{title}</h1>
            <p className="text-[12px]" style={{ color: 'var(--sb-secondary)' }}>
              {boards.length} {boards.length === 1 ? 'board' : 'boards'}
            </p>
          </div>
          <div className="relative w-[240px] max-w-full">
            <Search
              size={15}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--sb-secondary)' }}
            />
            <input
              ref={searchRef}
              className="sb-input pl-9 pr-8"
              placeholder="Search boards"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search boards"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1"
                onClick={() => setSearch('')}
              >
                <X size={13} />
              </button>
            ) : (
              <kbd
                className="sb-mono absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]"
                style={{ color: 'var(--sb-muted)' }}
              >
                ⌘K
              </kbd>
            )}
          </div>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            New board
          </Button>
        </header>

        <div className="px-7 py-6">
          {error ? (
            <div className="sb-panel mb-5 flex items-center justify-between gap-4 p-4 text-[13px]" role="alert">
              <span style={{ color: 'var(--sb-danger)' }}>{error}</span>
              <Button size="sm" onClick={() => void load()}>Retry</Button>
            </div>
          ) : null}

          {loading && boards.length === 0 ? (
            <div className="flex items-center justify-center py-24" role="status">
              <span className="sb-spinner" />
            </div>
          ) : boards.length === 0 ? (
            <div className="sb-empty">
              <div className="text-[15px] font-medium" style={{ color: 'var(--sb-ink)' }}>
                {debouncedSearch ? 'No matches' : 'Nothing here yet'}
              </div>
              <p className="max-w-[340px] text-[13px]">
                {debouncedSearch
                  ? 'Try a different search term or switch filters.'
                  : 'Create your first board to start sketching ideas with your team.'}
              </p>
              {!debouncedSearch ? (
                <Button variant="primary" className="mt-3" onClick={() => setCreateOpen(true)}>
                  Create a board
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-4">
                {boards.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    onFavorite={(item) =>
                      void mutate(
                        () => boardsApi.update(item.id, { isFavorite: !item.isFavorite }),
                        item.isFavorite ? 'Removed from starred' : 'Added to starred',
                      )
                    }
                    onDuplicate={async (item) => {
                      try {
                        const copy = await boardsApi.duplicate(item.id);
                        showToast('Board duplicated');
                        await load();
                        navigate(`/board/${copy.id}`);
                      } catch (cause) {
                        showToast(cause instanceof Error ? cause.message : 'Could not duplicate board.');
                      }
                    }}
                    onRemove={(item) =>
                      void mutate(() => boardsApi.remove(item.id), 'Board deleted')
                    }
                    onArchive={(item) =>
                      void mutate(
                        () => boardsApi.update(item.id, { isArchived: !item.isArchived }),
                        item.isArchived ? 'Board restored' : 'Board archived',
                      )
                    }
                    onRename={(item) => void rename(item)}
                    onShare={(item) => setShareBoard(item)}
                  />
                ))}
              </div>
              {nextCursor ? (
                <div className="mt-6 flex justify-center">
                  <Button onClick={() => void load(nextCursor, true)} disabled={loading}>
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="flex items-center gap-3 px-7 pb-6 pt-2 text-[11px]" style={{ color: 'var(--sb-muted)' }}>
          <Badge>Tip</Badge>
          <span>Press ⌘K to search · Hover a card for options</span>
        </footer>
      </main>

      <CreateBoardDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (input) => {
          const created = await boardsApi.create(input);
          await load();
          navigate(`/board/${created.id}`);
        }}
      />
      <ShareModal
        board={shareBoard}
        open={shareBoard !== null}
        onClose={() => setShareBoard(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}
