'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle, FontSize, Color, BackgroundColor } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { TextAlign } from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import { Extension, Node as TiptapNode } from '@tiptap/core';

import {
  RiBold, RiItalic, RiUnderline, RiStrikethrough, RiListUnordered, RiListOrdered,
  RiAlignLeft, RiAlignCenter, RiAlignRight, RiAlignJustify,
  RiTable2, RiArrowGoBackLine, RiArrowGoForwardLine,
  RiFontColor, RiImageAddLine, RiMarkPenLine, RiLineHeight, RiSeparator,
  RiArrowDownSLine, RiFormatClear, RiDeleteBinLine,
} from '@remixicon/react';

import { DOC_BASE, BLOCK_RULES, buildDocCss } from '@/lib/letterheadStyles';

// ─── SELF-CONTAINED HTML EXPORT ──────────────────────────────────────────────
// Bake the document styles onto every element so the saved letterhead renders
// identically in the editor, the settings preview, and the printed report —
// none of which share the editor's stylesheet.
function mergeInlineStyle(el: Element, styleStr: string) {
  const existing: Record<string, string> = {};
  (el.getAttribute('style') || '').split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i > 0) existing[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim();
  });
  styleStr.split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i <= 0) return;
    const prop = decl.slice(0, i).trim().toLowerCase();
    // Author-set inline styles (colour, alignment, size…) always win.
    if (!(prop in existing)) existing[prop] = decl.slice(i + 1).trim();
  });
  const out = Object.entries(existing).map(([p, v]) => `${p}: ${v}`).join('; ');
  if (out) el.setAttribute('style', out);
}

function inlineDocHtml(html: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return html;
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    BLOCK_RULES.forEach((rule) => {
      doc.body.querySelectorAll(rule.selector).forEach((el) => mergeInlineStyle(el, rule.style));
    });
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

// ─── FIDELITY PRESERVATION ───────────────────────────────────────────────────
// TipTap only models the styles it knows about and silently drops the rest on
// import. A letterhead designer must round-trip arbitrary HTML faithfully, so we
// preserve two things TipTap would otherwise lose:
//   • wrapper <div>s (and their alignment/styles)  → `Div` node
//   • block-level colour / font-size / font on p & headings → `BlockStyle` passthrough
// text-align and line-height are deliberately left to their own extensions so the
// toolbar can change them cleanly; everything else is preserved verbatim.
const OWNED_BY_OTHER_EXTENSIONS = ['text-align', 'line-height'];

function filterStyle(style: string, exclude: string[]): string {
  return (style || '')
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d) => {
      const prop = d.split(':')[0].trim().toLowerCase();
      return !exclude.includes(prop);
    })
    .join('; ');
}

const BlockStyle = Extension.create({
  name: 'blockStyle',
  addOptions() {
    return { types: ['paragraph', 'heading', 'tableCell', 'tableHeader'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          style: {
            default: null,
            parseHTML: (el: HTMLElement) => {
              const s = filterStyle(el.getAttribute('style') || '', OWNED_BY_OTHER_EXTENSIONS);
              return s || null;
            },
            renderHTML: (attributes: Record<string, any>) =>
              attributes.style ? { style: attributes.style } : {},
          },
        },
      },
    ];
  },
});

const Div = TiptapNode.create({
  name: 'div',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('style'),
        renderHTML: (attributes: Record<string, any>) =>
          attributes.style ? { style: attributes.style } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0];
  },
});

// ─── LINE HEIGHT (block-level, renders inline so it is portable) ─────────────
const LineHeight = Extension.create({
  name: 'blockLineHeight',
  addOptions() {
    return { types: ['paragraph', 'heading', 'listItem'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
            renderHTML: (attributes: Record<string, any>) =>
              attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands }: { commands: any }) =>
          this.options.types.every((type: string) => commands.updateAttributes(type, { lineHeight })),
    } as any;
  },
});

