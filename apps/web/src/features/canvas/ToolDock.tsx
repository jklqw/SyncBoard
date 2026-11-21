import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  Circle,
  Eraser,
  Hand,
  Image as ImageIcon,
  Minus,
  MousePointer2,
  Pen,
  Square,
  StickyNote,
  Type,
} from 'lucide-react';
import type { ToolId } from '@syncboard/shared';
import { IconButton } from '../../components/ui';
import { useToolStore } from '../../stores/useToolStore';
import { useCollab } from '../collab/CollabProvider';

const TOOLS: Array<{ id: ToolId; label: string; shortcut: string; icon: ReactNode }> = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: <MousePointer2 size={16} /> },
  { id: 'hand', label: 'Hand', shortcut: 'H', icon: <Hand size={16} /> },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: <Square size={16} /> },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: <Circle size={16} /> },
  { id: 'line', label: 'Line', shortcut: 'L', icon: <Minus size={16} /> },
  { id: 'arrow', label: 'Arrow', shortcut: 'A', icon: <ArrowUpRight size={16} /> },
  { id: 'pen', label: 'Pen', shortcut: 'P', icon: <Pen size={16} /> },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: <Eraser size={16} /> },
  { id: 'text', label: 'Text', shortcut: 'T', icon: <Type size={16} /> },
  { id: 'sticky', label: 'Sticky', shortcut: 'S', icon: <StickyNote size={16} /> },
  { id: 'image', label: 'Image', shortcut: 'I', icon: <ImageIcon size={16} /> },
];

export function ToolDock() {
  const tool = useToolStore((state) => state.tool);
  const setTool = useToolStore((state) => state.setTool);
  const { canWrite, setTool: setPresenceTool } = useCollab();

  return (
    <div className="sb-pill pointer-events-auto absolute bottom-5 left-1/2 z-20 -translate-x-1/2 px-1.5 py-1">
      {TOOLS.map((entry) => {
        const disabled = !canWrite && entry.id !== 'select' && entry.id !== 'hand';
        return (
          <IconButton
            key={entry.id}
            label={entry.label}
            shortcut={entry.shortcut}
            icon={entry.icon}
            active={tool === entry.id}
            disabled={disabled}
            onClick={() => {
              setTool(entry.id);
              setPresenceTool(entry.id);
            }}
          />
        );
      })}
    </div>
  );
}
