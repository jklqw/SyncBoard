import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type Konva from 'konva';
import { Stage } from 'react-konva';
import {
  expandRect,
  LIMITS,
  type ArrowElement,
  type CanvasElement,
  type FreehandElement,
  type LineElement,
  type Rect,
  type ToolId,
} from '@syncboard/shared';
import { boardsApi } from '../../app/api';
import { useToolStore } from '../../stores/useToolStore';
import { useUiStore } from '../../stores/useUiStore';
import { cameraOf, useViewportStore } from '../../stores/useViewportStore';
import { useCollab } from '../collab/CollabProvider';
import { ActiveElementsLayer, type TransformResult } from './layers/ActiveElementsLayer';
import { GridLayer } from './layers/GridLayer';
import { OverlayLayer } from './layers/OverlayLayer';
import { StaticElementsLayer } from './layers/StaticElementsLayer';
import { TextEditorOverlay } from './TextEditorOverlay';
import { recomputeBoundArrows, snapEndpoint } from './utils/connectors';
import { createElement, duplicateElement, newId, nextZIndex } from './utils/elementFactory';
import {
  elementsIntersect,
  normalizeRect,
  screenToWorld,
  selectionBounds,
  type Point2D,
} from './utils/geometry';

interface CanvasStageProps {
  boardId: string;
  stageRef: RefObject<Konva.Stage | null>;
}

type DraftState =
  | { kind: 'marquee'; start: Point2D; current: Point2D }
  | { kind: 'shape'; element: CanvasElement }
  | { kind: 'pen'; element: FreehandElement }
  | { kind: 'pan'; last: Point2D }
  | { kind: 'eraser' }
  | null;

const DRAW_TOOLS = new Set<ToolId>([
  'rectangle',
  'ellipse',
  'line',
  'arrow',
  'pen',
  'text',
  'sticky',
  'image',
]);

function snapPoint(point: Point2D, enabled: boolean): Point2D {
  if (!enabled) return point;
  const g = LIMITS.GRID_SIZE;
  return { x: Math.round(point.x / g) * g, y: Math.round(point.y / g) * g };
}

function applyTransform(element: CanvasElement, attrs: TransformResult): CanvasElement {
  const scaleX = attrs.scaleX || 1;
  const scaleY = attrs.scaleY || 1;
  const width = Math.max(Math.abs(attrs.width * scaleX), 1);
  const height = Math.max(Math.abs(attrs.height * scaleY), 1);

  if (element.type === 'line' || element.type === 'arrow' || element.type === 'freehand') {
    const points = element.points.map((point) => ({
      ...point,
      x: point.x * scaleX,
      y: point.y * scaleY,
    }));
    return {
      ...element,
      x: attrs.x,
      y: attrs.y,
      width,
      height,
      rotation: attrs.rotation,
      points,
      updatedAt: Date.now(),
    } as CanvasElement;
  }

  return {
    ...element,
    x: attrs.x,
    y: attrs.y,
    width,
    height,
    rotation: attrs.rotation,
    updatedAt: Date.now(),
  } as CanvasElement;
}

function eraseAt(
  world: Point2D,
  spatialIndex: { search: (rect: Rect) => Array<{ id: string }> },
  removeElements: (ids: string[]) => void,
): void {
  const hits = spatialIndex.search({
    minX: world.x - 10,
    minY: world.y - 10,
    maxX: world.x + 10,
    maxY: world.y + 10,
  });
  if (hits.length) removeElements(hits.map((hit) => hit.id));
}

