import { useState } from 'react';
import type { BoardTemplate } from '@syncboard/shared';
import { Button, Modal } from '../../components/ui';
import { cn } from '../../components/ui/cn';

const TEMPLATES: Array<{ id: BoardTemplate; label: string; hint: string }> = [
  { id: 'blank', label: 'Blank', hint: 'Start from an empty page' },
  { id: 'architecture', label: 'Architecture', hint: 'Services and boundaries' },
  { id: 'flowchart', label: 'Flowchart', hint: 'Decision paths' },
  { id: 'mindmap', label: 'Mind map', hint: 'Branching ideas' },
];

interface CreateBoardDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; template: BoardTemplate; folderName: string }) => Promise<void>;
}

export function CreateBoardDialog({ open, onClose, onCreate }: CreateBoardDialogProps) {
  const [title, setTitle] = useState('Untitled board');
  const [template, setTemplate] = useState<BoardTemplate>('blank');
  const [folderName, setFolderName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await onCreate({ title: title.trim() || 'Untitled board', template, folderName: folderName.trim() });
      setTitle('Untitled board');
      setTemplate('blank');
      setFolderName('');
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the board.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New board"
      description="Give it a name and pick a starting point."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Create board
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="sb-label" htmlFor="board-title">Title</label>
          <input
            id="board-title"
            className="sb-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
          />
        </div>
        <div>
          <label className="sb-label" htmlFor="board-folder">Folder <span className="normal-case tracking-normal">(optional)</span></label>
          <input
            id="board-folder"
            className="sb-input"
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="Product design"
            maxLength={120}
          />
        </div>
        <div>
          <span className="sb-label">Template</span>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={template === item.id}
                onClick={() => setTemplate(item.id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  template === item.id ? 'border-[var(--sb-accent)]' : 'hover:bg-[var(--sb-hover)]',
                )}
                style={{
                  borderColor: template === item.id ? 'var(--sb-accent)' : 'var(--sb-line)',
                  background: template === item.id ? 'var(--sb-accent-soft)' : 'var(--sb-surface)',
                }}
              >
                <div className="text-[13px] font-medium">{item.label}</div>
                <div className="mt-0.5 text-[11px]" style={{ color: 'var(--sb-secondary)' }}>
                  {item.hint}
                </div>
              </button>
            ))}
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-[12px]" style={{ color: 'var(--sb-danger)' }}>{error}</p>
        ) : null}
      </div>
    </Modal>
  );
}
