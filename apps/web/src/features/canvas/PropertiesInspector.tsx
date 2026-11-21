import type { CanvasElement, ElementStyle } from '@syncboard/shared';
import { useToolStore } from '../../stores/useToolStore';
import { useCollab } from '../collab/CollabProvider';

const FILLS = ['transparent', '#FAF9F6', '#F5E9D2', '#DCE7EC', '#ECEAE5', '#2563EB', '#18181B'];
const STROKES = ['#18181B', '#71717A', '#2563EB', '#C2705D', '#5B8E7D', '#B08968', '#FFFFFF'];
const WIDTHS = [1, 2, 3, 5, 8];
const FONT_SIZES = [14, 18, 24, 32, 48];

const STYLE_TOOLS = new Set(['rectangle', 'ellipse', 'line', 'arrow', 'pen', 'text', 'sticky']);

interface PropertiesInspectorProps {
  selected: CanvasElement[];
}

export function PropertiesInspector({ selected }: PropertiesInspectorProps) {
  const tool = useToolStore((state) => state.tool);
  const style = useToolStore((state) => state.style);
  const setStyle = useToolStore((state) => state.setStyle);
  const { canWrite, upsertElements } = useCollab();

  const visible = selected.length > 0 || STYLE_TOOLS.has(tool);
  if (!visible) return null;

  const apply = (patch: Partial<ElementStyle>) => {
    setStyle(patch);
    if (!canWrite || selected.length === 0) return;
    const next = selected.map((element) => ({
      ...element,
      style: { ...element.style, ...patch },
      ...(patch.fontSize && (element.type === 'text' || element.type === 'sticky')
        ? element.type === 'text'
          ? { fontSize: patch.fontSize }
          : {}
        : {}),
      updatedAt: Date.now(),
    })) as CanvasElement[];
    upsertElements(next);
  };

  const current: ElementStyle = selected[0]?.style ?? style;

  return (
    <aside className="sb-panel pointer-events-auto absolute top-16 right-4 z-20 w-[220px] p-3 sb-fade-in">
      <div className="sb-label">Style</div>

      <div className="mb-3">
        <div className="mb-1.5 text-[11px] text-[var(--sb-secondary)]">Fill</div>
        <div className="flex flex-wrap gap-1.5">
          {FILLS.map((fill) => (
            <button
              key={fill}
              type="button"
              disabled={!canWrite}
              aria-label={`Fill ${fill}`}
              className="h-6 w-6 rounded-md border border-[var(--sb-line)]"
              style={{
                background:
                  fill === 'transparent'
                    ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                    : fill,
                outline: current.fill === fill ? '2px solid var(--sb-accent)' : undefined,
                outlineOffset: 1,
              }}
              onClick={() => apply({ fill })}
            />
          ))}
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-[11px] text-[var(--sb-secondary)]">Stroke</div>
        <div className="flex flex-wrap gap-1.5">
          {STROKES.map((stroke) => (
            <button
              key={stroke}
              type="button"
              disabled={!canWrite}
              aria-label={`Stroke ${stroke}`}
              className="h-6 w-6 rounded-md border border-[var(--sb-line)]"
              style={{
                background: stroke,
                outline: current.stroke === stroke ? '2px solid var(--sb-accent)' : undefined,
                outlineOffset: 1,
              }}
              onClick={() => apply({ stroke })}
            />
          ))}
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-[11px] text-[var(--sb-secondary)]">Width</div>
        <div className="flex gap-1">
          {WIDTHS.map((strokeWidth) => (
            <button
              key={strokeWidth}
              type="button"
              disabled={!canWrite}
              className="sb-btn sb-btn--sm flex-1"
              data-active={current.strokeWidth === strokeWidth || undefined}
              style={
                current.strokeWidth === strokeWidth
                  ? { background: 'var(--sb-accent-soft)', color: 'var(--sb-accent)' }
                  : undefined
              }
              onClick={() => apply({ strokeWidth })}
            >
              {strokeWidth}
            </button>
          ))}
        </div>
      </div>

      <label className="mb-3 flex items-center justify-between gap-2 text-[12px] text-[var(--sb-secondary)]">
        <span>Dashed</span>
        <input
          type="checkbox"
          checked={Boolean(current.dashed)}
          disabled={!canWrite}
          onChange={(event) => apply({ dashed: event.target.checked })}
        />
      </label>

      <div className="mb-3">
        <div className="mb-1.5 text-[11px] text-[var(--sb-secondary)]">Opacity</div>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          disabled={!canWrite}
          value={current.opacity}
          className="w-full"
          onChange={(event) => apply({ opacity: Number(event.target.value) })}
        />
      </div>

      {(tool === 'text' || tool === 'sticky' || selected.some((el) => el.type === 'text' || el.type === 'sticky')) && (
        <div>
          <div className="mb-1.5 text-[11px] text-[var(--sb-secondary)]">Font size</div>
          <div className="flex flex-wrap gap-1">
            {FONT_SIZES.map((fontSize) => (
              <button
                key={fontSize}
                type="button"
                disabled={!canWrite}
                className="sb-btn sb-btn--sm"
                style={
                  (current.fontSize ?? 18) === fontSize
                    ? { background: 'var(--sb-accent-soft)', color: 'var(--sb-accent)' }
                    : undefined
                }
                onClick={() => apply({ fontSize })}
              >
                {fontSize}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