export function CanvasStage({ boardId, stageRef }: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spaceHeld = useRef(false);
  const [draft, setDraft] = useState<DraftState>(null);
  const [guides] = useState<Array<{ axis: 'x' | 'y'; value: number; from: number; to: number }>>(
    [],
  );

  const cameraX = useViewportStore((state) => state.x);
  const cameraY = useViewportStore((state) => state.y);
  const cameraScale = useViewportStore((state) => state.scale);
  const camera = useMemo(
    () => ({ x: cameraX, y: cameraY, scale: cameraScale }),
    [cameraX, cameraY, cameraScale],
  );
  const width = useViewportStore((state) => state.width);
  const height = useViewportStore((state) => state.height);
  const setSize = useViewportStore((state) => state.setSize);
  const panBy = useViewportStore((state) => state.panBy);
  const zoomAt = useViewportStore((state) => state.zoomAt);
  const setCamera = useViewportStore((state) => state.setCamera);
  const fit = useViewportStore((state) => state.fit);

  const tool = useToolStore((state) => state.tool);
  const style = useToolStore((state) => state.style);
  const selection = useToolStore((state) => state.selection);
  const editingId = useToolStore((state) => state.editingId);
  const clipboard = useToolStore((state) => state.clipboard);
  const lockedAspect = useToolStore((state) => state.lockedAspect);
  const snapToGrid = useToolStore((state) => state.snapToGrid);
  const setTool = useToolStore((state) => state.setTool);
  const setSelection = useToolStore((state) => state.setSelection);
  const clearSelection = useToolStore((state) => state.clearSelection);
  const setEditingId = useToolStore((state) => state.setEditingId);
  const setClipboard = useToolStore((state) => state.setClipboard);
  const toggleSelection = useToolStore((state) => state.toggleSelection);

  const {
    elements,
    spatialIndex,
    upsertElements,
    removeElements,
    canWrite,
    undo,
    redo,
    peers,
    remoteCursors,
    presenter,
    setCursor,
    setSelection: setPresenceSelection,
    setTool: setPresenceTool,
    broadcastViewport,
  } = useCollab();

  const followingName = useUiStore((state) => state.followingName);
  const setFollowingName = useUiStore((state) => state.setFollowingName);
  const modal = useUiStore((state) => state.modal);
  const setCommentDraft = useUiStore((state) => state.setCommentDraft);
  const showToast = useUiStore((state) => state.showToast);

  const elementsById = useMemo(() => new Map(elements.map((el) => [el.id, el])), [elements]);
  const selectedElements = useMemo(
    () =>
      selection.map((id) => elementsById.get(id)).filter((el): el is CanvasElement => Boolean(el)),
    [selection, elementsById],
  );
  const editingElement = editingId ? (elementsById.get(editingId) ?? null) : null;

  const viewportWorld = useMemo(
    () =>
      expandRect(
        {
          minX: (0 - camera.x) / camera.scale,
          minY: (0 - camera.y) / camera.scale,
          maxX: (width - camera.x) / camera.scale,
          maxY: (height - camera.y) / camera.scale,
        },
        128 / camera.scale,
      ),
    [camera.x, camera.y, camera.scale, width, height],
  );

  const visibleIds = useMemo(() => {
    const hits = spatialIndex.search(viewportWorld);
    return new Set(hits.map((hit) => hit.id));
  }, [spatialIndex, viewportWorld, elements]);

  const draftElementId =
    draft && (draft.kind === 'shape' || draft.kind === 'pen') ? draft.element.id : null;

  const staticVisible = useMemo(
    () =>
      elements.filter(
        (element) =>
          visibleIds.has(element.id) &&
          !selection.includes(element.id) &&
          element.id !== draftElementId,
      ),
    [elements, visibleIds, selection, draftElementId],
  );

  const activeVisible = useMemo(() => {
    const selected = selectedElements.filter(
      (element) => visibleIds.has(element.id) || selection.includes(element.id),
    );
    if (draft && (draft.kind === 'shape' || draft.kind === 'pen')) {
      return [...selected.filter((el) => el.id !== draft.element.id), draft.element];
    }
    return selected;
  }, [selectedElements, visibleIds, selection, draft]);

  const marquee: Rect | null =
    draft?.kind === 'marquee' ? normalizeRect(draft.start, draft.current) : null;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(node);
    setSize(node.clientWidth, node.clientHeight);
    return () => observer.disconnect();
  }, [setSize]);

  useEffect(() => {
    setPresenceTool(tool);
  }, [tool, setPresenceTool]);

  useEffect(() => {
    setPresenceSelection(selection);
  }, [selection, setPresenceSelection]);

  useEffect(() => {
    if (!followingName || !presenter?.viewport) return;
    setCamera(presenter.viewport);
  }, [followingName, presenter?.viewport, setCamera]);

  useEffect(() => {
    broadcastViewport(cameraOf(useViewportStore.getState()));
  }, [camera.x, camera.y, camera.scale, broadcastViewport]);

  const commitElements = useCallback(
    (next: CanvasElement[], changedIds?: string[]) => {
      if (!canWrite || next.length === 0) return;
      const merged = [...elements.filter((el) => !next.some((n) => n.id === el.id)), ...next];
      const arrows = recomputeBoundArrows(merged, new Set(changedIds ?? next.map((el) => el.id)));
      upsertElements([...next, ...arrows]);
    },
    [canWrite, elements, upsertElements],
  );

  const handleTransformEnd = useCallback(
    (id: string, attrs: TransformResult) => {
      const element = elementsById.get(id);
      if (!element || !canWrite) return;
      const node = stageRef.current?.findOne(`#el-${id}`);
      if (node) {
        node.scaleX(1);
        node.scaleY(1);
        node.width(Math.max(Math.abs(attrs.width * (attrs.scaleX || 1)), 1));
        node.height(Math.max(Math.abs(attrs.height * (attrs.scaleY || 1)), 1));
      }
      commitElements([applyTransform(element, attrs)], [id]);
    },
    [elementsById, canWrite, stageRef, commitElements],
  );

  const openEditor = useCallback(
    (id: string) => {
      if (!canWrite) return;
      const element = elementsById.get(id);
      if (!element || (element.type !== 'text' && element.type !== 'sticky')) return;
      setEditingId(id);
      setSelection([id]);
    },
    [canWrite, elementsById, setEditingId, setSelection],
  );

  const selectElement = useCallback(
    (id: string, additive: boolean) => {
      if (tool !== 'select') return;
      if (additive) toggleSelection(id);
      else setSelection([id]);
    },
    [tool, toggleSelection, setSelection],
  );

  const pointerWorld = useCallback(
    (
      event: Konva.KonvaEventObject<PointerEvent | MouseEvent | TouchEvent | WheelEvent>,
    ): Point2D => {
      const stage = event.target.getStage() ?? stageRef.current;
      const pos = stage?.getPointerPosition() ?? { x: 0, y: 0 };
      return snapPoint(screenToWorld(pos, useViewportStore.getState()), snapToGrid);
    },
    [stageRef, snapToGrid],
  );

  const onWheel = useCallback(
    (event: Konva.KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      if (event.evt.ctrlKey || event.evt.metaKey) {
        zoomAt(pointer.x, pointer.y, event.evt.deltaY > 0 ? 0.9 : 1.1);
      } else {
        panBy(-event.evt.deltaX, -event.evt.deltaY);
      }
    },
    [stageRef, zoomAt, panBy],
  );

  const onPointerDown = useCallback(
    (event: Konva.KonvaEventObject<PointerEvent>) => {
      if (followingName) {
        setFollowingName(null);
        return;
      }

      const world = pointerWorld(event);
      setCursor(world);

      const isMiddle = event.evt.button === 1;
      const isPan = tool === 'hand' || spaceHeld.current || isMiddle;

      if (modal === 'comments' && event.evt.button === 0 && !isPan) {
        setCommentDraft({ x: world.x, y: world.y, elementId: null });
        return;
      }

      if (isPan) {
        setDraft({ kind: 'pan', last: { x: event.evt.clientX, y: event.evt.clientY } });
        return;
      }

      if (tool === 'select') {
        if (event.target === event.target.getStage()) {
          if (!event.evt.shiftKey) clearSelection();
          setDraft({ kind: 'marquee', start: world, current: world });
        }
        return;
      }

      if (!canWrite) return;

      if (tool === 'eraser') {
        eraseAt(world, spatialIndex, removeElements);
        setDraft({ kind: 'eraser' });
        return;
      }

      if (tool === 'image') {
        fileInputRef.current?.click();
        return;
      }

      if (tool === 'text' || tool === 'sticky') {
        const element = createElement(tool, {
          style: tool === 'sticky' ? { ...style, fill: '#F5E9D2' } : style,
          start: world,
          zIndex: nextZIndex(elements),
        });
        upsertElements([element]);
        setSelection([element.id]);
        setTool('select');
        setEditingId(element.id);
        return;
      }

      if (tool === 'pen') {
        const element = createElement('freehand', {
          style,
          start: world,
          zIndex: nextZIndex(elements),
        }) as FreehandElement;
        setDraft({ kind: 'pen', element });
        clearSelection();
        return;
      }

      if (tool === 'rectangle' || tool === 'ellipse' || tool === 'line' || tool === 'arrow') {
        const element = createElement(tool, {
          style,
          start: world,
          zIndex: nextZIndex(elements),
        });
        setDraft({ kind: 'shape', element });
        clearSelection();
      }
    },
    [
      followingName,
      setFollowingName,
      pointerWorld,
      setCursor,
      tool,
      modal,
      setCommentDraft,
      canWrite,
      clearSelection,
      spatialIndex,
      removeElements,
      style,
      elements,
      upsertElements,
      setSelection,
      setTool,
      setEditingId,
    ],
  );

  const onPointerMove = useCallback(
    (event: Konva.KonvaEventObject<PointerEvent>) => {
      const world = pointerWorld(event);
      setCursor(world);

      if (!draft) return;

      if (draft.kind === 'eraser') {
        if (canWrite) eraseAt(world, spatialIndex, removeElements);
        return;
      }

      if (draft.kind === 'pan') {
        panBy(event.evt.clientX - draft.last.x, event.evt.clientY - draft.last.y);
        setDraft({ kind: 'pan', last: { x: event.evt.clientX, y: event.evt.clientY } });
        return;
      }

      if (draft.kind === 'marquee') {
        setDraft({ ...draft, current: world });
        return;
      }

      if (draft.kind === 'pen') {
        const points = [
          ...draft.element.points,
          { x: world.x - draft.element.x, y: world.y - draft.element.y },
        ];
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        setDraft({
          kind: 'pen',
          element: {
            ...draft.element,
            points,
            width: Math.max(...xs, 0) - Math.min(...xs, 0),
            height: Math.max(...ys, 0) - Math.min(...ys, 0),
            updatedAt: Date.now(),
          },
        });
        return;
      }

      if (draft.kind === 'shape') {
        const start = { x: draft.element.x, y: draft.element.y };
        let end = world;
        if (lockedAspect || event.evt.shiftKey) {
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          end = {
            x: start.x + Math.sign(dx || 1) * size,
            y: start.y + Math.sign(dy || 1) * size,
          };
        }

        if (draft.element.type === 'arrow') {
          const snappedStart = snapEndpoint(start, elements, draft.element.id);
          const snappedEnd = snapEndpoint(end, elements, draft.element.id);
          const origin = snappedStart.binding ? snappedStart.point : start;
          const endPoint = snappedEnd.point;
          const next: ArrowElement = {
            ...draft.element,
            type: 'arrow',
            x: origin.x,
            y: origin.y,
            width: Math.abs(endPoint.x - origin.x),
            height: Math.abs(endPoint.y - origin.y),
            points: [
              { x: 0, y: 0 },
              { x: endPoint.x - origin.x, y: endPoint.y - origin.y },
            ],
            startBinding: snappedStart.binding,
            endBinding: snappedEnd.binding,
            updatedAt: Date.now(),
          };
          setDraft({ kind: 'shape', element: next });
          return;
        }

        if (draft.element.type === 'line') {
          const next: LineElement = {
            ...(draft.element as LineElement),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y),
            points: [
              { x: 0, y: 0 },
              { x: end.x - start.x, y: end.y - start.y },
            ],
            updatedAt: Date.now(),
          };
          setDraft({ kind: 'shape', element: next });
          return;
        }

        const rect = normalizeRect(start, end);
        setDraft({
          kind: 'shape',
          element: {
            ...draft.element,
            x: rect.minX,
            y: rect.minY,
            width: rect.maxX - rect.minX,
            height: rect.maxY - rect.minY,
            updatedAt: Date.now(),
          },
        });
      }
    },
    [
      draft,
      pointerWorld,
      setCursor,
      canWrite,
      spatialIndex,
      removeElements,
      panBy,
      lockedAspect,
      elements,
    ],
  );

  const onPointerUp = useCallback(() => {
    if (!draft) return;

    if (draft.kind === 'pan' || draft.kind === 'eraser') {
      setDraft(null);
      return;
    }

    if (draft.kind === 'marquee') {
      const rect = normalizeRect(draft.start, draft.current);
      if ((rect.maxX - rect.minX) * (rect.maxY - rect.minY) > 4) {
        setSelection(elementsIntersect(rect, elements));
      }
      setDraft(null);
      return;
    }

    if (!canWrite) {
      setDraft(null);
      return;
    }

    if (draft.kind === 'pen') {
      // Keep the pen active so several strokes can be drawn in a row.
      if (draft.element.points.length >= 2) {
        upsertElements([draft.element]);
      }
      setDraft(null);
      return;
    }

    if (draft.kind === 'shape') {
      const el = draft.element;
      const tooSmall = Math.abs(el.width) < 2 && Math.abs(el.height) < 2;
      if (!tooSmall || el.type === 'line' || el.type === 'arrow') {
        upsertElements([el]);
        setSelection([el.id]);
      }
      setDraft(null);
      setTool('select');
    }
  }, [draft, elements, setSelection, canWrite, upsertElements, setTool]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (event.code === 'Space') {
        spaceHeld.current = true;
        event.preventDefault();
        return;
      }

      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (meta && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (canWrite) undo();
        return;
      }
      if (meta && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        if (canWrite) redo();
        return;
      }

      if (key === 'v') setTool('select');
      if (key === 'h') setTool('hand');
      if (key === 'r' && canWrite) setTool('rectangle');
      if (key === 'o' && canWrite) setTool('ellipse');
      if (key === 'l' && canWrite) setTool('line');
      if (key === 'a' && canWrite) setTool('arrow');
      if (key === 'p' && canWrite) setTool('pen');
      if (key === 'e' && canWrite) setTool('eraser');
      if (key === 't' && canWrite) setTool('text');
      if (key === 's' && canWrite && !meta) setTool('sticky');
      if (key === 'i' && canWrite) setTool('image');

      if (key === 'escape') {
        clearSelection();
        setEditingId(null);
        setDraft(null);
        setTool('select');
      }

      if ((key === 'delete' || key === 'backspace') && canWrite && selection.length) {
        event.preventDefault();
        removeElements(selection);
        clearSelection();
      }

      if (meta && key === 'c' && selection.length) {
        event.preventDefault();
        setClipboard(selectedElements.map((el) => ({ ...el })));
      }

      if (meta && key === 'v' && canWrite && clipboard.length) {
        event.preventDefault();
        let z = nextZIndex(elements);
        const copies = clipboard.map((el, index) => {
          const copy = duplicateElement(el, 24, 24, z);
          z = `${copy.zIndex}${index}`;
          return copy;
        });
        upsertElements(copies);
        setSelection(copies.map((el) => el.id));
      }

      if (meta && key === 'd' && canWrite && selectedElements.length) {
        event.preventDefault();
        let z = nextZIndex(elements);
        const copies = selectedElements.map((el, index) => {
          const copy = duplicateElement(el, 24, 24, z);
          z = `${copy.zIndex}${index}`;
          return copy;
        });
        upsertElements(copies);
        setSelection(copies.map((el) => el.id));
      }

      if (meta && key === 'g' && canWrite && selectedElements.length >= 2) {
        event.preventDefault();
        if (event.shiftKey) {
          upsertElements(
            selectedElements.map((el) => ({ ...el, groupId: null, updatedAt: Date.now() })),
          );
        } else {
          const groupId = newId();
          upsertElements(selectedElements.map((el) => ({ ...el, groupId, updatedAt: Date.now() })));
        }
      }

      if (key === '[' && canWrite && selectedElements.length) {
        const sorted = [...elements].sort((a, b) => a.zIndex.localeCompare(b.zIndex));
        const updates: CanvasElement[] = [];
        for (const el of selectedElements) {
          const index = sorted.findIndex((item) => item.id === el.id);
          if (index <= 0) continue;
          const prev = sorted[index - 1]!;
          updates.push({ ...el, zIndex: prev.zIndex, updatedAt: Date.now() });
          updates.push({ ...prev, zIndex: el.zIndex, updatedAt: Date.now() });
        }
        if (updates.length) upsertElements(updates);
      }

      if (key === ']' && canWrite && selectedElements.length) {
        const sorted = [...elements].sort((a, b) => a.zIndex.localeCompare(b.zIndex));
        const updates: CanvasElement[] = [];
        for (const el of selectedElements) {
          const index = sorted.findIndex((item) => item.id === el.id);
          if (index < 0 || index >= sorted.length - 1) continue;
          const next = sorted[index + 1]!;
          updates.push({ ...el, zIndex: next.zIndex, updatedAt: Date.now() });
          updates.push({ ...next, zIndex: el.zIndex, updatedAt: Date.now() });
        }
        if (updates.length) upsertElements(updates);
      }

      if (event.shiftKey && key === '1') {
        event.preventDefault();
        const bounds = selectionBounds(elements);
        if (bounds) fit(bounds);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeld.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    canWrite,
    undo,
    redo,
    setTool,
    clearSelection,
    setEditingId,
    selection,
    removeElements,
    selectedElements,
    setClipboard,
    clipboard,
    elements,
    upsertElements,
    setSelection,
    fit,
  ]);

  async function onImageSelected(file: File): Promise<void> {
    if (!canWrite) return;
    try {
      const uploaded = await boardsApi.upload(boardId, file);
      const cameraState = useViewportStore.getState();
      const center = screenToWorld(
        { x: cameraState.width / 2, y: cameraState.height / 2 },
        cameraState,
      );
      const element = createElement('image', {
        style,
        start: { x: center.x - uploaded.width / 2, y: center.y - uploaded.height / 2 },
        zIndex: nextZIndex(elements),
        src: uploaded.url,
        assetId: uploaded.id,
      });
      const sized = { ...element, width: uploaded.width, height: uploaded.height } as CanvasElement;
      upsertElements([sized]);
      setSelection([sized.id]);
      setTool('select');
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Image upload failed.');
    }
  }

  const cursor =
    tool === 'hand' || draft?.kind === 'pan'
      ? 'grab'
      : tool === 'eraser'
        ? 'cell'
        : DRAW_TOOLS.has(tool)
          ? 'crosshair'
          : 'default';

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-[var(--sb-canvas)]"
      style={{ cursor }}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        x={camera.x}
        y={camera.y}
        scaleX={camera.scale}
        scaleY={camera.scale}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <GridLayer camera={camera} width={width} height={height} />
        <StaticElementsLayer
          elements={staticVisible}
          interactive={tool === 'select'}
          onSelect={selectElement}
          onOpenEditor={openEditor}
        />
        <ActiveElementsLayer
          elements={activeVisible}
          stageRef={stageRef}
          draggable={canWrite && tool === 'select'}
          onTransformEnd={handleTransformEnd}
        />
        <OverlayLayer
          marquee={marquee}
          guides={guides}
          peers={peers}
          remoteCursors={remoteCursors}
          elements={elements}
          scale={camera.scale}
        />
      </Stage>

      {editingElement ? (
        <TextEditorOverlay
          element={editingElement}
          onChange={(text) => {
            if (!canWrite) return;
            upsertElements([{ ...editingElement, text, updatedAt: Date.now() } as CanvasElement]);
          }}
          onClose={() => setEditingId(null)}
        />
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void onImageSelected(file);
        }}
      />
    </div>
  );
}
