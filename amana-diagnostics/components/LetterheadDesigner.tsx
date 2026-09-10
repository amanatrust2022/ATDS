'use client';
/**
 * Free-form letterhead design canvas.
 *
 * A fixed-width (A4-ish) canvas onto which the user drops text boxes, images,
 * lines and shapes, then drags / resizes / rotates and layers them freely —
 * the way a logo or a designed letterhead header is actually built.
 *
 * OUTPUT is plain absolutely-positioned <div>/<img> with inline styles inside a
 * marked container. That survives lib/sanitizeHtml.ts (which strips <svg> and
 * data-* but keeps position/transform/border-radius/clip-path) and therefore
 * prints and previews identically to what is designed here.
 *
 * Legacy letterheads (authored in the old flow editor) are imported as a single
 * full-width text block so nothing is lost; the user can then rearrange.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  RiText, RiImageAddLine, RiSeparator, RiSquareLine, RiCircleLine, RiTriangleLine,
  RiDeleteBinLine, RiBringToFront, RiSendToBack, RiBold, RiItalic, RiUnderline,
  RiAlignLeft, RiAlignCenter, RiAlignRight, RiShapesLine, RiFileCopyLine,
  RiPentagonLine, RiHexagonLine, RiStarLine, RiVipDiamondLine,
  RiArrowGoBackLine, RiArrowGoForwardLine, RiFocus3Line,
  RiAlignItemLeftLine, RiAlignItemHorizontalCenterLine, RiAlignItemRightLine,
  RiAlignItemTopLine, RiAlignItemVerticalCenterLine, RiAlignItemBottomLine,
  RiUploadCloud2Line,
} from '@remixicon/react';

// ── Canvas geometry ──────────────────────────────────────────────────────────
// Kept within the printable width of the A4 report (≈753px inside its @page
// margins) so the design never overflows the page.
const CANVAS_W = 740;
const DEFAULT_H = 220;
const MIN = 8;

type ElType =
  | 'text' | 'image' | 'line' | 'rect' | 'circle'
  | 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'star';

// Shapes drawn with a CSS clip-path polygon. `clip-path` survives the letterhead
// sanitiser, so these print identically to the canvas. `circle`/`rect` are not
// here — they use border-radius (and can therefore carry a real CSS border).
const CLIP: Partial<Record<ElType, string>> = {
  triangle: 'polygon(50% 0%, 0% 100%, 100% 100%)',
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  pentagon: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
  hexagon: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
};
// Every element type that is a filled shape (fill colour applies, text does not).
const FILLED = new Set<ElType>(['line', 'rect', 'circle', ...(Object.keys(CLIP) as ElType[])]);
// Shapes whose outline is a real CSS border (clip-path shapes can't carry one).
const BORDERABLE = new Set<ElType>(['rect', 'circle', 'image']);

interface El {
  id: string;
  type: ElType;
  x: number; y: number; w: number; h: number; rot: number;
  z: number;
  opacity: number;
  fill: string;
  borderColor: string;
  borderWidth: number;
  radius: number;
  // text-only
  content: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
  ph?: boolean; // still the untouched placeholder — cleared on first real edit
  // image-only. The box (w,h) is a crop window; the picture is drawn at iw×ih
  // and offset by (ox,oy), so resizing the box crops rather than scaling.
  src: string;
  iw: number; ih: number; ox: number; oy: number; nar: number; // display w/h, crop offset, natural aspect (h/w)
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  defaultHeight?: number; // starting canvas height when empty (footer strips want a small one)
}

const FONTS = [
  "'Times New Roman', Times, serif",
  'Arial, Helvetica, sans-serif',
  'Georgia, serif',
  'Calibri, Candara, sans-serif',
  "'Courier New', Courier, monospace",
  'Verdana, Geneva, sans-serif',
];

let seq = 0;
const uid = () => `el_${Date.now().toString(36)}_${(seq++).toString(36)}`;

// Turn a picked file into a raster image (data URL + pixel size). Images load
// directly; a PDF has its first page rendered to a canvas at 2× for crisp print.
async function fileToImage(file: File): Promise<{ src: string; w: number; h: number }> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) {
    const pdfjs: any = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const data = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
    return { src: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height };
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => resolve({ src, w: img.width, h: img.height });
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = src;
    };
    reader.onerror = () => reject(new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

function baseEl(type: ElType, z: number): El {
  return {
    id: uid(), type, x: 60, y: 60, w: 160, h: 90, rot: 0, z, opacity: 1,
    fill: '#4472c4', borderColor: '#000000', borderWidth: 0, radius: 0,
    content: 'Text', color: '#0f172a', fontSize: 24, fontFamily: FONTS[0],
    bold: false, italic: false, underline: false, align: 'center', src: '',
    iw: 0, ih: 0, ox: 0, oy: 0, nar: 1,
  };
}

// ── Serialisation ────────────────────────────────────────────────────────────
function elStyle(e: El): string {
  const parts = [
    'position:absolute',
    `left:${round(e.x)}px`, `top:${round(e.y)}px`,
    `width:${round(e.w)}px`, `height:${round(e.h)}px`,
    'box-sizing:border-box',
  ];
  if (e.rot) parts.push(`transform:rotate(${round(e.rot)}deg)`);
  if (e.opacity !== 1) parts.push(`opacity:${e.opacity}`);
  parts.push(`z-index:${e.z}`);

  if (e.type === 'text') {
    parts.push(`color:${e.color}`, `font-size:${e.fontSize}px`, `font-family:${e.fontFamily}`,
      `font-weight:${e.bold ? 700 : 400}`, `font-style:${e.italic ? 'italic' : 'normal'}`,
      `text-decoration:${e.underline ? 'underline' : 'none'}`, `text-align:${e.align}`,
      'line-height:1.25', 'overflow:visible', 'white-space:pre-wrap');
  } else if (e.type === 'image') {
    // The box is a crop window over the picture.
    parts.push('overflow:hidden');
    if (e.borderWidth) parts.push(`border:${e.borderWidth}px solid ${e.borderColor}`);
    if (e.radius) parts.push(`border-radius:${e.radius}px`);
  } else if (e.type === 'line') {
    parts.push(`background:${e.fill}`);
  } else if (e.type === 'rect') {
    parts.push(`background:${e.fill}`, `border-radius:${e.radius}px`);
    if (e.borderWidth) parts.push(`border:${e.borderWidth}px solid ${e.borderColor}`);
  } else if (e.type === 'circle') {
    parts.push(`background:${e.fill}`, 'border-radius:50%');
    if (e.borderWidth) parts.push(`border:${e.borderWidth}px solid ${e.borderColor}`);
  } else if (CLIP[e.type]) {
    parts.push(`background:${e.fill}`, `clip-path:${CLIP[e.type]}`);
  }
  return parts.join(';');
}

// Display size / offset for an image's inner picture, falling back to the box
// (older images saved before cropping existed had no iw/ih).
function imgDisplay(e: El) {
  const iw = e.iw || e.w, ih = e.ih || e.h;
  return { iw: round(iw), ih: round(ih), ox: round(e.ox || 0), oy: round(e.oy || 0) };
}

function serialize(els: El[], height: number): string {
  if (els.length === 0) return '';
  const children = [...els].sort((a, b) => a.z - b.z).map((e) => {
    if (e.type === 'image') {
      const { iw, ih, ox, oy } = imgDisplay(e);
      const imgStyle = `position:absolute;left:${-ox}px;top:${-oy}px;width:${iw}px;height:${ih}px;max-width:none;display:block`;
      return `<div data-type="image" data-shape="1" style="${elStyle(e)}"><img src="${escapeAttr(e.src)}" style="${imgStyle}" alt="" /></div>`;
    }
    const inner = e.type === 'text' ? e.content : '';
    // Shapes are empty divs; `data-shape` stops cleanLetterhead's "trailing empty
    // element" tidier from deleting them before they reach the page.
    const shapeMark = e.type === 'text' ? '' : ' data-shape="1"';
    return `<div data-type="${e.type}"${shapeMark} style="${elStyle(e)}">${inner}</div>`;
  }).join('');
  return `<div data-letterhead-canvas="1" style="position:relative;width:${CANVAS_W}px;height:${round(height)}px;margin:0 auto">${children}</div>`;
}

const escapeAttr = (v: string) => (v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const round = (n: number) => Math.round(n * 10) / 10;

function styleVal(style: string, prop: string): string {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(style || '');
  return m ? m[1].trim() : '';
}
const px = (v: string, d = 0) => { const n = parseFloat(v); return isNaN(n) ? d : n; };

// Rebuild the element model from previously-saved canvas HTML, or import a
// legacy flow letterhead as a single full-width text block.
function deserialize(value: string, defaultH: number = DEFAULT_H): { els: El[]; height: number } {
  const html = (value || '').trim();
  if (!html) return { els: [], height: defaultH };
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return { els: [], height: defaultH };

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const container = doc.querySelector('[data-letterhead-canvas]') as HTMLElement | null;

  if (!container) {
    // Legacy letterhead → one text block spanning the canvas.
    const legacy = baseEl('text', 1);
    legacy.x = 0; legacy.y = 16; legacy.w = CANVAS_W; legacy.h = defaultH - 32;
    legacy.content = html;
    legacy.align = 'center';
    return { els: [legacy], height: defaultH };
  }

  const height = px(styleVal(container.getAttribute('style') || '', 'height'), defaultH);
  const els: El[] = [];
  Array.from(container.children).forEach((node, i) => {
    const el = node as HTMLElement;
    const s = el.getAttribute('style') || '';
    const type = (el.getAttribute('data-type') as ElType) ||
      (el.tagName.toLowerCase() === 'img' ? 'image' : styleVal(s, 'border-radius') === '50%' ? 'circle' : 'rect');
    const e = baseEl(type, i + 1);
    e.x = px(styleVal(s, 'left')); e.y = px(styleVal(s, 'top'));
    e.w = px(styleVal(s, 'width'), 100); e.h = px(styleVal(s, 'height'), 40);
    const rot = /rotate\(([-\d.]+)deg\)/.exec(styleVal(s, 'transform')); e.rot = rot ? parseFloat(rot[1]) : 0;
    const op = styleVal(s, 'opacity'); e.opacity = op ? parseFloat(op) : 1;
    e.z = i + 1;
    e.fill = styleVal(s, 'background') || styleVal(s, 'background-color') || e.fill;
    e.radius = px(styleVal(s, 'border-radius')) || 0;
    const bw = /(\d+(?:\.\d+)?)px\s+solid\s+([^;]+)/.exec(styleVal(s, 'border'));
    if (bw) { e.borderWidth = parseFloat(bw[1]); e.borderColor = bw[2].trim(); }
    if (type === 'image') {
      // New format: <div data-type=image><img .../></div>. Legacy: a bare <img>.
      const imgEl = (el.tagName.toLowerCase() === 'img' ? el : el.querySelector('img')) as HTMLElement | null;
      e.src = imgEl?.getAttribute('src') || '';
      const is = imgEl?.getAttribute('style') || '';
      e.iw = px(styleVal(is, 'width'), e.w) || e.w;
      e.ih = px(styleVal(is, 'height'), e.h) || e.h;
      e.ox = Math.abs(px(styleVal(is, 'left'), 0));
      e.oy = Math.abs(px(styleVal(is, 'top'), 0));
      e.nar = e.iw ? e.ih / e.iw : 1;
    }
    if (type === 'text') {
      e.content = el.innerHTML;
      e.color = styleVal(s, 'color') || e.color;
      e.fontSize = px(styleVal(s, 'font-size'), 24);
      e.fontFamily = styleVal(s, 'font-family') || e.fontFamily;
      e.bold = /700|bold/.test(styleVal(s, 'font-weight'));
      e.italic = styleVal(s, 'font-style') === 'italic';
      e.underline = /underline/.test(styleVal(s, 'text-decoration'));
      e.align = (styleVal(s, 'text-align') as any) || 'left';
    }
    els.push(e);
  });
  return { els, height };
}

// ── Rotation-aware geometry helpers ──────────────────────────────────────────
const rad = (deg: number) => (deg * Math.PI) / 180;
function rotate(vx: number, vy: number, deg: number) {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return { x: vx * c - vy * s, y: vx * s + vy * c };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function LetterheadDesigner({ value, onChange, defaultHeight = DEFAULT_H }: Props) {
  const [els, setEls] = useState<El[]>([]);
  const [height, setHeight] = useState(defaultHeight);
  const [selId, setSelId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shapeMenu, setShapeMenu] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Alignment guides shown live while dragging: canvas/other-element edges the
  // moving element has snapped to. Cleared on mouse-up.
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef<string>('');
  const drag = useRef<any>(null);
  // Refs mirror the latest state so drag listeners bound once at mousedown, and
  // any handler, always compute from current values rather than a stale closure.
  const elsRef = useRef<El[]>([]);
  const heightRef = useRef<number>(defaultHeight);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const snapRef = useRef(true); snapRef.current = snapOn;

  // ── Undo / redo ────────────────────────────────────────────────────────────
  // Each entry is a full snapshot of the canvas. `checkpoint(key)` records the
  // state *before* a change; consecutive checkpoints with the same key inside a
  // short window collapse into one step, so a slider drag or a run of arrow-key
  // nudges is a single undo — not fifty.
  type Snap = { els: El[]; height: number };
  const undoRef = useRef<Snap[]>([]);
  const redoRef = useRef<Snap[]>([]);
  const lastCkpt = useRef<{ key: string; t: number }>({ key: '', t: 0 });
  const snapshot = (): Snap => ({ els: elsRef.current.map((e) => ({ ...e })), height: heightRef.current });
  const checkpoint = useCallback((key: string) => {
    const now = Date.now();
    if (key === lastCkpt.current.key && now - lastCkpt.current.t < 700) { lastCkpt.current.t = now; return; }
    lastCkpt.current = { key, t: now };
    undoRef.current.push(snapshot());
    if (undoRef.current.length > 120) undoRef.current.shift();
    redoRef.current = [];
    setCanUndo(true); setCanRedo(false);
  }, []);
  const restore = useCallback((s: Snap) => {
    elsRef.current = s.els; heightRef.current = s.height;
    setEls(s.els); setHeight(s.height);
    const html = serialize(s.els, s.height);
    lastEmitted.current = html; onChangeRef.current(html);
  }, []);
  const undo = useCallback(() => {
    if (!undoRef.current.length) return;
    redoRef.current.push(snapshot());
    restore(undoRef.current.pop()!);
    lastCkpt.current = { key: '', t: 0 };
    setCanUndo(undoRef.current.length > 0); setCanRedo(true);
  }, [restore]);
  const redo = useCallback(() => {
    if (!redoRef.current.length) return;
    undoRef.current.push(snapshot());
    restore(redoRef.current.pop()!);
    lastCkpt.current = { key: '', t: 0 };
    setCanRedo(redoRef.current.length > 0); setCanUndo(true);
  }, [restore]);

  // Load from value (and pull in external changes) without fighting live edits.
  // Setting state here must NOT emit — legacy letterheads stay untouched until
  // the user actually edits.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    const { els: e, height: h } = deserialize(value, defaultHeight);
    elsRef.current = e; heightRef.current = h;
    setEls(e); setHeight(h); lastEmitted.current = value;
  }, [value]);

  // While a drag is in flight we update local state every frame but DON'T emit
  // to the parent — emitting serialises the whole letterhead (a big base64
  // import included) and re-renders the settings page + A4 preview on every
  // mouse move, which made dragging crawl. We emit once when the drag ends.
  const emitPaused = useRef(false);
  const emitNow = useCallback(() => {
    const html = serialize(elsRef.current, heightRef.current);
    lastEmitted.current = html;
    onChangeRef.current(html);
  }, []);

  // The single write path: update state, and emit unless a drag has paused it.
  const apply = useCallback((next: El[], nextH?: number) => {
    const h = nextH ?? heightRef.current;
    elsRef.current = next; heightRef.current = h;
    setEls(next); setHeight(h);
    if (emitPaused.current) return;
    const html = serialize(next, h);
    lastEmitted.current = html;
    onChangeRef.current(html);
  }, []);

  const sel = els.find((e) => e.id === selId) || null;

  const update = useCallback((id: string, patch: Partial<El>) =>
    apply(elsRef.current.map((e) => (e.id === id ? { ...e, ...patch } : e))), [apply]);

  const addEl = (type: ElType, extra?: Partial<El>) => {
    checkpoint('add');
    const z = (elsRef.current.reduce((m, e) => Math.max(m, e.z), 0) || 0) + 1;
    let e = { ...baseEl(type, z), ...extra };
    if (type === 'line') e = { ...e, w: 300, h: 4, x: 60, y: 90, fill: '#000000' };
    if (type === 'text') e = { ...e, w: 320, h: 48, x: 60, y: 40, content: 'Double-click to edit', ph: true };
    if (type === 'circle') e = { ...e, w: 100, h: 100 };
    if (type === 'triangle' || type === 'diamond' || type === 'pentagon' || type === 'hexagon' || type === 'star') {
      e = { ...e, w: 110, h: 100 };
    }
    apply([...elsRef.current, e]);
    setSelId(e.id);
  };

  const removeEl = (id: string) => { checkpoint('remove'); apply(elsRef.current.filter((e) => e.id !== id)); setSelId(null); };

  const bringFront = (id: string) => {
    checkpoint('layer');
    const max = elsRef.current.reduce((m, e) => Math.max(m, e.z), 0);
    apply(elsRef.current.map((e) => (e.id === id ? { ...e, z: max + 1 } : e)));
  };
  const sendBack = (id: string) => {
    checkpoint('layer');
    const min = elsRef.current.reduce((m, e) => Math.min(m, e.z), 0);
    apply(elsRef.current.map((e) => (e.id === id ? { ...e, z: min - 1 } : e)));
  };
  const duplicate = (id: string) => {
    const src = elsRef.current.find((e) => e.id === id);
    if (!src) return;
    checkpoint('dup');
    const z = elsRef.current.reduce((m, e) => Math.max(m, e.z), 0) + 1;
    const copy: El = { ...src, id: uid(), x: src.x + 12, y: src.y + 12, z };
    apply([...elsRef.current, copy]);
    setSelId(copy.id);
  };

  // Nudge a snapping candidate onto the nearest canvas/element edge within
  // THRESHOLD, and report which lines it locked onto so guides can be drawn.
  const snapMove = (nx: number, ny: number, moving: El) => {
    const TH = 6;
    const others = elsRef.current.filter((e) => e.id !== moving.id && !e.rot);
    const xt = [0, CANVAS_W / 2, CANVAS_W];
    const yt = [0, heightRef.current / 2, heightRef.current];
    others.forEach((e) => { xt.push(e.x, e.x + e.w / 2, e.x + e.w); yt.push(e.y, e.y + e.h / 2, e.y + e.h); });

    const axis = (pos: number, size: number, targets: number[]) => {
      const pts = [pos, pos + size / 2, pos + size];
      let best: { delta: number; guide: number } | null = null;
      for (const t of targets) for (const p of pts) {
        const d = t - p;
        if (Math.abs(d) <= TH && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, guide: t };
      }
      return best;
    };

    const bx = moving.rot ? null : axis(nx, moving.w, xt);
    const by = moving.rot ? null : axis(ny, moving.h, yt);
    return {
      x: bx ? nx + bx.delta : nx,
      y: by ? ny + by.delta : ny,
      gx: bx ? [bx.guide] : [],
      gy: by ? [by.guide] : [],
    };
  };

  // Snap the corner being dragged during a resize onto the nearest canvas /
  // other-element edge or centre. Only for un-rotated elements (a rotated box's
  // corner doesn't lie on an axis-aligned line).
  const snapResizePoint = (px: number, py: number, id: string) => {
    const TH = 6;
    const others = elsRef.current.filter((e) => e.id !== id && !e.rot);
    const xt = [0, CANVAS_W / 2, CANVAS_W];
    const yt = [0, heightRef.current / 2, heightRef.current];
    others.forEach((e) => { xt.push(e.x, e.x + e.w / 2, e.x + e.w); yt.push(e.y, e.y + e.h / 2, e.y + e.h); });
    const nearest = (v: number, targets: number[]) => {
      let best: { t: number; d: number } | null = null;
      for (const t of targets) { const d = t - v; if (Math.abs(d) <= TH && (!best || Math.abs(d) < Math.abs(best.d))) best = { t, d }; }
      return best;
    };
    const bx = nearest(px, xt), by = nearest(py, yt);
    return { x: bx ? bx.t : px, y: by ? by.t : py, gx: bx ? [bx.t] : [], gy: by ? [by.t] : [] };
  };

  // ── Pointer interactions ───────────────────────────────────────────────────
  const pt = (ev: MouseEvent | React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };

  const startMove = (ev: React.MouseEvent, e: El) => {
    if (editingId === e.id) return;
    if (ev.button !== 0) return; // left button only
    ev.stopPropagation();
    ev.preventDefault(); // stop the browser starting a text selection / image drag
    setSelId(e.id);
    const p = pt(ev);
    drag.current = { mode: 'move', id: e.id, sx: p.x, sy: p.y, ox: e.x, oy: e.y, ckpt: false };
  };

  const startResize = (ev: React.MouseEvent, e: El, sx: number, sy: number) => {
    ev.stopPropagation();
    ev.preventDefault();
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const anchorLocal = { x: (-sx * e.w) / 2, y: (-sy * e.h) / 2 };
    const ar = rotate(anchorLocal.x, anchorLocal.y, e.rot);
    drag.current = { mode: 'resize', id: e.id, sx, sy, rot: e.rot, w0: e.w, h0: e.h, anchor: { x: cx + ar.x, y: cy + ar.y }, ckpt: false };
  };

  const startRotate = (ev: React.MouseEvent, e: El) => {
    ev.stopPropagation();
    ev.preventDefault();
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const p = pt(ev);
    const start = Math.atan2(p.y - cy, p.x - cx);
    drag.current = { mode: 'rotate', id: e.id, cx, cy, start, orot: e.rot, ckpt: false };
  };

  const onWinMove = (ev: MouseEvent) => {
    const d = drag.current; if (!d) return;
    // Record one undo checkpoint the first time a drag actually moves, so a plain
    // click-to-select never leaves an empty undo step. Pause parent emits for the
    // duration of the drag; onWinUp flushes a single update.
    if (!d.ckpt) { d.ckpt = true; checkpoint(d.mode + ':' + d.id); emitPaused.current = true; }
    const p = pt(ev);
    if (d.mode === 'move') {
      const moving = elsRef.current.find((e) => e.id === d.id);
      const rawX = d.ox + (p.x - d.sx), rawY = d.oy + (p.y - d.sy);
      if (moving && snapRef.current && !ev.altKey) {
        const s = snapMove(rawX, rawY, moving);
        setGuides({ x: s.gx, y: s.gy });
        update(d.id, { x: s.x, y: s.y });
      } else {
        setGuides({ x: [], y: [] });
        update(d.id, { x: rawX, y: rawY });
      }
    } else if (d.mode === 'resize') {
      let px = p.x, py = p.y;
      if (d.rot === 0 && snapRef.current && !ev.altKey) {
        const s = snapResizePoint(p.x, p.y, d.id);
        if (d.sx !== 0) px = s.x;
        if (d.sy !== 0) py = s.y;
        setGuides({ x: d.sx !== 0 ? s.gx : [], y: d.sy !== 0 ? s.gy : [] });
      } else {
        setGuides({ x: [], y: [] });
      }
      const v = { x: px - d.anchor.x, y: py - d.anchor.y };
      const local = rotate(v.x, v.y, -d.rot);
      // A zero sign means that side handle leaves the dimension untouched.
      const w = d.sx !== 0 ? Math.max(MIN, d.sx * local.x) : d.w0;
      const h = d.sy !== 0 ? Math.max(MIN, d.sy * local.y) : d.h0;
      const off = rotate((d.sx * w) / 2, (d.sy * h) / 2, d.rot);
      const cx = d.anchor.x + off.x, cy = d.anchor.y + off.y;
      update(d.id, { w, h, x: cx - w / 2, y: cy - h / 2 });
    } else if (d.mode === 'rotate') {
      const ang = Math.atan2(p.y - d.cy, p.x - d.cx);
      let deg = d.orot + ((ang - d.start) * 180) / Math.PI;
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
      update(d.id, { rot: Math.round(deg * 10) / 10 });
    }
  };
  const onWinUp = () => {
    drag.current = null;
    setGuides({ x: [], y: [] });
    if (emitPaused.current) { emitPaused.current = false; emitNow(); }
  };
  // Bind the drag listeners ONCE and dispatch through refs. Adding/removing them
  // per-drag by function identity leaked listeners (every render makes new
  // closures, so removal never matched what was added) and made dragging erratic.
  const moveRef = useRef<(e: MouseEvent) => void>(() => {});
  const upRef = useRef<() => void>(() => {});
  moveRef.current = onWinMove;
  upRef.current = onWinUp;
  useEffect(() => {
    const m = (e: MouseEvent) => moveRef.current(e);
    const u = () => upRef.current();
    window.addEventListener('mousemove', m);
    window.addEventListener('mouseup', u);
    return () => { window.removeEventListener('mousemove', m); window.removeEventListener('mouseup', u); };
  }, []);

  // Keyboard: arrow-nudge, delete, duplicate, deselect — but only when a shape
  // is selected and focus isn't in a text field or a text box being edited.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      const tag = t?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t?.isContentEditable;

      // Undo / redo work anywhere on the canvas (even with nothing selected).
      // Inside a text field or a text box being edited we leave the browser's
      // own undo alone.
      if (!inField) {
        const k = ev.key.toLowerCase();
        if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
        if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); redo(); return; }
      }

      if (inField || !selId || editingId) return;

      if (ev.key === 'Escape') { setSelId(null); return; }
      if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); removeEl(selId); return; }
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'd' || ev.key === 'D')) { ev.preventDefault(); duplicate(selId); return; }
      const step = ev.shiftKey ? 10 : 1;
      const cur = elsRef.current.find((e) => e.id === selId);
      if (!cur) return;
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); checkpoint('nudge:' + selId); update(selId, { x: cur.x - step }); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); checkpoint('nudge:' + selId); update(selId, { x: cur.x + step }); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); checkpoint('nudge:' + selId); update(selId, { y: cur.y - step }); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); checkpoint('nudge:' + selId); update(selId, { y: cur.y + step }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selId, editingId, undo, redo, checkpoint]); // eslint-disable-line

  const onImagePick = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 200 / img.width);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        addEl('image', { src, w, h, x: 60, y: 40, iw: w, ih: h, ox: 0, oy: 0, nar: img.height / img.width });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    ev.target.value = '';
  };

  // Import an existing letterhead: the picture becomes the letterhead itself —
  // dropped in at full page width with the canvas sized to its aspect ratio, an
  // exact raster of what the clinic already has. It replaces the current design
  // (undoable), and they can then overlay editable text on top if they wish.
  // Accepts an image or a PDF (first page rendered to an image).
  const onLetterheadImport = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const { src, w: iw0, h: ih0 } = await fileToImage(file);
      const nar = ih0 / iw0;
      const h = Math.round(CANVAS_W * nar);
      checkpoint('import');
      const el: El = { ...baseEl('image', 1), src, x: 0, y: 0, w: CANVAS_W, h, iw: CANVAS_W, ih: h, ox: 0, oy: 0, nar };
      apply([el], Math.max(80, Math.min(1400, h)));
      setSelId(el.id);
    } catch (err) {
      console.error('Letterhead import failed:', err);
      window.alert('Could not import that file. Please use a PNG, JPG, or PDF.');
    }
  };

  const setHeightSafe = (h: number) => { checkpoint('height'); const v = Math.max(80, Math.min(1400, h)); apply(elsRef.current, v); };

  // Align the selected element to the page (canvas) edges or centre.
  const alignEl = (how: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => {
    const e = elsRef.current.find((x) => x.id === selId);
    if (!e) return;
    checkpoint('align');
    const H = heightRef.current;
    const patch: Partial<El> =
      how === 'left' ? { x: 0 } :
      how === 'hcenter' ? { x: (CANVAS_W - e.w) / 2 } :
      how === 'right' ? { x: CANVAS_W - e.w } :
      how === 'top' ? { y: 0 } :
      how === 'vcenter' ? { y: (H - e.h) / 2 } :
      { y: H - e.h };
    update(e.id, patch);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImagePick} />
      <input ref={importRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={onLetterheadImport} />

      {/* Toolbar */}
      <div style={S.toolbar}>
        <button type="button" title="Import an existing letterhead (PNG, JPG or PDF) — fills the page, exact copy"
          onClick={() => importRef.current?.click()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: '0.74rem', fontWeight: 700,
            border: '1px solid #2563eb', borderRadius: 5, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
          <RiUploadCloud2Line size={16} /> Import letterhead
        </button>
        <div style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 2px' }} />
        <span style={S.tGroupLabel}>Add</span>
        <TBtn title="Text box" onClick={() => addEl('text')}><RiText size={16} /> Text</TBtn>
        <TBtn title="Image / logo" onClick={() => fileRef.current?.click()}><RiImageAddLine size={16} /> Image</TBtn>
        <TBtn title="Line" onClick={() => addEl('line')}><RiSeparator size={16} /> Line</TBtn>
        <TBtn title="Rectangle" onClick={() => addEl('rect')}><RiSquareLine size={16} /> Rect</TBtn>
        <TBtn title="Circle / ellipse" onClick={() => addEl('circle')}><RiCircleLine size={16} /> Circle</TBtn>
        <div style={{ position: 'relative' }}>
          <TBtn title="More shapes" onClick={() => setShapeMenu((v) => !v)}><RiShapesLine size={16} /> Shapes ▾</TBtn>
          {shapeMenu && (
            <>
              <div style={S.menuBackdrop} onClick={() => setShapeMenu(false)} />
              <div style={S.menu}>
                <MenuItem onClick={() => { addEl('triangle'); setShapeMenu(false); }}><RiTriangleLine size={15} /> Triangle</MenuItem>
                <MenuItem onClick={() => { addEl('diamond'); setShapeMenu(false); }}><RiVipDiamondLine size={15} /> Diamond</MenuItem>
                <MenuItem onClick={() => { addEl('pentagon'); setShapeMenu(false); }}><RiPentagonLine size={15} /> Pentagon</MenuItem>
                <MenuItem onClick={() => { addEl('hexagon'); setShapeMenu(false); }}><RiHexagonLine size={15} /> Hexagon</MenuItem>
                <MenuItem onClick={() => { addEl('star'); setShapeMenu(false); }}><RiStarLine size={15} /> Star</MenuItem>
              </div>
            </>
          )}
        </div>
        <div style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 2px' }} />
        <TBtn title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}><RiArrowGoBackLine size={16} /></TBtn>
        <TBtn title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}><RiArrowGoForwardLine size={16} /></TBtn>
        <button type="button" title="Snap to other elements and the page edges while dragging"
          onClick={() => setSnapOn((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', fontSize: '0.74rem', fontWeight: 600,
            border: '1px solid ' + (snapOn ? '#2563eb' : '#e2e8f0'), borderRadius: 5,
            background: snapOn ? '#e0f2fe' : '#fff', color: snapOn ? '#0369a1' : '#334155', cursor: 'pointer' }}>
          <RiFocus3Line size={16} /> Snap {snapOn ? 'on' : 'off'}
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Height</span>
        <NumInput value={height} onCommit={setHeightSafe} style={S.numSm} />
        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>px</span>
      </div>

      <div style={S.body}>
        {/* Canvas */}
        <div style={S.canvasScroll}>
          <div
            ref={canvasRef}
            style={{ ...S.canvas, width: CANVAS_W, height }}
            onMouseDown={() => { setSelId(null); setEditingId(null); }}
          >
            {[...els].sort((a, b) => a.z - b.z).map((e) => (
              <ElementView
                key={e.id} e={e} selected={e.id === selId} editing={e.id === editingId}
                onMouseDown={(ev) => startMove(ev, e)}
                onDoubleClick={() => { if (e.type === 'text') { setSelId(e.id); setEditingId(e.id); } }}
                onResizeStart={startResize} onRotateStart={startRotate}
                onTextInput={(html, contentH) => { checkpoint('text:' + e.id); update(e.id, { content: html, h: Math.max(e.h, contentH), ph: false }); }}
              />
            ))}
            {guides.x.map((gx, i) => (
              <div key={`gx${i}`} style={{ position: 'absolute', left: gx, top: 0, width: 1, height: '100%', background: '#ec4899', zIndex: 10000, pointerEvents: 'none' }} />
            ))}
            {guides.y.map((gy, i) => (
              <div key={`gy${i}`} style={{ position: 'absolute', top: gy, left: 0, height: 1, width: '100%', background: '#ec4899', zIndex: 10000, pointerEvents: 'none' }} />
            ))}
          </div>
        </div>

        {/* Inspector */}
        <div style={S.inspector}>
          {!sel && <div style={S.hint}>Select an element to edit its properties, or add one from the toolbar. Double-click a text box to type.<br /><br />Undo/redo with the toolbar buttons or Ctrl+Z / Ctrl+Shift+Z. Arrow keys nudge (Shift = 10px), Ctrl+D duplicates, Delete removes, Esc deselects.<br /><br />Snapping is a toolbar toggle; you can also hold Alt to switch it off for a single drag.</div>}
          {sel && <Inspector e={sel} onChange={(patch) => { checkpoint('insp:' + Object.keys(patch)[0]); update(sel.id, patch); }} onDelete={() => removeEl(sel.id)}
            onFront={() => bringFront(sel.id)} onBack={() => sendBack(sel.id)} onDuplicate={() => duplicate(sel.id)} onAlign={alignEl} />}
        </div>
      </div>
    </div>
  );
}