// ─── SIZABLE IMAGE (width/height/alignment for logos) ────────────────────────
const SizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('width') || el.style.width || null,
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.width) return {};
          const w = String(attrs.width).match(/^\d+$/) ? `${attrs.width}px` : attrs.width;
          return { style: `width: ${w}; height: auto;` };
        },
      },
      align: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-align') || null,
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.align) return {};
          const map: Record<string, string> = {
            left: 'display:block;margin-right:auto;margin-left:0;',
            center: 'display:block;margin-left:auto;margin-right:auto;',
            right: 'display:block;margin-left:auto;margin-right:0;',
          };
          return { 'data-align': attrs.align, style: map[attrs.align] || '' };
        },
      },
    };
  },
}).configure({ inline: false, allowBase64: true });

// ─── PROPS & CONSTANTS ───────────────────────────────────────────────────────
interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: string;
  /**
   * What this editor is for, e.g. "Report findings".
   *
   * A contenteditable with no name is announced as an unlabelled text area,
   * and a screen on which two of them sit one above the other — findings and
   * impression — gives no way to tell which is which. A visible <label> cannot
   * do it: htmlFor needs an id on a form control, and this is a div.
   */
  ariaLabel?: string;
}

const FONTS = [
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Candara, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Courier New', value: "'Courier New', Courier, monospace" },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
];

const FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt', '32pt', '40pt', '48pt'];

const COLOR_PALETTE = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc', '#efefef', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0563c1',
  '#0000ff', '#9900ff', '#ff00ff', '#c00000', '#4472c4', '#2e7d32', '#7c3aed',
  '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#ead1dc',
  '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#9fc5e8', '#b4a7d6',
  '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3d85c6', '#674ea7',
];

