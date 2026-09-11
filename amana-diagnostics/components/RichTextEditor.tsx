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
import styles from './RichTextEditor.module.css';

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

/** Each swatch says what it is, not its hex code. */
const COLOR_PALETTE: { hex: string; name: string }[] = [
  { hex: '#000000', name: 'Black' }, { hex: '#434343', name: 'Dark grey 4' }, { hex: '#666666', name: 'Dark grey 3' },
  { hex: '#999999', name: 'Dark grey 2' }, { hex: '#cccccc', name: 'Light grey 2' }, { hex: '#efefef', name: 'Light grey 1' },
  { hex: '#ffffff', name: 'White' },
  { hex: '#980000', name: 'Dark red' }, { hex: '#ff0000', name: 'Red' }, { hex: '#ff9900', name: 'Orange' },
  { hex: '#ffff00', name: 'Yellow' }, { hex: '#00ff00', name: 'Green' }, { hex: '#00ffff', name: 'Cyan' },
  { hex: '#0563c1', name: 'Letterhead blue' },
  { hex: '#0000ff', name: 'Blue' }, { hex: '#9900ff', name: 'Purple' }, { hex: '#ff00ff', name: 'Magenta' },
  { hex: '#c00000', name: 'Letterhead red' }, { hex: '#4472c4', name: 'Brand blue' }, { hex: '#2e7d32', name: 'Forest green' },
  { hex: '#7c3aed', name: 'Violet' },
  { hex: '#f4cccc', name: 'Light red 3' }, { hex: '#fce5cd', name: 'Light orange 3' }, { hex: '#fff2cc', name: 'Light yellow 3' },
  { hex: '#d9ead3', name: 'Light green 3' }, { hex: '#d0e0e3', name: 'Light cyan 3' }, { hex: '#cfe2f3', name: 'Light blue 3' },
  { hex: '#ead1dc', name: 'Light magenta 3' },
  { hex: '#ea9999', name: 'Light red 2' }, { hex: '#f9cb9c', name: 'Light orange 2' }, { hex: '#ffe599', name: 'Light yellow 2' },
  { hex: '#b6d7a8', name: 'Light green 2' }, { hex: '#a2c4c9', name: 'Light cyan 2' }, { hex: '#9fc5e8', name: 'Light blue 2' },
  { hex: '#b4a7d6', name: 'Light purple 2' },
  { hex: '#cc0000', name: 'Red 2' }, { hex: '#e69138', name: 'Orange 2' }, { hex: '#f1c232', name: 'Yellow 2' },
  { hex: '#6aa84f', name: 'Green 2' }, { hex: '#45818e', name: 'Cyan 2' }, { hex: '#3d85c6', name: 'Blue 2' },
  { hex: '#674ea7', name: 'Purple 2' },
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

  // Escape closes whichever menu is open, from wherever focus is inside.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && openMenu) {
      e.stopPropagation();
      setOpenMenu(null);
    }
  };

  return (
    <div ref={rootRef} className={styles['container']} onKeyDown={onKeyDown}>
      <input type="file" ref={fileInputRef} accept="image/*" className={styles['fileInput']} onChange={onImageFile} />

      {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
      <div className={styles['toolbar']} role="toolbar" aria-label="Formatting">
        <Group>
          <IconBtn label="Undo (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><RiArrowGoBackLine size={16} /></IconBtn>
          <IconBtn label="Redo (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><RiArrowGoForwardLine size={16} /></IconBtn>
        </Group>

        <Divider />

        {/* Block type */}
        <Menu label={blockLabel} name="Paragraph style" width={116} open={openMenu === 'block'} onToggle={() => toggle('block')}>
          <MenuItem onClick={() => { chain().setParagraph().run(); setOpenMenu(null); }}>Normal text</MenuItem>
          <MenuItem onClick={() => { chain().toggleHeading({ level: 1 }).run(); setOpenMenu(null); }} className={styles['menuItemH1']}>Heading 1</MenuItem>
          <MenuItem onClick={() => { chain().toggleHeading({ level: 2 }).run(); setOpenMenu(null); }} className={styles['menuItemH2']}>Heading 2</MenuItem>
          <MenuItem onClick={() => { chain().toggleHeading({ level: 3 }).run(); setOpenMenu(null); }} className={styles['menuItemH3']}>Heading 3</MenuItem>
        </Menu>

        {/* Font family */}
        <Menu label={currentFont} name="Font family" width={140} open={openMenu === 'font'} onToggle={() => toggle('font')}>
          {FONTS.map((f) => (
            // The face itself is the preview, so this one style is the value.
            <MenuItem key={f.label} onClick={() => { chain().setFontFamily(f.value).run(); setOpenMenu(null); }} style={{ fontFamily: f.value }}>
              {f.label}
            </MenuItem>
          ))}
        </Menu>

        {/* Font size */}
        <div className={styles['sizeBox']}>
          <button type="button" className={styles['sizeStep']} aria-label="Smaller text" onClick={() => stepFontSize(false)}>−</button>
          <button
            type="button"
            className={styles['sizeValue']}
            aria-label={`Font size, ${currentSize}`}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'size'}
            onClick={() => toggle('size')}
          >
            {currentSize}<RiArrowDownSLine size={12} className={styles['menuCaret']} aria-hidden="true" />
          </button>
          <button type="button" className={styles['sizeStep']} aria-label="Larger text" onClick={() => stepFontSize(true)}>+</button>
          {openMenu === 'size' && (
            <div className={cx(styles['dropdown'], styles['dropdownRight'], styles['dropdownNarrow'])} role="menu" aria-label="Font size">
              {FONT_SIZES.map((s) => (
                <MenuItem key={s} onClick={() => applyFontSize(s)}>{s}</MenuItem>
              ))}
            </div>
          )}
        </div>

        <Divider />

        <Group>
          <IconBtn label="Bold (Ctrl+B)" pressed={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><RiBold size={16} /></IconBtn>
          <IconBtn label="Italic (Ctrl+I)" pressed={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><RiItalic size={16} /></IconBtn>
          <IconBtn label="Underline (Ctrl+U)" pressed={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><RiUnderline size={16} /></IconBtn>
          <IconBtn label="Strikethrough" pressed={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><RiStrikethrough size={16} /></IconBtn>

          {/* Text colour */}
          <div className={styles['menuWrap']}>
            <IconBtn label="Text colour" expanded={openMenu === 'color'} onClick={() => toggle('color')}>
              <RiFontColor size={16} />
              {/* The bar shows the current colour; its value is the style. */}
              <span className={styles['colorBar']} style={{ background: currentColor }} />
            </IconBtn>
            {openMenu === 'color' && (
              <ColorGrid
                name="Text colour"
                onPick={(c) => { (chain() as any).setColor(c).run(); setOpenMenu(null); }}
                onReset={() => { (chain() as any).unsetColor().run(); setOpenMenu(null); }}
                resetLabel="Automatic"
              />
            )}
          </div>

          {/* Highlight */}
          <div className={styles['menuWrap']}>
            <IconBtn label="Highlight" expanded={openMenu === 'highlight'} onClick={() => toggle('highlight')}>
              <RiMarkPenLine size={16} />
              <span
                className={cx(styles['colorBar'], !currentHighlight && styles['colorBarEmpty'])}
                style={{ background: currentHighlight || 'transparent' }}
              />
            </IconBtn>
            {openMenu === 'highlight' && (
              <ColorGrid
                name="Highlight colour"
                onPick={(c) => { (chain() as any).setBackgroundColor(c).run(); setOpenMenu(null); }}
                onReset={() => { (chain() as any).unsetBackgroundColor().run(); setOpenMenu(null); }}
                resetLabel="No highlight"
              />
            )}
          </div>
        </Group>

        <Divider />

        <Group>
          <IconBtn label="Align left" pressed={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><RiAlignLeft size={16} /></IconBtn>
          <IconBtn label="Align centre" pressed={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><RiAlignCenter size={16} /></IconBtn>
          <IconBtn label="Align right" pressed={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><RiAlignRight size={16} /></IconBtn>
          <IconBtn label="Justify" pressed={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()}><RiAlignJustify size={16} /></IconBtn>

          {/* Line spacing */}
          <div className={styles['menuWrap']}>
            <IconBtn label="Line spacing" expanded={openMenu === 'spacing'} onClick={() => toggle('spacing')}><RiLineHeight size={16} /></IconBtn>
            {openMenu === 'spacing' && (
              <div className={cx(styles['dropdown'], styles['dropdownMid'])} role="menu" aria-label="Line spacing">
                {LINE_SPACINGS.map((s) => (
                  <MenuItem key={s.value} onClick={() => { (chain() as any).setLineHeight(s.value).run(); setOpenMenu(null); }}>{s.label}</MenuItem>
                ))}
              </div>
            )}
          </div>
        </Group>

        <Divider />

        <Group>
          <IconBtn label="Bulleted list" pressed={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><RiListUnordered size={16} /></IconBtn>
          <IconBtn label="Numbered list" pressed={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><RiListOrdered size={16} /></IconBtn>
        </Group>

        <Divider />

        <Group>
          {/* Insert table. The size picker was an 8×8 grid of <div onClick>:
            * nothing a keyboard could reach, so no way to insert a table
            * without a mouse. Every cell is a button now. */}
          <div className={styles['menuWrap']}>
            <IconBtn label="Insert table" expanded={openMenu === 'table'} onClick={() => toggle('table')}><RiTable2 size={16} /></IconBtn>
            {openMenu === 'table' && (
              <div
                className={cx(styles['dropdown'], styles['tablePicker'])}
                role="group"
                aria-label="Table size"
                onMouseLeave={() => setHoveredGrid({ r: 0, c: 0 })}
              >
                <div className={styles['tablePickerLabel']} aria-hidden="true">
                  {hoveredGrid.r > 0 ? `${hoveredGrid.r} × ${hoveredGrid.c} table` : 'Insert table'}
                </div>
                {Array.from({ length: 8 }).map((_, ri) => (
                  <div key={ri} className={styles['tableRow']}>
                    {Array.from({ length: 8 }).map((__, ci) => {
                      const on = ri < hoveredGrid.r && ci < hoveredGrid.c;
                      return (
                        <button
                          key={ci}
                          type="button"
                          aria-label={`${ri + 1} by ${ci + 1} table`}
                          className={cx(styles['tableCell'], on && styles['tableCellOn'])}
                          onMouseEnter={() => setHoveredGrid({ r: ri + 1, c: ci + 1 })}
                          onFocus={() => setHoveredGrid({ r: ri + 1, c: ci + 1 })}
                          onClick={() => { chain().insertTable({ rows: ri + 1, cols: ci + 1, withHeaderRow: true }).run(); setOpenMenu(null); }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Insert divider */}
          <div className={styles['menuWrap']}>
            <IconBtn label="Insert divider line" expanded={openMenu === 'divider'} onClick={() => toggle('divider')}><RiSeparator size={16} /></IconBtn>
            {openMenu === 'divider' && (
              <div className={cx(styles['dropdown'], styles['dropdownWide'])} role="menu" aria-label="Divider style">
                <MenuItem onClick={() => insertDivider('border:none;border-top:1px solid #000000;margin:12px 0')}>Thin line</MenuItem>
                <MenuItem onClick={() => insertDivider('border:none;border-top:3px solid #000000;margin:12px 0')}>Thick line</MenuItem>
                <MenuItem onClick={() => insertDivider('border:none;border-top:2px solid #0563c1;margin:12px 0')}>Blue accent</MenuItem>
                <MenuItem onClick={() => insertDivider('border:none;border-top:2px double #000000;margin:12px 0;height:3px')}>Double line</MenuItem>
                <MenuItem onClick={() => insertDivider('border:none;border-top:1px dotted #666666;margin:12px 0')}>Dotted line</MenuItem>
              </div>
            )}
          </div>

          <IconBtn label="Insert logo or image" onClick={() => fileInputRef.current?.click()}><RiImageAddLine size={16} /></IconBtn>
          <IconBtn label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}><RiFormatClear size={16} /></IconBtn>
        </Group>
      </div>

      {/* ── CONTEXT BAR: TABLE ───────────────────────────────────────────── */}
      {editor.isActive('table') && (
        <div className={styles['contextBar']} role="toolbar" aria-label="Table">
          <span className={styles['contextLabel']} aria-hidden="true">Table</span>
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
        <div className={cx(styles['contextBar'], styles['contextBarImage'])} role="toolbar" aria-label="Image">
          <span className={styles['contextLabel']} aria-hidden="true">Image</span>
          <label className={styles['contextHint']}>
            Width
            <input
              type="range" min={40} max={640} step={10} value={imgWidth}
              className={styles['range']}
              onChange={(e) => chain().updateAttributes('image', { width: e.target.value }).run()}
            />
          </label>
          <span className={styles['contextValue']}>{imgWidth}px</span>
          <MiniDivider />
          <TextBtn onClick={() => chain().updateAttributes('image', { align: 'left' }).run()}>Left</TextBtn>
          <TextBtn onClick={() => chain().updateAttributes('image', { align: 'center' }).run()}>Centre</TextBtn>
          <TextBtn onClick={() => chain().updateAttributes('image', { align: 'right' }).run()}>Right</TextBtn>
          <MiniDivider />
          <TextBtn onClick={() => chain().deleteSelection().run()} danger><RiDeleteBinLine size={12} aria-hidden="true" /> Remove</TextBtn>
        </div>
      )}

      {/* ── PAGE CANVAS ──────────────────────────────────────────────────── */}
      <div className={styles['canvas']}>
        <div className={styles['paper']}>
          {isEmpty && (
            <div className={styles['placeholder']} style={{ fontFamily: DOC_BASE.fontFamily, fontSize: DOC_BASE.fontSize }} aria-hidden="true">
              {placeholder}
            </div>
          )}
          <EditorContent editor={editor} className="rte-content" style={{ minHeight }} />
        </div>
      </div>

      <style>{`
        ${buildDocCss('.rte-content .ProseMirror')}
        .rte-content .ProseMirror { min-height: ${minHeight}; }
        .rte-content .ProseMirror:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 4px; }
        .rte-content .ProseMirror table { position: relative; overflow: hidden; }
        .rte-content .ProseMirror td, .rte-content .ProseMirror th { position: relative; }
        .rte-content .ProseMirror .selectedCell:after {
          content: ""; position: absolute; inset: 0; background: rgba(5,99,193,0.12); pointer-events: none; z-index: 2;
        }
        .rte-content .ProseMirror .column-resize-handle {
          position: absolute; right: -2px; top: 0; bottom: 0; width: 4px;
          background: var(--accent-solid); cursor: col-resize; z-index: 10;
        }
        .rte-content .ProseMirror img.ProseMirror-selectednode { outline: 3px solid var(--success-solid); outline-offset: 2px; }
        .rte-content .ProseMirror hr.ProseMirror-selectednode { outline: 2px solid var(--accent-solid); }
        .rte-content .ProseMirror.resize-cursor { cursor: col-resize; }
      `}</style>
    </div>
  );
}

// ─── SMALL UI PRIMITIVES ─────────────────────────────────────────────────────
const cx = (...names: Array<string | undefined | false>) => names.filter(Boolean).join(' ');

function Group({ children }: { children: React.ReactNode }) {
  return <div className={styles['group']}>{children}</div>;
}
function Divider() {
  return <div className={styles['divider']} role="separator" aria-orientation="vertical" />;
}
function MiniDivider() {
  return <div className={styles['miniDivider']} role="separator" aria-orientation="vertical" />;
}

/**
 * A toolbar button. `pressed` makes it a toggle (bold, align left) and says
 * so; `expanded` makes it a menu opener and says that instead. The old one
 * had a title and a pale blue background, and no way to tell which was which.
 */
function IconBtn({ children, onClick, pressed, expanded, disabled, label }: {
  children: React.ReactNode; onClick?: () => void; pressed?: boolean; expanded?: boolean;
  disabled?: boolean; label: string;
}) {
  return (
    <button
      type="button"
      className={styles['iconBtn']}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-haspopup={expanded === undefined ? undefined : 'menu'}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Menu({ label, name, width, open, onToggle, children }: {
  label: string; name: string; width: number; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={styles['menuWrap']}>
      <button
        type="button"
        className={styles['menuBtn']}
        style={{ width }}
        aria-label={`${name}, ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className={styles['menuLabel']}>{label}</span>
        <RiArrowDownSLine size={14} className={styles['menuCaret']} aria-hidden="true" />
      </button>
      {open && <div className={styles['dropdown']} role="menu" aria-label={name}>{children}</div>}
    </div>
  );
}

function MenuItem({ children, onClick, className, style }: {
  children: React.ReactNode; onClick?: () => void; className?: string; style?: React.CSSProperties;
}) {
  return (
    <button type="button" role="menuitem" className={cx(styles['menuItem'], className)} style={style} onClick={onClick}>
      {children}
    </button>
  );
}

function TextBtn({ children, onClick, danger }: { children: React.ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button type="button" className={cx(styles['textBtn'], danger && styles['textBtnDanger'])} onClick={onClick}>
      {children}
    </button>
  );
}

function ColorGrid({ name, onPick, onReset, resetLabel }: {
  name: string; onPick: (c: string) => void; onReset: () => void; resetLabel: string;
}) {
  return (
    <div className={cx(styles['dropdown'], styles['colorGrid'])} role="group" aria-label={name}>
      {COLOR_PALETTE.map((c) => (
        // The swatch is the colour; its value is the style.
        <button
          key={c.hex}
          type="button"
          className={styles['swatch']}
          style={{ background: c.hex }}
          aria-label={c.name}
          title={c.name}
          onClick={() => onPick(c.hex)}
        />
      ))}
      <button type="button" className={styles['swatchReset']} onClick={onReset}>
        {resetLabel}
      </button>
    </div>
  );
}