// ── Element view + handles ───────────────────────────────────────────────────
function ElementView({ e, selected, editing, onMouseDown, onDoubleClick, onResizeStart, onRotateStart, onTextInput }: {
  e: El; selected: boolean; editing: boolean;
  onMouseDown: (ev: React.MouseEvent) => void; onDoubleClick: () => void;
  onResizeStart: (ev: React.MouseEvent, e: El, sx: number, sy: number) => void;
  onRotateStart: (ev: React.MouseEvent, e: El) => void;
  onTextInput: (html: string, contentH: number) => void;
}) {
  const editRef = useRef<HTMLDivElement>(null);
  // Keep the DOM text in sync with the model ONLY while not editing (so undo and
  // external changes show up). While editing we never rewrite the node, so the
  // caret and the text are never wiped out from under the user.
  useEffect(() => {
    if (e.type !== 'text' || editing || !editRef.current) return;
    if (editRef.current.innerHTML !== e.content) editRef.current.innerHTML = e.content;
  }, [e.type, e.content, editing]);

  // On entering edit: clear the box only if it's still the untouched placeholder,
  // then focus and drop the caret at the end. Existing text is left intact.
  useEffect(() => {
    if (!editing || !editRef.current) return;
    if (e.ph) editRef.current.innerHTML = '';
    editRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editRef.current);
    range.collapse(false);
    const selctn = window.getSelection();
    selctn?.removeAllRanges();
    selctn?.addRange(range);
  }, [editing]); // eslint-disable-line

  const common: React.CSSProperties = {
    position: 'absolute', left: e.x, top: e.y, width: e.w, height: e.h,
    transform: e.rot ? `rotate(${e.rot}deg)` : undefined, opacity: e.opacity,
    zIndex: e.z, boxSizing: 'border-box', cursor: editing ? 'text' : 'move',
    userSelect: editing ? 'text' : 'none', WebkitUserSelect: editing ? 'text' : 'none',
  };

  let inner: React.ReactNode = null;
  const shapeStyle: React.CSSProperties = { ...common };
  if (e.type === 'text') {
    Object.assign(shapeStyle, {
      color: e.color, fontSize: e.fontSize, fontFamily: e.fontFamily,
      fontWeight: e.bold ? 700 : 400, fontStyle: e.italic ? 'italic' : 'normal',
      textDecoration: e.underline ? 'underline' : 'none', textAlign: e.align,
      lineHeight: 1.25, overflow: 'visible', whiteSpace: 'pre-wrap',
      outline: editing ? '1px dashed #2563eb' : 'none',
    });
    inner = (
      <div
        ref={editRef} contentEditable={editing} suppressContentEditableWarning
        onInput={(ev) => { const el = ev.target as HTMLElement; onTextInput(el.innerHTML, el.scrollHeight); }}
        style={{ width: '100%', height: '100%',  cursor: editing ? 'text' : 'move' }}
      />
    );
  } else if (e.type === 'image') {
    Object.assign(shapeStyle, {
      overflow: 'hidden',
      border: e.borderWidth ? `${e.borderWidth}px solid ${e.borderColor}` : undefined,
      borderRadius: e.radius || undefined,
    });
    const { iw, ih, ox, oy } = imgDisplay(e);
    inner = (
      <img src={e.src} alt="" draggable={false}
        style={{ position: 'absolute', left: -ox, top: -oy, width: iw, height: ih, maxWidth: 'none', display: 'block', pointerEvents: 'none' }} />
    );
  } else if (e.type === 'line') {
    Object.assign(shapeStyle, { background: e.fill });
  } else if (e.type === 'rect') {
    Object.assign(shapeStyle, { background: e.fill, borderRadius: e.radius, border: e.borderWidth ? `${e.borderWidth}px solid ${e.borderColor}` : undefined });
  } else if (e.type === 'circle') {
    Object.assign(shapeStyle, { background: e.fill, borderRadius: '50%', border: e.borderWidth ? `${e.borderWidth}px solid ${e.borderColor}` : undefined });
  } else if (CLIP[e.type]) {
    Object.assign(shapeStyle, { background: e.fill, clipPath: CLIP[e.type] });
  }

  const el = <div style={shapeStyle} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick}>{inner}</div>;

  // Corner + side handles. sx/sy ∈ {-1,0,1}; 0 means that side handle only moves
  // one edge (leaves the other dimension fixed).
  const handles: [number, number, string][] = [
    [-1, -1, 'nwse-resize'], [0, -1, 'ns-resize'], [1, -1, 'nesw-resize'],
    [1, 0, 'ew-resize'], [1, 1, 'nwse-resize'], [0, 1, 'ns-resize'],
    [-1, 1, 'nesw-resize'], [-1, 0, 'ew-resize'],
  ];
  const hpos = (s: number, size: number) => (s < 0 ? -5 : s > 0 ? size - 5 : size / 2 - 5);

  return (
    <>
      {el}
      {selected && !editing && (
        <div style={{ position: 'absolute', left: e.x, top: e.y, width: e.w, height: e.h,
          transform: e.rot ? `rotate(${e.rot}deg)` : undefined, zIndex: 9999, pointerEvents: 'none',
          outline: '1px solid #2563eb' }}>
          {handles.map(([sx, sy, cursor], i) => (
            <div key={i} onMouseDown={(ev) => onResizeStart(ev, e, sx, sy)}
              style={{ position: 'absolute', width: 10, height: 10, background: '#fff', border: '1.5px solid #2563eb',
                borderRadius: 2, pointerEvents: 'auto', cursor,
                left: hpos(sx, e.w), top: hpos(sy, e.h) }} />
          ))}
          {/* rotate handle */}
          <div onMouseDown={(ev) => onRotateStart(ev, e)}
            style={{ position: 'absolute', left: e.w / 2 - 6, top: -28, width: 12, height: 12, borderRadius: '50%',
              background: '#2563eb', border: '2px solid #fff', pointerEvents: 'auto', cursor: 'grab' }} />
          <div style={{ position: 'absolute', left: e.w / 2, top: -18, width: 1, height: 18, background: '#2563eb' }} />
        </div>
      )}
    </>
  );
}

