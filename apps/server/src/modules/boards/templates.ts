import { randomUUID } from 'node:crypto';
import * as Y from 'yjs';

export type BoardTemplate = 'blank' | 'architecture' | 'flowchart' | 'mindmap';

export const BOARD_TEMPLATES: readonly BoardTemplate[] = [
  'blank',
  'architecture',
  'flowchart',
  'mindmap',
];

interface TemplateElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: string;
  style: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    opacity: number;
    roughness: number;
  };
  locked: boolean;
  updatedAt: number;
  text?: string;
}

function element(
  type: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: string,
  text?: string,
): TemplateElement {
  const base: TemplateElement = {
    id: randomUUID(),
    type,
    x,
    y,
    width,
    height,
    rotation: 0,
    zIndex,
    style: {
      fill: '#FFFFFF',
      stroke: '#18181B',
      strokeWidth: 2,
      opacity: 1,
      roughness: 0,
    },
    locked: false,
    updatedAt: Date.now(),
  };
  if (text !== undefined) base.text = text;
  return base;
}

function withStyle(
  item: TemplateElement,
  fill: string,
  stroke: string,
): TemplateElement {
  return {
    ...item,
    style: { ...item.style, fill, stroke },
  };
}

function architectureElements(): TemplateElement[] {
  const client = withStyle(element('rectangle', 80, 160, 200, 110, 'a0', 'Client'), '#FFFFFF', '#18181B');
  const api = withStyle(element('rectangle', 400, 160, 210, 110, 'a1', 'API Gateway'), '#EFF4FF', '#2563EB');
  const service = withStyle(element('rectangle', 720, 90, 210, 100, 'a2', 'Service A'), '#FFFFFF', '#18181B');
  const store = withStyle(element('rectangle', 720, 250, 210, 100, 'a3', 'Database'), '#FFFFFF', '#18181B');
  return [
    client,
    api,
    service,
    store,
    element('arrow', 280, 215, 120, 2, 'a4'),
    element('arrow', 610, 195, 110, 55, 'a5'),
  ];
}

function flowchartElements(): TemplateElement[] {
  const start = withStyle(element('ellipse', 320, 60, 180, 80, 'b0', 'Start'), '#EFF4FF', '#2563EB');
  const input = element('rectangle', 320, 200, 180, 80, 'b1', 'Collect input');
  const decision = withStyle(element('diamond', 310, 340, 200, 100, 'b2', 'Valid?'), '#FFF9EC', '#9A6A4F');
  const end = element('ellipse', 320, 500, 180, 80, 'b3', 'Finish');
  return [
    start,
    input,
    decision,
    end,
    element('arrow', 410, 140, 0, 60, 'b4'),
    element('arrow', 410, 280, 0, 60, 'b5'),
    element('arrow', 410, 440, 0, 60, 'b6'),
  ];
}

function mindmapElements(): TemplateElement[] {
  const center = withStyle(element('ellipse', 380, 260, 220, 110, 'c0', 'Idea'), '#EFF4FF', '#2563EB');
  return [
    center,
    element('rectangle', 80, 100, 180, 70, 'c1', 'Research'),
    element('rectangle', 760, 100, 180, 70, 'c2', 'Design'),
    element('rectangle', 80, 460, 180, 70, 'c3', 'Build'),
    element('rectangle', 760, 460, 180, 70, 'c4', 'Launch'),
    element('arrow', 290, 290, 90, -90, 'c5'),
    element('arrow', 600, 290, 160, -90, 'c6'),
    element('arrow', 290, 330, 90, 110, 'c7'),
    element('arrow', 600, 330, 160, 110, 'c8'),
  ];
}

/** Build a canonical, compact Y.Doc binary state for a built-in template. */
export function buildTemplateState(template: BoardTemplate): Buffer {
  const doc = new Y.Doc();
  const elements = doc.getMap<Y.Map<unknown>>('elements');

  const source =
    template === 'architecture'
      ? architectureElements()
      : template === 'flowchart'
        ? flowchartElements()
        : template === 'mindmap'
          ? mindmapElements()
          : [];

  if (source.length > 0) {
    doc.transact(() => {
      for (const item of source) {
        const node = new Y.Map<unknown>();
        for (const [key, value] of Object.entries(item)) {
          node.set(key, value);
        }
        elements.set(item.id, node);
      }
    }, 'template-seed');
  }

  return Buffer.from(Y.encodeStateAsUpdate(doc));
}

/** Empty Y.Doc state used when no template content is available. */
export function emptyState(): Buffer {
  return Buffer.from(Y.encodeStateAsUpdate(new Y.Doc()));
}
