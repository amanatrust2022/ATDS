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
  RiAlignLeft, RiAlignCenter, RiAlignRight,
} from '@remixicon/react';

// ── Canvas geometry ──────────────────────────────────────────────────────────
// Kept within the printable width of the A4 report (≈753px inside its @page
// margins) so the design never overflows the page.
const CANVAS_W = 740;
const DEFAULT_H = 220;
const MIN = 8;

type ElType = 'text' | 'image' | 'line' | 'rect' | 'circle' | 'triangle';

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
  // image-only
  src: string;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
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

function baseEl(type: ElType, z: number): El {
  return {
    id: uid(), type, x: 60, y: 60, w: 160, h: 90, rot: 0, z, opacity: 1,
    fill: '#4472c4', borderColor: '#000000', borderWidth: 0, radius: 0,
    content: 'Text', color: '#0f172a', fontSize: 24, fontFamily: FONTS[0],
    bold: false, italic: false, underline: false, align: 'center', src: '',
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
    parts.push('object-fit:contain');
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
  } else if (e.type === 'triangle') {
    parts.push(`background:${e.fill}`, 'clip-path:polygon(50% 0%, 0% 100%, 100% 100%)');
  }
  return parts.join(';');
}

function serialize(els: El[], height: number): string {
  if (els.length === 0) return '';
  const children = [...els].sort((a, b) => a.z - b.z).map((e) => {
    if (e.type === 'image') {
      return `<img data-type="image" src="${escapeAttr(e.src)}" style="${elStyle(e)}" alt="" />`;
    }
    const inner = e.type === 'text' ? e.content : '';
    return `<div data-type="${e.type}" style="${elStyle(e)}">${inner}</div>`;
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
function deserialize(value: string): { els: El[]; height: number } {
  const html = (value || '').trim();
  if (!html) return { els: [], height: DEFAULT_H };
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return { els: [], height: DEFAULT_H };

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const container = doc.querySelector('[data-letterhead-canvas]') as HTMLElement | null;

  if (!container) {
    // Legacy letterhead → one text block spanning the canvas.
    const legacy = baseEl('text', 1);
    legacy.x = 0; legacy.y = 16; legacy.w = CANVAS_W; legacy.h = DEFAULT_H - 32;
    legacy.content = html;
    legacy.align = 'center';
    return { els: [legacy], height: DEFAULT_H };
  }

  const height = px(styleVal(container.getAttribute('style') || '', 'height'), DEFAULT_H);
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
    if (type === 'image') e.src = el.getAttribute('src') || '';
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
export default function LetterheadDesigner({ value, onChange }: Props) {
  const [els, setEls] = useState<El[]>([]);
  const [height, setHeight] = useState(DEFAULT_H);
  const [selId, setSelId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef<string>('');
  const drag = useRef<any>(null);

  // Load from value (and pull in external changes) without fighting live edits.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    const { els: e, height: h } = deserialize(value);
    setEls(e); setHeight(h); lastEmitted.current = value;
  }, [value]);

  const emit = useCallback((next: El[], nextH: number) => {
    const html = serialize(next, nextH);
    lastEmitted.current = html;
    onChange(html);
  }, [onChange]);

  const commit = useCallback((updater: (prev: El[]) => El[], nextH?: number) => {
    setEls((prev) => {
      const next = updater(prev);
      emit(next, nextH ?? height);
      return next;
    });
  }, [emit, height]);

  const sel = els.find((e) => e.id === selId) || null;

  const update = (id: string, patch: Partial<El>) =>
    commit((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addEl = (type: ElType, extra?: Partial<El>) => {
    const z = (els.reduce((m, e) => Math.max(m, e.z), 0) || 0) + 1;
    let e = { ...baseEl(type, z), ...extra };
    if (type === 'line') e = { ...e, w: 300, h: 4, x: 60, y: 90, fill: '#000000' };
    if (type === 'text') e = { ...e, w: 320, h: 48, x: 60, y: 40, content: 'Double-click to edit' };
    if (type === 'circle') e = { ...e, w: 100, h: 100 };
    if (type === 'triangle') e = { ...e, w: 120, h: 100 };
    commit((prev) => [...prev, e]);
    setSelId(e.id);
  };

  const removeEl = (id: string) => { commit((prev) => prev.filter((e) => e.id !== id)); setSelId(null); };

  const bringFront = (id: string) => commit((prev) => {
    const max = prev.reduce((m, e) => Math.max(m, e.z), 0);
    return prev.map((e) => (e.id === id ? { ...e, z: max + 1 } : e));
  });
  const sendBack = (id: string) => commit((prev) => {
    const min = prev.reduce((m, e) => Math.min(m, e.z), 0);
    return prev.map((e) => (e.id === id ? { ...e, z: min - 1 } : e));
  });

  // ── Pointer interactions ───────────────────────────────────────────────────
  const pt = (ev: MouseEvent | React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };

  const startMove = (ev: React.MouseEvent, e: El) => {
    if (editingId === e.id) return;
    ev.stopPropagation();
    setSelId(e.id);
    const p = pt(ev);
    drag.current = { mode: 'move', id: e.id, sx: p.x, sy: p.y, ox: e.x, oy: e.y };
    addWindow();
  };

  const startResize = (ev: React.MouseEvent, e: El, sx: number, sy: number) => {
    ev.stopPropagation();
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const anchorLocal = { x: (-sx * e.w) / 2, y: (-sy * e.h) / 2 };
    const ar = rotate(anchorLocal.x, anchorLocal.y, e.rot);
    drag.current = { mode: 'resize', id: e.id, sx, sy, rot: e.rot, anchor: { x: cx + ar.x, y: cy + ar.y } };
    addWindow();
  };

  const startRotate = (ev: React.MouseEvent, e: El) => {
    ev.stopPropagation();
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const p = pt(ev);
    const start = Math.atan2(p.y - cy, p.x - cx);
    drag.current = { mode: 'rotate', id: e.id, cx, cy, start, orot: e.rot };
    addWindow();
  };

  const onWinMove = (ev: MouseEvent) => {
    const d = drag.current; if (!d) return;
    const p = pt(ev);
    if (d.mode === 'move') {
      update(d.id, { x: d.ox + (p.x - d.sx), y: d.oy + (p.y - d.sy) });
    } else if (d.mode === 'resize') {
      const v = { x: p.x - d.anchor.x, y: p.y - d.anchor.y };
      const local = rotate(v.x, v.y, -d.rot);
      const w = Math.max(MIN, d.sx * local.x);
      const h = Math.max(MIN, d.sy * local.y);
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
  const onWinUp = () => { drag.current = null; removeWindow(); };
  const addWindow = () => { window.addEventListener('mousemove', onWinMove); window.addEventListener('mouseup', onWinUp); };
  const removeWindow = () => { window.removeEventListener('mousemove', onWinMove); window.removeEventListener('mouseup', onWinUp); };
  useEffect(() => () => removeWindow(), []); // eslint-disable-line

  const onImagePick = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 200 / img.width);
        addEl('image', { src, w: Math.round(img.width * scale), h: Math.round(img.height * scale), x: 60, y: 40 });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    ev.target.value = '';
  };

  const setHeightSafe = (h: number) => { const v = Math.max(80, Math.min(1000, h)); setHeight(v); emit(els, v); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImagePick} />

      {/* Toolbar */}
      <div style={S.toolbar}>
        <span style={S.tGroupLabel}>Add</span>
        <TBtn title="Text box" onClick={() => addEl('text')}><RiText size={16} /> Text</TBtn>
        <TBtn title="Image / logo" onClick={() => fileRef.current?.click()}><RiImageAddLine size={16} /> Image</TBtn>
        <TBtn title="Line" onClick={() => addEl('line')}><RiSeparator size={16} /> Line</TBtn>
        <TBtn title="Rectangle" onClick={() => addEl('rect')}><RiSquareLine size={16} /> Rect</TBtn>
        <TBtn title="Circle" onClick={() => addEl('circle')}><RiCircleLine size={16} /> Circle</TBtn>
        <TBtn title="Triangle" onClick={() => addEl('triangle')}><RiTriangleLine size={16} /> Triangle</TBtn>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Height</span>
        <input type="number" value={Math.round(height)} onChange={(e) => setHeightSafe(parseInt(e.target.value) || DEFAULT_H)}
          style={S.numSm} /> <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>px</span>
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
                onTextInput={(html) => update(e.id, { content: html })}
              />
            ))}
          </div>
        </div>

        {/* Inspector */}
        <div style={S.inspector}>
          {!sel && <div style={S.hint}>Select an element to edit its properties, or add one from the toolbar. Double-click a text box to type.</div>}
          {sel && <Inspector e={sel} onChange={(patch) => update(sel.id, patch)} onDelete={() => removeEl(sel.id)}
            onFront={() => bringFront(sel.id)} onBack={() => sendBack(sel.id)} />}
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
  onTextInput: (html: string) => void;
}) {
  const editRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editing && editRef.current) { editRef.current.focus(); } }, [editing]);

  const common: React.CSSProperties = {
    position: 'absolute', left: e.x, top: e.y, width: e.w, height: e.h,
    transform: e.rot ? `rotate(${e.rot}deg)` : undefined, opacity: e.opacity,
    zIndex: e.z, boxSizing: 'border-box', cursor: editing ? 'text' : 'move',
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
        onInput={(ev) => onTextInput((ev.target as HTMLElement).innerHTML)}
        style={{ width: '100%', height: '100%', outline: 'none', cursor: editing ? 'text' : 'move' }}
        dangerouslySetInnerHTML={editing ? undefined : { __html: e.content }}
      />
    );
  } else if (e.type === 'image') {
    Object.assign(shapeStyle, {
      objectFit: 'contain' as const,
      border: e.borderWidth ? `${e.borderWidth}px solid ${e.borderColor}` : undefined,
      borderRadius: e.radius || undefined,
    });
  } else if (e.type === 'line') {
    Object.assign(shapeStyle, { background: e.fill });
  } else if (e.type === 'rect') {
    Object.assign(shapeStyle, { background: e.fill, borderRadius: e.radius, border: e.borderWidth ? `${e.borderWidth}px solid ${e.borderColor}` : undefined });
  } else if (e.type === 'circle') {
    Object.assign(shapeStyle, { background: e.fill, borderRadius: '50%', border: e.borderWidth ? `${e.borderWidth}px solid ${e.borderColor}` : undefined });
  } else if (e.type === 'triangle') {
    Object.assign(shapeStyle, { background: e.fill, clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' });
  }

  const el = e.type === 'image'
    ? <img src={e.src} alt="" style={shapeStyle} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} draggable={false} />
    : <div style={shapeStyle} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick}>{inner}</div>;

  const handles: [number, number, string][] = [
    [-1, -1, 'nwse-resize'], [1, -1, 'nesw-resize'], [1, 1, 'nwse-resize'], [-1, 1, 'nesw-resize'],
  ];

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
                left: sx < 0 ? -5 : e.w - 5, top: sy < 0 ? -5 : e.h - 5 }} />
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
function Inspector({ e, onChange, onDelete, onFront, onBack }: {
  e: El; onChange: (patch: Partial<El>) => void; onDelete: () => void; onFront: () => void; onBack: () => void;
}) {
  const num = (label: string, key: keyof El, step = 1) => (
    <label style={S.field}><span style={S.fLabel}>{label}</span>
      <input type="number" step={step} value={Math.round((e[key] as number))}
        onChange={(ev) => onChange({ [key]: parseFloat(ev.target.value) || 0 } as any)} style={S.num} />
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

      {(e.type === 'rect' || e.type === 'circle' || e.type === 'triangle' || e.type === 'line') && color('Fill', 'fill')}
      {(e.type === 'rect' || e.type === 'circle' || e.type === 'image') && (
        <div style={S.row}>{num('Border', 'borderWidth')}{color('Bd. color', 'borderColor')}</div>
      )}
      {(e.type === 'rect' || e.type === 'image') && <div style={S.row}>{num('Radius', 'radius')}<span style={{ flex: 1 }} /></div>}

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <TBtn onClick={onFront}><RiBringToFront size={14} /> Front</TBtn>
        <TBtn onClick={onBack}><RiSendToBack size={14} /> Back</TBtn>
        <button type="button" onClick={onDelete} style={S.delBtn}><RiDeleteBinLine size={14} /> Delete</button>
      </div>
    </div>
  );
}

// ── Small primitives ─────────────────────────────────────────────────────────
function TBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" title={title} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', fontSize: '0.74rem', fontWeight: 600,
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
};