// ── Inspector ────────────────────────────────────────────────────────────────
function Inspector({ e, onChange, onDelete, onFront, onBack, onDuplicate, onAlign }: {
  e: El; onChange: (patch: Partial<El>) => void; onDelete: () => void;
  onFront: () => void; onBack: () => void; onDuplicate: () => void;
  onAlign: (how: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => void;
}) {
  const num = (label: string, key: keyof El, step = 1) => (
    <label style={S.field}><span style={S.fLabel}>{label}</span>
      <NumInput value={e[key] as number} step={step} style={S.num}
        onCommit={(n) => onChange({ [key]: n } as any)} />
    </label>
  );
  const color = (label: string, key: keyof El) => (
    <label style={S.field}><span style={S.fLabel}>{label}</span>
      <input type="color" value={(e[key] as string) || '#000000'} onChange={(ev) => onChange({ [key]: ev.target.value } as any)} style={S.color} />
    </label>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={S.inspTitle}>{e.type} properties</div>

      <div style={S.row}>{num('X', 'x')}{num('Y', 'y')}</div>
      <div style={S.row}>{num('W', 'w')}{num('H', 'h')}</div>
      <div style={S.row}>{num('Angle°', 'rot')}
        <label style={S.field}><span style={S.fLabel}>Opacity</span>
          <input type="range" min={0.1} max={1} step={0.05} value={e.opacity}
            onChange={(ev) => onChange({ opacity: parseFloat(ev.target.value) })} style={{ width: '100%' }} />
        </label>
      </div>

      <div>
        <span style={S.fLabel}>Align to page</span>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <IconBtn title="Left edge" onClick={() => onAlign('left')}><RiAlignItemLeftLine size={15} /></IconBtn>
          <IconBtn title="Centre horizontally" onClick={() => onAlign('hcenter')}><RiAlignItemHorizontalCenterLine size={15} /></IconBtn>
          <IconBtn title="Right edge" onClick={() => onAlign('right')}><RiAlignItemRightLine size={15} /></IconBtn>
          <span style={{ width: 1, background: '#e2e8f0', margin: '0 2px' }} />
          <IconBtn title="Top edge" onClick={() => onAlign('top')}><RiAlignItemTopLine size={15} /></IconBtn>
          <IconBtn title="Centre vertically" onClick={() => onAlign('vcenter')}><RiAlignItemVerticalCenterLine size={15} /></IconBtn>
          <IconBtn title="Bottom edge" onClick={() => onAlign('bottom')}><RiAlignItemBottomLine size={15} /></IconBtn>
        </div>
      </div>

      {e.type === 'text' && (
        <>
          <div style={S.row}>
            <label style={S.field}><span style={S.fLabel}>Font</span>
              <select value={e.fontFamily} onChange={(ev) => onChange({ fontFamily: ev.target.value })} style={S.select}>
                {FONTS.map((f) => <option key={f} value={f}>{f.split(',')[0].replace(/'/g, '')}</option>)}
              </select>
            </label>
            {num('Size', 'fontSize')}
          </div>
          <div style={S.row}>
            {color('Text', 'color')}
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
              <Toggle on={e.bold} onClick={() => onChange({ bold: !e.bold })}><RiBold size={15} /></Toggle>
              <Toggle on={e.italic} onClick={() => onChange({ italic: !e.italic })}><RiItalic size={15} /></Toggle>
              <Toggle on={e.underline} onClick={() => onChange({ underline: !e.underline })}><RiUnderline size={15} /></Toggle>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Toggle on={e.align === 'left'} onClick={() => onChange({ align: 'left' })}><RiAlignLeft size={15} /></Toggle>
            <Toggle on={e.align === 'center'} onClick={() => onChange({ align: 'center' })}><RiAlignCenter size={15} /></Toggle>
            <Toggle on={e.align === 'right'} onClick={() => onChange({ align: 'right' })}><RiAlignRight size={15} /></Toggle>
          </div>
        </>
      )}

      {FILLED.has(e.type) && color('Fill', 'fill')}
      {BORDERABLE.has(e.type) && (
        <div style={S.row}>{num('Border', 'borderWidth')}{color('Bd. color', 'borderColor')}</div>
      )}
      {(e.type === 'rect' || e.type === 'image') && <div style={S.row}>{num('Radius', 'radius')}<span style={{ flex: 1 }} /></div>}

      {e.type === 'image' && (() => {
        const iw = e.iw || e.w, nar = e.nar || (e.ih || e.h) / (e.iw || e.w);
        const zoom = Math.round((iw / e.w) * 100);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
            <span style={S.fLabel}>Picture — resize the box to crop</span>
            <label style={S.field}><span style={S.fLabel}>Zoom {zoom}%</span>
              <input type="range" min={100} max={400} step={1} value={Math.max(100, Math.min(400, zoom))}
                onChange={(ev) => { const f = parseInt(ev.target.value) / 100; onChange({ iw: e.w * f, ih: e.w * f * nar }); }} style={{ width: '100%' }} />
            </label>
            <div style={S.row}>{num('Crop X', 'ox')}{num('Crop Y', 'oy')}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <TBtn title="Fit the picture to the box width" onClick={() => onChange({ iw: e.w, ih: e.w * nar, ox: 0, oy: 0 })}>Fit width</TBtn>
              <TBtn title="Fill the whole box, cropping the overflow" onClick={() => { const s = Math.max(e.w, e.h / nar); onChange({ iw: s, ih: s * nar, ox: (s - e.w) / 2, oy: (s * nar - e.h) / 2 }); }}>Fill box</TBtn>
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <TBtn onClick={onFront}><RiBringToFront size={14} /> Front</TBtn>
        <TBtn onClick={onBack}><RiSendToBack size={14} /> Back</TBtn>
        <TBtn onClick={onDuplicate}><RiFileCopyLine size={14} /> Copy</TBtn>
        <button type="button" onClick={onDelete} style={S.delBtn}><RiDeleteBinLine size={14} /> Delete</button>
      </div>
    </div>
  );
}

// ── Small primitives ─────────────────────────────────────────────────────────
function TBtn({ children, onClick, title, disabled }: { children: React.ReactNode; onClick?: () => void; title?: string; disabled?: boolean }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', fontSize: '0.74rem', fontWeight: 600,
        border: '1px solid #e2e8f0', borderRadius: 5, background: disabled ? '#f8fafc' : h ? '#f1f5f9' : '#fff',
        color: disabled ? '#cbd5e1' : '#334155', cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  );
}
// A number field that lets you actually TYPE a value — clear it, type digits,
// paste — instead of the arrows driving a hard-controlled input. It commits any
// valid number as you type and re-syncs to the real value when focus leaves.
function NumInput({ value, onCommit, step = 1, style }: {
  value: number; onCommit: (n: number) => void; step?: number; style?: React.CSSProperties;
}) {
  const [text, setText] = useState(String(Math.round(value)));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(String(Math.round(value))); }, [value, focused]);
  return (
    <input type="number" step={step} value={text} style={style}
      onFocus={(e) => { setFocused(true); e.currentTarget.select(); }}
      onChange={(e) => { setText(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n)) onCommit(n); }}
      onBlur={() => { setFocused(false); const n = parseFloat(text); if (!isNaN(n)) onCommit(n); }}
    />
  );
}
function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '7px 12px', fontSize: '0.78rem',
        fontWeight: 600, border: 'none', background: h ? '#f1f5f9' : '#fff', color: '#334155', cursor: 'pointer', textAlign: 'left' }}>
      {children}
    </button>
  );
}
function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" title={title} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 1, height: 28,
        border: '1px solid #e2e8f0', borderRadius: 5, background: h ? '#f1f5f9' : '#fff', color: '#334155', cursor: 'pointer' }}>
      {children}
    </button>
  );
}
function Toggle({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 26,
        border: '1px solid ' + (on ? '#2563eb' : '#e2e8f0'), borderRadius: 5, background: on ? '#e0f2fe' : '#fff',
        color: on ? '#0369a1' : '#334155', cursor: 'pointer' }}>
      {children}
    </button>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  wrap: { border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden', background: '#f8fafc', display: 'flex', flexDirection: 'column' },
  toolbar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#fff', borderBottom: '1px solid #e2e8f0' },
  tGroupLabel: { fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', marginRight: 2 },
  body: { display: 'flex', minHeight: 340, alignItems: 'stretch' },
  canvasScroll: { flex: 1, overflow: 'auto', padding: 20, background: '#e9edf2', display: 'flex', justifyContent: 'center' },
  canvas: { position: 'relative', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)', flexShrink: 0, backgroundImage: 'linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)', backgroundSize: '20px 20px' },
  inspector: { width: 250, flexShrink: 0, borderLeft: '1px solid #e2e8f0', background: '#fff', padding: 12, overflowY: 'auto' },
  hint: { fontSize: '0.76rem', color: '#64748b', lineHeight: 1.5 },
  inspTitle: { fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#334155', paddingBottom: 6, borderBottom: '1px solid #f1f5f9' },
  row: { display: 'flex', gap: 8 },
  field: { display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 },
  fLabel: { fontSize: '0.66rem', fontWeight: 600, color: '#64748b' },
  num: { width: '100%', padding: '4px 6px', fontSize: '0.76rem', border: '1px solid #e2e8f0', borderRadius: 4, boxSizing: 'border-box' },
  numSm: { width: 60, padding: '4px 6px', fontSize: '0.76rem', border: '1px solid #e2e8f0', borderRadius: 4 },
  color: { width: '100%', height: 28, padding: 0, border: '1px solid #e2e8f0', borderRadius: 4, background: 'none', cursor: 'pointer' },
  select: { width: '100%', padding: '4px 6px', fontSize: '0.74rem', border: '1px solid #e2e8f0', borderRadius: 4 },
  delBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', fontSize: '0.74rem', fontWeight: 600, border: '1px solid #fecaca', borderRadius: 5, background: '#fef2f2', color: '#dc2626', cursor: 'pointer', marginLeft: 'auto' },
  menuBackdrop: { position: 'fixed', inset: 0, zIndex: 50 },
  menu: { position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 150, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 6px 20px rgba(0,0,0,0.14)', overflow: 'hidden', zIndex: 51, padding: '4px 0' },
};