const LINE_SPACINGS = [
  { label: 'Single', value: '1.0' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: 'Double', value: '2.0' },
  { label: 'Triple', value: '3.0' },
];

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing…',
  minHeight = '320px',
  ariaLabel,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef<string>('');

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [hoveredGrid, setHoveredGrid] = useState({ r: 0, c: 0 });
  const [isEmpty, setIsEmpty] = useState(true);
  const [, forceRender] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      BackgroundColor,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LineHeight,
      BlockStyle,
      Div,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      SizableImage,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    onCreate: ({ editor }) => {
      lastEmitted.current = value;
      setIsEmpty(editor.isEmpty);
    },
    onUpdate: ({ editor }) => {
      const html = inlineDocHtml(editor.getHTML());
      lastEmitted.current = html;
      setIsEmpty(editor.isEmpty);
      onChange(html);
    },
    onSelectionUpdate: () => forceRender((n) => n + 1),
    onTransaction: () => forceRender((n) => n + 1),
  });

  // Pull in external changes (e.g. loading a different template) without
  // clobbering the caret while the user is typing.
  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmitted.current && value !== inlineDocHtml(editor.getHTML())) {
      editor.commands.setContent(value, { emitUpdate: false });
      lastEmitted.current = value;
      setIsEmpty(editor.isEmpty);
    }
  }, [value, editor]);

  // Close any open dropdown on outside click.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const toggle = useCallback((name: string) => setOpenMenu((m) => (m === name ? null : name)), []);

  if (!editor) return null;

  const chain = () => editor.chain().focus();
  const attrs = editor.getAttributes('textStyle');
  const currentFont = FONTS.find((f) => f.value === attrs.fontFamily)?.label || 'Font';
  const currentSize = attrs.fontSize || '11pt';
  const currentColor = attrs.color || '#000000';
  const currentHighlight = attrs.backgroundColor || '';
  const blockLabel = editor.isActive('heading', { level: 1 })
    ? 'Heading 1'
    : editor.isActive('heading', { level: 2 })
    ? 'Heading 2'
    : editor.isActive('heading', { level: 3 })
    ? 'Heading 3'
    : 'Normal text';

  const imgActive = editor.isActive('image');
  const imgWidthAttr = editor.getAttributes('image').width;
  const imgWidth = parseInt(String(imgWidthAttr || '')) || 100;

  const applyFontSize = (size: string) => {
    let s = size.trim();
    if (!s) return;
    if (/^\d+(\.\d+)?$/.test(s)) s = `${s}pt`;
    (chain() as any).setFontSize(s).run();
    setOpenMenu(null);
  };

  const stepFontSize = (up: boolean) => {
    const m = currentSize.match(/^(\d+(?:\.\d+)?)(.*)$/);
    const val = m ? parseFloat(m[1]) : 11;
    const unit = m && m[2] ? m[2] : 'pt';
    applyFontSize(`${Math.max(1, up ? val + 1 : val - 1)}${unit}`);
  };

  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      chain().setImage({ src, width: '180' } as any).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const insertDivider = (style: string) => {
    chain().insertContent(`<hr style="${style}" />`).run();
    setOpenMenu(null);
  };

  return (
    <div ref={rootRef} style={S.container}>
      <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={onImageFile} />

      {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
      <div style={S.toolbar}>
        <Group>
          <IconBtn title="Undo (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><RiArrowGoBackLine size={16} /></IconBtn>
          <IconBtn title="Redo (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><RiArrowGoForwardLine size={16} /></IconBtn>
        </Group>

        <Divider />

        {/* Block type */}
        <Menu label={blockLabel} width={116} open={openMenu === 'block'} onToggle={() => toggle('block')}>
          <MenuItem onClick={() => { chain().setParagraph().run(); setOpenMenu(null); }}>Normal text</MenuItem>
          <MenuItem onClick={() => { chain().toggleHeading({ level: 1 }).run(); setOpenMenu(null); }} style={{ fontSize: '1.3rem', fontWeight: 700 }}>Heading 1</MenuItem>
          <MenuItem onClick={() => { chain().toggleHeading({ level: 2 }).run(); setOpenMenu(null); }} style={{ fontSize: '1.1rem', fontWeight: 700 }}>Heading 2</MenuItem>
          <MenuItem onClick={() => { chain().toggleHeading({ level: 3 }).run(); setOpenMenu(null); }} style={{ fontSize: '1rem', fontWeight: 700 }}>Heading 3</MenuItem>
        </Menu>

        {/* Font family */}
        <Menu label={currentFont} width={140} open={openMenu === 'font'} onToggle={() => toggle('font')}>
          {FONTS.map((f) => (
            <MenuItem key={f.label} onClick={() => { chain().setFontFamily(f.value).run(); setOpenMenu(null); }} style={{ fontFamily: f.value }}>
              {f.label}
            </MenuItem>
          ))}
        </Menu>

        {/* Font size */}
        <div style={S.sizeBox}>
          <button type="button" style={S.sizeStep} title="Smaller" onClick={() => stepFontSize(false)}>−</button>
          <button type="button" style={S.sizeValue} onClick={() => toggle('size')}>{currentSize}<RiArrowDownSLine size={12} style={{ opacity: 0.6 }} /></button>
          <button type="button" style={S.sizeStep} title="Larger" onClick={() => stepFontSize(true)}>+</button>
          {openMenu === 'size' && (
            <div style={{ ...S.dropdown, minWidth: 70, left: 'auto', right: 0 }}>
              {FONT_SIZES.map((s) => (
                <MenuItem key={s} onClick={() => applyFontSize(s)}>{s}</MenuItem>
              ))}
            </div>
          )}
        </div>

        <Divider />

        <Group>
          <IconBtn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><RiBold size={16} /></IconBtn>
          <IconBtn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><RiItalic size={16} /></IconBtn>
          <IconBtn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><RiUnderline size={16} /></IconBtn>
          <IconBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><RiStrikethrough size={16} /></IconBtn>

          {/* Text colour */}
          <div style={{ position: 'relative' }}>
            <IconBtn title="Text colour" onClick={() => toggle('color')}>
              <RiFontColor size={16} />
              <span style={{ ...S.colorBar, background: currentColor }} />
            </IconBtn>
            {openMenu === 'color' && (
              <ColorGrid
                onPick={(c) => { (chain() as any).setColor(c).run(); setOpenMenu(null); }}
                onReset={() => { (chain() as any).unsetColor().run(); setOpenMenu(null); }}
                resetLabel="Automatic"
              />
            )}
          </div>

          {/* Highlight */}
          <div style={{ position: 'relative' }}>
            <IconBtn title="Highlight" onClick={() => toggle('highlight')}>
              <RiMarkPenLine size={16} />
              <span style={{ ...S.colorBar, background: currentHighlight || 'transparent', border: '1px solid #cbd5e1' }} />
            </IconBtn>
            {openMenu === 'highlight' && (
              <ColorGrid
                onPick={(c) => { (chain() as any).setBackgroundColor(c).run(); setOpenMenu(null); }}
                onReset={() => { (chain() as any).unsetBackgroundColor().run(); setOpenMenu(null); }}
                resetLabel="No highlight"
              />
            )}
          </div>
        </Group>

        <Divider />

        <Group>
          <IconBtn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><RiAlignLeft size={16} /></IconBtn>
          <IconBtn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><RiAlignCenter size={16} /></IconBtn>
          <IconBtn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><RiAlignRight size={16} /></IconBtn>
          <IconBtn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()}><RiAlignJustify size={16} /></IconBtn>

          {/* Line spacing */}
          <div style={{ position: 'relative' }}>
            <IconBtn title="Line spacing" onClick={() => toggle('spacing')}><RiLineHeight size={16} /></IconBtn>
            {openMenu === 'spacing' && (
              <div style={{ ...S.dropdown, minWidth: 110 }}>
                {LINE_SPACINGS.map((s) => (
                  <MenuItem key={s.value} onClick={() => { (chain() as any).setLineHeight(s.value).run(); setOpenMenu(null); }}>{s.label}</MenuItem>
                ))}
              </div>
            )}
          </div>
        </Group>

        <Divider />

        <Group>
          <IconBtn title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><RiListUnordered size={16} /></IconBtn>
          <IconBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><RiListOrdered size={16} /></IconBtn>
        </Group>

        <Divider />

        <Group>
          {/* Insert table */}
          <div style={{ position: 'relative' }}>
            <IconBtn title="Insert table" onClick={() => toggle('table')}><RiTable2 size={16} /></IconBtn>
            {openMenu === 'table' && (
              <div style={{ ...S.dropdown, padding: 10 }} onMouseLeave={() => setHoveredGrid({ r: 0, c: 0 })}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                  {hoveredGrid.r > 0 ? `${hoveredGrid.r} × ${hoveredGrid.c} table` : 'Insert table'}
                </div>
                {Array.from({ length: 8 }).map((_, ri) => (
                  <div key={ri} style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                    {Array.from({ length: 8 }).map((__, ci) => {
                      const on = ri < hoveredGrid.r && ci < hoveredGrid.c;
                      return (
                        <div
                          key={ci}
                          onMouseEnter={() => setHoveredGrid({ r: ri + 1, c: ci + 1 })}
                          onClick={() => { chain().insertTable({ rows: ri + 1, cols: ci + 1, withHeaderRow: true }).run(); setOpenMenu(null); }}
                          style={{ width: 15, height: 15, cursor: 'pointer', border: `1px solid ${on ? '#0563c1' : '#cbd5e1'}`, background: on ? '#cfe2f3' : '#fff' }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Insert divider */}
          <div style={{ position: 'relative' }}>
            <IconBtn title="Insert divider line" onClick={() => toggle('divider')}><RiSeparator size={16} /></IconBtn>
            {openMenu === 'divider' && (
              <div style={{ ...S.dropdown, minWidth: 170 }}>
                <MenuItem onClick={() => insertDivider('border:none;border-top:1px solid #000000;margin:12px 0')}>Thin line</MenuItem>
                <MenuItem onClick={() => insertDivider('border:none;border-top:3px solid #000000;margin:12px 0')}>Thick line</MenuItem>
                <MenuItem onClick={() => insertDivider('border:none;border-top:2px solid #0563c1;margin:12px 0')}>Blue accent</MenuItem>
                <MenuItem onClick={() => insertDivider('border:none;border-top:2px double #000000;margin:12px 0;height:3px')}>Double line</MenuItem>
                <MenuItem onClick={() => insertDivider('border:none;border-top:1px dotted #666666;margin:12px 0')}>Dotted line</MenuItem>
              </div>
            )}
          </div>

          <IconBtn title="Insert logo / image" onClick={() => fileInputRef.current?.click()}><RiImageAddLine size={16} /></IconBtn>
          <IconBtn title="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}><RiFormatClear size={16} /></IconBtn>
        </Group>
      </div>

      {/* ── CONTEXT BAR: TABLE ───────────────────────────────────────────── */}
      {editor.isActive('table') && (
        <div style={S.contextBar}>
          <span style={S.contextLabel}>Table</span>
          <TextBtn onClick={() => chain().addRowBefore().run()}>Row above</TextBtn>
          <TextBtn onClick={() => chain().addRowAfter().run()}>Row below</TextBtn>
          <TextBtn onClick={() => chain().deleteRow().run()} danger>Delete row</TextBtn>
          <MiniDivider />
          <TextBtn onClick={() => chain().addColumnBefore().run()}>Col left</TextBtn>
          <TextBtn onClick={() => chain().addColumnAfter().run()}>Col right</TextBtn>
          <TextBtn onClick={() => chain().deleteColumn().run()} danger>Delete col</TextBtn>
          <MiniDivider />
          <TextBtn onClick={() => chain().mergeCells().run()}>Merge</TextBtn>
          <TextBtn onClick={() => chain().splitCell().run()}>Split</TextBtn>
          <TextBtn onClick={() => chain().toggleHeaderRow().run()}>Header row</TextBtn>
          <MiniDivider />
          <TextBtn onClick={() => chain().deleteTable().run()} danger>Delete table</TextBtn>
        </div>
      )}

      {/* ── CONTEXT BAR: IMAGE ───────────────────────────────────────────── */}
      {imgActive && (
        <div style={{ ...S.contextBar, background: '#ecfdf5', borderColor: '#a7f3d0' }}>
          <span style={{ ...S.contextLabel, color: '#059669' }}>Image</span>
          <span style={{ fontSize: '0.7rem', color: '#475569' }}>Width</span>
          <input
            type="range" min={40} max={640} step={10} value={imgWidth}
            onChange={(e) => chain().updateAttributes('image', { width: e.target.value }).run()}
            style={{ width: 120 }}
          />
          <span style={{ fontSize: '0.7rem', fontWeight: 600, minWidth: 42 }}>{imgWidth}px</span>
          <MiniDivider />
          <TextBtn onClick={() => chain().updateAttributes('image', { align: 'left' }).run()}>Left</TextBtn>
          <TextBtn onClick={() => chain().updateAttributes('image', { align: 'center' }).run()}>Center</TextBtn>
          <TextBtn onClick={() => chain().updateAttributes('image', { align: 'right' }).run()}>Right</TextBtn>
          <MiniDivider />
          <TextBtn onClick={() => chain().deleteSelection().run()} danger><RiDeleteBinLine size={12} style={{ verticalAlign: 'middle' }} /> Remove</TextBtn>
        </div>
      )}

      {/* ── PAGE CANVAS ──────────────────────────────────────────────────── */}
      <div style={S.canvas}>
        <div style={S.paper}>
          <div style={{ position: 'relative' }}>
            {isEmpty && <div style={S.placeholder}>{placeholder}</div>}
            <EditorContent editor={editor} className="rte-content" style={{ minHeight }} />
          </div>
        </div>
      </div>

      <style>{`
        ${buildDocCss('.rte-content .ProseMirror')}
        .rte-content .ProseMirror { outline: none; min-height: ${minHeight}; }
        .rte-content .ProseMirror:focus { outline: none; }
        .rte-content .ProseMirror table { position: relative; overflow: hidden; }
        .rte-content .ProseMirror td, .rte-content .ProseMirror th { position: relative; }
        .rte-content .ProseMirror .selectedCell:after {
          content: ""; position: absolute; inset: 0; background: rgba(5,99,193,0.12); pointer-events: none; z-index: 2;
        }
        .rte-content .ProseMirror .column-resize-handle {
          position: absolute; right: -2px; top: 0; bottom: 0; width: 4px;
          background: #0563c1; cursor: col-resize; z-index: 10;
        }
        .rte-content .ProseMirror img.ProseMirror-selectednode { outline: 3px solid #10b981; outline-offset: 2px; }
        .rte-content .ProseMirror hr.ProseMirror-selectednode { outline: 2px solid #0563c1; }
        .rte-content .ProseMirror.resize-cursor { cursor: col-resize; }
      `}</style>
    </div>
  );
}

// ─── SMALL UI PRIMITIVES ─────────────────────────────────────────────────────
function Group({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>{children}</div>;
}
function Divider() {
  return <div style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 4px' }} />;
}
function MiniDivider() {
  return <div style={{ width: 1, height: 16, background: '#cbd5e1', margin: '0 2px' }} />;
}

function IconBtn({ children, onClick, active, disabled, title }: {
  children: React.ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean; title?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button" title={title} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, border: 'none', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? '#e0f2fe' : hover && !disabled ? '#f1f5f9' : 'transparent',
        color: disabled ? '#cbd5e1' : active ? '#0369a1' : '#334155', transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  );
}

function Menu({ label, width, open, onToggle, children }: {
  label: string; width: number; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button" onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
          width, height: 30, padding: '0 8px', border: '1px solid transparent', borderRadius: 4,
          background: open ? '#f1f5f9' : 'transparent', cursor: 'pointer', color: '#334155',
          fontSize: '0.78rem', fontWeight: 600,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <RiArrowDownSLine size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>
      {open && <div style={S.dropdown}>{children}</div>}
    </div>
  );
}

function MenuItem({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', border: 'none',
        background: hover ? '#f1f5f9' : 'transparent', cursor: 'pointer', fontSize: '0.8rem',
        color: '#1e293b', ...style,
      }}
    >
      {children}
    </button>
  );
}

function TextBtn({ children, onClick, danger }: { children: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        padding: '3px 8px', fontSize: '0.7rem', fontWeight: 600, borderRadius: 4,
        border: '1px solid ' + (danger ? '#fecaca' : '#e2e8f0'),
        background: hover ? (danger ? '#fef2f2' : '#f1f5f9') : '#fff',
        color: danger ? '#dc2626' : '#334155', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function ColorGrid({ onPick, onReset, resetLabel }: { onPick: (c: string) => void; onReset: () => void; resetLabel: string }) {
  return (
    <div style={{ ...S.dropdown, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: 8, width: 182 }}>
      {COLOR_PALETTE.map((c) => (
        <button
          key={c} type="button" onClick={() => onPick(c)} title={c}
          style={{ width: 18, height: 18, background: c, border: '1px solid #cbd5e1', borderRadius: 2, cursor: 'pointer', padding: 0 }}
        />
      ))}
      <button
        type="button" onClick={onReset}
        style={{ gridColumn: 'span 7', marginTop: 4, padding: '5px 0', fontSize: '0.7rem', fontWeight: 600, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', borderRadius: 4 }}
      >
        {resetLabel}
      </button>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', flexDirection: 'column', border: '1px solid #d1d5db',
    borderRadius: 6, overflow: 'hidden', background: '#f8fafc', width: '100%', height: '100%',
  },
  toolbar: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, padding: '6px 8px',
    background: '#ffffff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 20,
  },
  sizeBox: {
    display: 'flex', alignItems: 'center', height: 30, border: '1px solid #e2e8f0',
    borderRadius: 4, overflow: 'hidden', position: 'relative', background: '#fff',
  },
  sizeStep: { width: 22, height: '100%', border: 'none', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: '1rem', fontWeight: 700 },
  sizeValue: { display: 'flex', alignItems: 'center', gap: 2, height: '100%', minWidth: 52, padding: '0 6px', border: 'none', background: '#fff', color: '#334155', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 },
  colorBar: { position: 'absolute', left: 6, right: 6, bottom: 4, height: 3, borderRadius: 1 },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 6, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', zIndex: 100, minWidth: 150,
    padding: '4px 0', maxHeight: 320, overflowY: 'auto',
  },
  contextBar: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, padding: '6px 10px',
    background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
  },
  contextLabel: { fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0369a1', marginRight: 4 },
  canvas: {
    flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#e9edf2',
    display: 'flex', justifyContent: 'center',
  },
  paper: {
    width: '100%', maxWidth: 820, minHeight: '100%', background: '#fff', padding: '2.5rem 2.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb',
    boxSizing: 'border-box',
  },
  placeholder: {
    position: 'absolute', top: 0, left: 0, pointerEvents: 'none', color: '#9ca3af',
    fontFamily: DOC_BASE.fontFamily, fontSize: DOC_BASE.fontSize,
  },
};
