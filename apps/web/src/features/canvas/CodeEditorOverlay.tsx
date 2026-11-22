import { useEffect, useMemo, useRef } from 'react';
import type { CodeElement } from '@syncboard/shared';
import { useViewportStore } from '../../stores/useViewportStore';
import { CODE_TOKEN_COLORS, tokenizeCode } from './utils/codeHighlight';
import { worldToScreen } from './utils/geometry';

const LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'sql',
  'bash',
  'json',
  'yaml',
  'markdown',
  'plaintext',
] as const;

interface CodeEditorOverlayProps {
  element: CodeElement;
  onChange: (patch: Partial<Pick<CodeElement, 'text' | 'language' | 'title'>>) => void;
  onClose: () => void;
}

export function CodeEditorOverlay({ element, onChange, onClose }: CodeEditorOverlayProps) {
  const cameraX = useViewportStore((state) => state.x);
  const cameraY = useViewportStore((state) => state.y);
  const cameraScale = useViewportStore((state) => state.scale);
  const camera = useMemo(
    () => ({ x: cameraX, y: cameraY, scale: cameraScale }),
    [cameraX, cameraY, cameraScale],
  );
  const ref = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const screen = worldToScreen({ x: element.x, y: element.y }, camera);
  const width = Math.max(element.width, 320) * camera.scale;
  const height = Math.max(element.height, 200) * camera.scale;
  const highlighted = useMemo(
    () => tokenizeCode(element.text, element.language),
    [element.text, element.language],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 80);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="sb-panel pointer-events-auto absolute z-30 flex flex-col overflow-hidden p-0"
      style={{
        left: screen.x,
        top: screen.y,
        width,
        height,
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: 'top left',
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-2 py-1.5"
        style={{ borderColor: 'var(--sb-line)' }}
      >
        <input
          className="min-w-0 flex-1 border-none bg-transparent text-[12px] font-medium outline-none"
          value={element.title ?? ''}
          placeholder="Snippet title"
          aria-label="Code snippet title"
          onChange={(event) => onChange({ title: event.target.value })}
        />
        <select
          className="sb-input h-7 w-auto flex-none py-0 text-[11px]"
          value={element.language}
          aria-label="Code language"
          onChange={(event) => onChange({ language: event.target.value })}
        >
          {LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="sb-btn sb-btn--secondary h-7 flex-none px-2 text-[11px]"
          onClick={() => void navigator.clipboard.writeText(element.text)}
        >
          Copy
        </button>
        <button
          type="button"
          className="sb-icon-btn sb-icon-btn--sm"
          aria-label="Close code editor"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: '#18181B' }}>
        <pre
          ref={highlightRef}
          aria-hidden="true"
          className="sb-mono pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-3 text-[12px]"
          style={{ color: '#D4D4D8', lineHeight: 1.5, tabSize: 2 }}
        >
          {highlighted.map((tokens, lineIndex) => (
            <span key={lineIndex}>
              {tokens.map((token, column) => (
                <span key={column} style={{ color: CODE_TOKEN_COLORS[token.tone] }}>
                  {token.text}
                </span>
              ))}
              {lineIndex < highlighted.length - 1 ? '\n' : null}
            </span>
          ))}
        </pre>
        <textarea
          ref={ref}
          className="sb-code-input sb-mono absolute inset-0 h-full w-full resize-none overflow-auto border-none bg-transparent p-3 text-[12px] outline-none"
          style={{ lineHeight: 1.5, tabSize: 2 }}
          value={element.text}
          aria-label="Edit code snippet"
          spellCheck={false}
          wrap="off"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          onChange={(event) => onChange({ text: event.target.value })}
          onScroll={(event) => {
            const highlight = highlightRef.current;
            if (!highlight) return;
            highlight.scrollTop = event.currentTarget.scrollTop;
            highlight.scrollLeft = event.currentTarget.scrollLeft;
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
        />
      </div>
    </div>
  );
}
