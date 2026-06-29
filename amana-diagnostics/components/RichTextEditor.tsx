'use client';
import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, Extension, Node as TipTapNode } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import { NodeSelection } from '@tiptap/pm/state';

import { 
  RiBold, RiItalic, RiUnderline, RiListUnordered, RiListOrdered,
  RiAlignLeft, RiAlignCenter, RiAlignRight, RiAlignJustify,
  RiTable2, RiArrowGoBackLine, RiArrowGoForwardLine,
  RiFontColor, RiImageAddLine, RiShapesLine, RiFontSize,
  RiLineHeight, RiHeading, RiSeparator, RiArrowDownSLine
} from '@remixicon/react';

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
function updateStyleString(styleStr: string, prop: string, val: string | null): string {
  const styles: Record<string, string> = {};
  (styleStr || '').split(';').forEach(s => {
    const parts = s.split(':');
    if (parts.length === 2) {
      styles[parts[0].trim().toLowerCase()] = parts[1].trim();
    }
  });
  const property = prop.toLowerCase();
  if (val === null || val === '') {
    delete styles[property];
  } else {
    styles[property] = val;
  }
  return Object.entries(styles)
    .map(([p, v]) => `${p}: ${v}`)
    .join('; ');
}

function getStyleProperty(styleStr: string, prop: string): string {
  if (!styleStr) return '';
  const match = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(styleStr);
  return match ? match[1].trim() : '';
}

// ─── CUSTOM EXTENSION: CUSTOM TEXT STYLE (Preserves All Styles Verbatim) ─────
const CustomTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes.style) return {};
          return { style: attributes.style };
        },
      },
      'data-shape': {
        default: null,
        parseHTML: element => element.getAttribute('data-shape'),
        renderHTML: attributes => {
          if (!attributes['data-shape']) return {};
          return { 'data-shape': attributes['data-shape'] };
        },
      },
      'data-shape-type': {
        default: null,
        parseHTML: element => element.getAttribute('data-shape-type'),
        renderHTML: attributes => {
          if (!attributes['data-shape-type']) return {};
          return { 'data-shape-type': attributes['data-shape-type'] };
        },
      },
    };
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain, state }: { chain: any; state: any }) => {
        const attrs = state.selection ? state.selection.$from.marks().find((m: any) => m.type.name === 'textStyle')?.attrs || {} : {};
        const currentStyle = attrs.style || '';
        const newStyle = updateStyleString(currentStyle, 'font-size', fontSize);
        return chain()
          .setMark('textStyle', { ...attrs, style: newStyle || null })
          .run();
      },
      setTextColor: (color: string) => ({ chain, state }: { chain: any; state: any }) => {
        const attrs = state.selection ? state.selection.$from.marks().find((m: any) => m.type.name === 'textStyle')?.attrs || {} : {};
        const currentStyle = attrs.style || '';
        const newStyle = updateStyleString(currentStyle, 'color', color);
        return chain()
          .setMark('textStyle', { ...attrs, style: newStyle || null })
          .run();
      },
      setHighlightColor: (backgroundColor: string) => ({ chain, state }: { chain: any; state: any }) => {
        const attrs = state.selection ? state.selection.$from.marks().find((m: any) => m.type.name === 'textStyle')?.attrs || {} : {};
        const currentStyle = attrs.style || '';
        const newStyle = updateStyleString(currentStyle, 'background-color', backgroundColor);
        return chain()
          .setMark('textStyle', { ...attrs, style: newStyle || null })
          .run();
      },
    } as any;
  },
});

// ─── CUSTOM EXTENSION: DIV CONTAINER (For Block Shapes & Dividers) ───────────
const DivNode = TipTapNode.create({
  name: 'div',
  group: 'block',
  content: 'inline*',
  defining: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes.style) return {};
          return { style: attributes.style };
        },
      },
      'data-shape': {
        default: null,
        parseHTML: element => element.getAttribute('data-shape'),
        renderHTML: attributes => {
          if (!attributes['data-shape']) return {};
          return { 'data-shape': attributes['data-shape'] };
        },
      },
      'data-shape-type': {
        default: null,
        parseHTML: element => element.getAttribute('data-shape-type'),
        renderHTML: attributes => {
          if (!attributes['data-shape-type']) return {};
          return { 'data-shape-type': attributes['data-shape-type'] };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0];
  },
});

// ─── CUSTOM EXTENSION: LINE HEIGHT ───────────────────────────────────────────
const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() {
    return {
      types: ['paragraph', 'heading', 'listItem'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: element => element.style.lineHeight,
            renderHTML: attributes => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight: (lineHeight: string) => ({ commands }: { commands: any }) => {
        return this.options.types
          .filter((type: string) => this.editor.isActive(type))
          .every((type: string) => commands.updateAttributes(type, { lineHeight }));
      },
      unsetLineHeight: () => ({ commands }: { commands: any }) => {
        return this.options.types
          .filter((type: string) => this.editor.isActive(type))
          .every((type: string) => commands.updateAttributes(type, { lineHeight: null }));
      },
    } as any;
  },
});

// ─── PROPS & FONTS ───────────────────────────────────────────────────────────
interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const FONTS = [
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' }
];

const COLOR_PALETTE = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc', '#efefef', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0563c1', '#0000ff', '#9900ff', '#ff00ff',
  '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#ead1dc',
  '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#9fc5e8', '#b4a7d6',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6fa8dc', '#8e7cc3',
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3d85c6', '#674ea7',
  '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#0b5394', '#351c75',
];

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = 'Type here...', 
  minHeight = '320px' 
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dropdown states
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showHighlightDropdown, setShowHighlightDropdown] = useState(false);
  const [showLineHeightDropdown, setShowLineHeightDropdown] = useState(false);
  const [showTableGrid, setShowTableGrid] = useState(false);
  const [showShapesDropdown, setShowShapesDropdown] = useState(false);

  // Hovered table grid coordinates
  const [hoveredGrid, setHoveredGrid] = useState({ r: 0, c: 0 });

  // Input states
  const [fontSizeInput, setFontSizeInput] = useState('11pt');

  // Selected shape/image element state
  const [activeShapeEl, setActiveShapeEl] = useState<HTMLElement | null>(null);
  const [shapeProperties, setShapeProperties] = useState({
    type: 'line-solid',
    height: '4px',
    backgroundColor: '#3b82f6',
    borderColor: '#9ca3af',
    borderWidth: '0px',
    borderStyle: 'solid',
    padding: '12px',
    width: '100%',
    textAlign: 'left',
    color: '#000000',
    borderRadius: '0px',
    marginLeft: '0px',
    marginRight: 'auto',
  });

  const fontRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineHeightRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const shapesRef = useRef<HTMLDivElement>(null);

  // Initialize TipTap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {},
        orderedList: {},
      }),
      Underline,
      CustomTextStyle,
      FontFamily,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      DivNode,
      LineHeight,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      handleClick(view, pos, event) {
        const target = event.target as HTMLElement;
        const shapeEl = target.closest('[data-shape]') as HTMLElement | null;
        if (shapeEl) {
          if (shapeEl.tagName.toLowerCase() === 'div') {
            const nodePos = view.posAtDOM(shapeEl, 0);
            if (nodePos !== undefined && nodePos >= 0) {
              try {
                const nodeSelection = NodeSelection.create(view.state.doc, nodePos);
                view.dispatch(view.state.tr.setSelection(nodeSelection));
                return true; // prevent default cursor placement outside the block shape
              } catch (err) {
                console.error('Failed to select shape node:', err);
              }
            }
          }
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync value from parent if it changes from outside
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false as any);
    }
  }, [value, editor]);

  // Handle active states and selection sync
  useEffect(() => {
    if (!editor) return;

    const handleSelection = () => {
      // Sync Font Size from unified style string
      const attrs = editor.getAttributes('textStyle');
      const styleStr = attrs.style || '';
      const fontSize = getStyleProperty(styleStr, 'font-size') || '11pt';
      setFontSizeInput(fontSize);

      // Sync active Shape (if selection is on a Shape)
      const { view, state } = editor;
      const { selection } = state;
      
      let shapeEl: HTMLElement | null = null;
      if (selection instanceof NodeSelection) {
        shapeEl = view.nodeDOM(selection.from) as HTMLElement | null;
      } else {
        let node = view.domAtPos(selection.from).node as HTMLElement;
        if (node.nodeType === 3) { // 3 is Node.TEXT_NODE
          node = node.parentNode as HTMLElement;
        }
        shapeEl = node.closest('[data-shape]') as HTMLElement | null;
      }
      
      if (shapeEl) {
        setActiveShapeEl(shapeEl);
        
        // Parse inline styles
        const styleAttr = shapeEl.getAttribute('style') || '';
        const styles: Record<string, string> = {};
        styleAttr.split(';').forEach(s => {
          const parts = s.split(':');
          if (parts.length === 2) {
            styles[parts[0].trim().toLowerCase()] = parts[1].trim();
          }
        });

        setShapeProperties({
          type: shapeEl.getAttribute('data-shape-type') || 'line-solid',
          height: styles['height'] || '4px',
          backgroundColor: styles['background-color'] || '#3b82f6',
          borderColor: styles['border-color'] || '#9ca3af',
          borderWidth: styles['border-width'] || '0px',
          borderStyle: styles['border-style'] || 'solid',
          padding: styles['padding'] || '12px',
          width: styles['width'] || '100%',
          textAlign: styles['text-align'] || 'left',
          color: styles['color'] || '#000000',
          borderRadius: styles['border-radius'] || '0px',
          marginLeft: styles['margin-left'] || '0px',
          marginRight: styles['margin-right'] || 'auto',
        });
      } else {
        setActiveShapeEl(null);
      }
    };

    editor.on('selectionUpdate', handleSelection);
    return () => {
      editor.off('selectionUpdate', handleSelection);
    };
  }, [editor]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fontRef.current && !fontRef.current.contains(target)) setShowFontDropdown(false);
      if (headingRef.current && !headingRef.current.contains(target)) setShowHeadingDropdown(false);
      if (colorRef.current && !colorRef.current.contains(target)) setShowColorDropdown(false);
      if (highlightRef.current && !highlightRef.current.contains(target)) setShowHighlightDropdown(false);
      if (lineHeightRef.current && !lineHeightRef.current.contains(target)) setShowLineHeightDropdown(false);
      if (gridContainerRef.current && !gridContainerRef.current.contains(target)) setShowTableGrid(false);
      if (shapesRef.current && !shapesRef.current.contains(target)) setShowShapesDropdown(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!editor) return null;

  // ─── COMMAND WRAPPERS ──────────────────────────────────────────────────────
  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleUnderline = () => editor.chain().focus().toggleUnderline().run();
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();
  
  const alignLeft = () => editor.chain().focus().setTextAlign('left').run();
  const alignCenter = () => editor.chain().focus().setTextAlign('center').run();
  const alignRight = () => editor.chain().focus().setTextAlign('right').run();
  const alignJustify = () => editor.chain().focus().setTextAlign('justify').run();

  const handleHeadingSelect = (level: any) => {
    if (level === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
    setShowHeadingDropdown(false);
  };

  const handleFontSelect = (fontFamily: string) => {
    editor.chain().focus().setFontFamily(fontFamily).run();
    setShowFontDropdown(false);
  };

  const handleTextColor = (color: string) => {
    (editor.chain().focus() as any).setTextColor(color).run();
    setShowColorDropdown(false);
  };

  const handleHighlightColor = (color: string) => {
    (editor.chain().focus() as any).setHighlightColor(color).run();
    setShowHighlightDropdown(false);
  };

  const handleLineHeightSelect = (spacing: string) => {
    (editor.chain().focus() as any).setLineHeight(spacing).run();
    setShowLineHeightDropdown(false);
  };

  // Font Size Actions
  const applyFontSize = (val: string) => {
    let size = val.trim();
    if (!size) return;
    if (/^\d+$/.test(size)) {
      size = size + 'pt'; // Default to pt if plain number is provided
    }
    setFontSizeInput(size);
    (editor.chain().focus() as any).setFontSize(size).run();
  };

  const changeFontSizeStep = (increment: boolean) => {
    const match = fontSizeInput.match(/^(\d+(?:\.\d+)?)(.*)$/);
    if (match) {
      const currentVal = parseFloat(match[1]);
      const unit = match[2] || 'pt';
      const newVal = increment ? currentVal + 1 : Math.max(1, currentVal - 1);
      applyFontSize(`${newVal}${unit}`);
    } else {
      applyFontSize(increment ? '12pt' : '10pt');
    }
  };

  // Image Upload Action
  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  // Table Grid Actions
  const renderGridSquares = () => {
    const rows = 8;
    const cols = 8;
    const gridRows = [];
    for (let r = 1; r <= rows; r++) {
      const rowCells = [];
      for (let c = 1; c <= cols; c++) {
        const isHighlighted = r <= hoveredGrid.r && c <= hoveredGrid.c;
        rowCells.push(
          <div
            key={`${r}-${c}`}
            onMouseEnter={() => setHoveredGrid({ r, c })}
            onClick={() => {
              editor.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: false }).run();
              setShowTableGrid(false);
            }}
            style={{
              width: '16px', height: '16px', border: '1px solid #cbd5e1',
              backgroundColor: isHighlighted ? '#cfe2f3' : '#ffffff',
              borderColor: isHighlighted ? '#0563c1' : '#cbd5e1',
              cursor: 'pointer', transition: 'background-color 0.05s, border-color 0.05s',
            }}
          />
        );
      }
      gridRows.push(<div key={r} style={{ display: 'flex', gap: '3px' }}>{rowCells}</div>);
    }
    return gridRows;
  };

  // Shape Actions
  const insertShapeNode = (type: string) => {
    let html = '';
    switch (type) {
      case 'line-solid':
        html = '<div data-shape="true" data-shape-type="line-solid" style="height: 4px; background-color: #3b82f6; margin: 12px 0; width: 100%; display: block; border-radius: 0; box-sizing: border-box;"></div><p></p>';
        break;
      case 'line-double':
        html = '<div data-shape="true" data-shape-type="line-double" style="height: 6px; border-top: 2px solid #9ca3af; border-bottom: 2px solid #9ca3af; background: transparent; margin: 12px 0; width: 100%; display: block; border-radius: 0; box-sizing: border-box;"></div><p></p>';
        break;
      case 'line-dotted':
        html = '<div data-shape="true" data-shape-type="line-dotted" style="height: 0px; border-top: 3px dotted #9ca3af; margin: 12px 0; width: 100%; display: block; border-radius: 0; box-sizing: border-box;"></div><p></p>';
        break;
      case 'box-info':
        html = '<div data-shape="true" data-shape-type="box-info" style="border-left: 6px solid #3b82f6; background-color: #eff6ff; padding: 12px; margin: 12px 0; color: #1e3a8a; border-radius: 4px; min-height: 40px; box-sizing: border-box; width: 100%;"><strong>INFO:</strong> Enter details...</div><p></p>';
        break;
      case 'box-warning':
        html = '<div data-shape="true" data-shape-type="box-warning" style="border-left: 6px solid #f59e0b; background-color: #fffbeb; padding: 12px; margin: 12px 0; color: #78350f; border-radius: 4px; min-height: 40px; box-sizing: border-box; width: 100%;"><strong>NOTE:</strong> Enter details...</div><p></p>';
        break;
      case 'box-bordered':
        html = '<div data-shape="true" data-shape-type="box-bordered" style="border: 2px solid #cbd5e1; padding: 12px; margin: 12px 0; background-color: #f8fafc; border-radius: 4px; min-height: 40px; box-sizing: border-box; width: 100%;">Enter content...</div><p></p>';
        break;
      case 'badge-info':
        html = '<span data-shape="true" data-shape-type="badge-info" style="border: 1px solid #3b82f6; padding: 4px 8px; border-radius: 12px; display: inline-block; font-size: 0.75rem; font-weight: bold; color: #3b82f6; background-color: #eff6ff; margin: 0 4px; box-sizing: border-box;">Badge</span>';
        break;
      case 'badge-success':
        html = '<span data-shape="true" data-shape-type="badge-success" style="border: 1px solid #10b981; padding: 4px 8px; border-radius: 12px; display: inline-block; font-size: 0.75rem; font-weight: bold; color: #10b981; background-color: #ecfdf5; margin: 0 4px; box-sizing: border-box;">Success</span>';
        break;
    }
    
    editor.chain().focus().insertContent(html).run();
    setShowShapesDropdown(false);
  };

  // Modify Active Shape properties
  const updateShapeStyle = (prop: string, val: string) => {
    if (!activeShapeEl) return;
    
    // Apply changes directly to the DOM for immediate layout updates
    activeShapeEl.style[prop as any] = val;
    
    // Normalize custom double-border / dotted-border line colors
    const type = activeShapeEl.getAttribute('data-shape-type') || '';
    if (type === 'line-double' && prop === 'borderColor') {
      activeShapeEl.style.borderTopColor = val;
      activeShapeEl.style.borderBottomColor = val;
    } else if (type === 'line-dotted' && prop === 'borderColor') {
      activeShapeEl.style.borderTopColor = val;
    }

    // Sync style changes into TipTap's HTML/ProseMirror model
    const newStyle = activeShapeEl.getAttribute('style') || '';
    if (activeShapeEl.tagName.toLowerCase() === 'span') {
      editor.commands.updateAttributes('textStyle', { style: newStyle });
    } else {
      editor.commands.updateAttributes('div', { style: newStyle });
    }
    
    // Trigger callback
    onChange(editor.getHTML());
    
    // Re-sync properties state
    setShapeProperties(prev => ({
      ...prev,
      [prop]: val
    }));
  };

  return (
    <div style={editorContainerStyle}>
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/*" 
        onChange={handleImageSelect} 
      />

      {/* ─── GOOGLE DOCS TOOLBAR ───────────────────────────────────────────────── */}
      <div style={toolbarStyle}>
        {/* Group 1: Undo / Redo */}
        <div style={btnGroupStyle}>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().undo().run()} 
            disabled={!editor.can().undo()}
            style={btnStyle}
            title="Undo (Ctrl+Z)"
          >
            <RiArrowGoBackLine size={15} />
          </button>
          <button 
            type="button" 
            onClick={() => editor.chain().focus().redo().run()} 
            disabled={!editor.can().redo()}
            style={btnStyle}
            title="Redo (Ctrl+Y)"
          >
            <RiArrowGoForwardLine size={15} />
          </button>
        </div>

        <div style={dividerStyle} />

        {/* Group 2: Headings / Text Styles */}
        <div ref={headingRef} style={{ position: 'relative' }}>
          <button 
            type="button" 
            onClick={() => setShowHeadingDropdown(!showHeadingDropdown)} 
            style={{ ...btnStyle, width: '100px', justifyContent: 'space-between' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', fontWeight: 600 }}>
              {editor.isActive('heading', { level: 1 }) ? 'Heading 1' :
               editor.isActive('heading', { level: 2 }) ? 'Heading 2' :
               editor.isActive('heading', { level: 3 }) ? 'Heading 3' : 'Normal Text'}
            </span>
            <RiHeading size={14} style={{ opacity: 0.7 }} />
          </button>

          {showHeadingDropdown && (
            <div style={dropdownStyle}>
              <button type="button" onClick={() => handleHeadingSelect('paragraph')} style={dropdownItemStyle}>Normal Text</button>
              <button type="button" onClick={() => handleHeadingSelect(1)} style={{ ...dropdownItemStyle, fontSize: '1.25rem', fontWeight: 'bold' }}>Heading 1</button>
              <button type="button" onClick={() => handleHeadingSelect(2)} style={{ ...dropdownItemStyle, fontSize: '1.1rem', fontWeight: 'bold' }}>Heading 2</button>
              <button type="button" onClick={() => handleHeadingSelect(3)} style={{ ...dropdownItemStyle, fontSize: '1rem', fontWeight: 'bold' }}>Heading 3</button>
            </div>
          )}
        </div>

        <div style={dividerStyle} />

        {/* Group 3: Font Families */}
        <div ref={fontRef} style={{ position: 'relative' }}>
          <button 
            type="button" 
            onClick={() => setShowFontDropdown(!showFontDropdown)} 
            style={{ ...btnStyle, width: '140px', justifyContent: 'space-between' }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {editor.getAttributes('textStyle').fontFamily 
                ? FONTS.find(f => editor.getAttributes('textStyle').fontFamily === f.value)?.label || 'Times New Roman' 
                : 'Times New Roman'}
            </span>
            <RiArrowDownSLine size={14} style={{ opacity: 0.7 }} />
          </button>

          {showFontDropdown && (
            <div style={dropdownStyle}>
              {FONTS.map(f => (
                <button 
                  key={f.label} 
                  type="button" 
                  onClick={() => handleFontSelect(f.value)} 
                  style={{ ...dropdownItemStyle, fontFamily: f.value }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={dividerStyle} />

        {/* Group 4: Font Size Picker (Highly Editable) */}
        <div style={fontSizeContainerStyle}>
          <button 
            type="button" 
            onClick={() => changeFontSizeStep(false)} 
            style={fontSizeBtnStyle}
            title="Decrease font size"
          >
            -
          </button>
          <input
            type="text"
            value={fontSizeInput}
            onChange={(e) => setFontSizeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyFontSize(fontSizeInput);
                editor.commands.focus();
              }
            }}
            onBlur={() => applyFontSize(fontSizeInput)}
            style={fontSizeInputStyle}
            title="Font Size (Type size and press Enter)"
          />
          <button 
            type="button" 
            onClick={() => changeFontSizeStep(true)} 
            style={fontSizeBtnStyle}
            title="Increase font size"
          >
            +
          </button>
        </div>

        <div style={dividerStyle} />

        {/* Group 5: Text Formatting & Colors */}
        <div style={btnGroupStyle}>
          <button 
            type="button" 
            onClick={toggleBold} 
            style={activeBtnStyle(editor.isActive('bold'))}
            title="Bold (Ctrl+B)"
          >
            <RiBold size={15} />
          </button>
          <button 
            type="button" 
            onClick={toggleItalic} 
            style={activeBtnStyle(editor.isActive('italic'))}
            title="Italic (Ctrl+I)"
          >
            <RiItalic size={15} />
          </button>
          <button 
            type="button" 
            onClick={toggleUnderline} 
            style={activeBtnStyle(editor.isActive('underline'))}
            title="Underline (Ctrl+U)"
          >
            <RiUnderline size={15} />
          </button>

          {/* Text Color Selection */}
          <div ref={colorRef} style={{ position: 'relative' }}>
            <button 
              type="button" 
              onClick={() => setShowColorDropdown(!showColorDropdown)} 
              style={btnStyle}
              title="Text color"
            >
              <RiFontColor size={15} />
              <div style={{ position: 'absolute', bottom: 3, left: 6, right: 6, height: 3, backgroundColor: getStyleProperty(editor.getAttributes('textStyle').style || '', 'color') || '#000000' }} />
            </button>

            {showColorDropdown && (
              <div style={colorPaletteGridStyle}>
                {COLOR_PALETTE.map(c => (
                  <button 
                    key={c} 
                    type="button" 
                    onClick={() => handleTextColor(c)} 
                    style={colorSquareStyle(c)} 
                  />
                ))}
                <button 
                  type="button" 
                  onClick={() => {
                    (editor.chain().focus() as any).setTextColor(null).run();
                    setShowColorDropdown(false);
                  }} 
                  style={{ gridColumn: 'span 7', fontSize: '0.68rem', padding: '4px 0', border: '1px solid var(--gray-300)', background: '#fafafa', cursor: 'pointer', fontWeight: 600 }}
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* Highlight Color Selection */}
          <div ref={highlightRef} style={{ position: 'relative' }}>
            <button 
              type="button" 
              onClick={() => setShowHighlightDropdown(!showHighlightDropdown)} 
              style={btnStyle}
              title="Highlight color"
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 800, textDecoration: 'underline' }}>ab</span>
              <div style={{ position: 'absolute', bottom: 3, left: 6, right: 6, height: 3, backgroundColor: getStyleProperty(editor.getAttributes('textStyle').style || '', 'background-color') || 'transparent', border: '1px solid #cbd5e1' }} />
            </button>

            {showHighlightDropdown && (
              <div style={colorPaletteGridStyle}>
                {COLOR_PALETTE.map(c => (
                  <button 
                    key={c} 
                    type="button" 
                    onClick={() => handleHighlightColor(c)} 
                    style={colorSquareStyle(c)} 
                  />
                ))}
                <button 
                  type="button" 
                  onClick={() => {
                    (editor.chain().focus() as any).setHighlightColor(null).run();
                    setShowHighlightDropdown(false);
                  }} 
                  style={{ gridColumn: 'span 7', fontSize: '0.68rem', padding: '4px 0', border: '1px solid var(--gray-300)', background: '#fafafa', cursor: 'pointer', fontWeight: 600 }}
                >
                  No Color
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={dividerStyle} />

        {/* Group 6: Line Height (Line Spacing) */}
        <div ref={lineHeightRef} style={{ position: 'relative' }}>
          <button 
            type="button" 
            onClick={() => setShowLineHeightDropdown(!showLineHeightDropdown)} 
            style={btnStyle}
            title="Line Spacing"
          >
            <RiLineHeight size={15} />
          </button>

          {showLineHeightDropdown && (
            <div style={{ ...dropdownStyle, minWidth: '100px' }}>
              <button type="button" onClick={() => handleLineHeightSelect('1.0')} style={dropdownItemStyle}>Single (1.0)</button>
              <button type="button" onClick={() => handleLineHeightSelect('1.15')} style={dropdownItemStyle}>1.15 Spacing</button>
              <button type="button" onClick={() => handleLineHeightSelect('1.5')} style={dropdownItemStyle}>1.5 Spacing</button>
              <button type="button" onClick={() => handleLineHeightSelect('2.0')} style={dropdownItemStyle}>Double (2.0)</button>
              <button type="button" onClick={() => handleLineHeightSelect('3.0')} style={dropdownItemStyle}>Triple (3.0)</button>
            </div>
          )}
        </div>

        <div style={dividerStyle} />

        {/* Group 7: Alignments */}
        <div style={btnGroupStyle}>
          <button type="button" onClick={alignLeft} style={activeBtnStyle(editor.isActive({ textAlign: 'left' }))} title="Align left"><RiAlignLeft size={15} /></button>
          <button type="button" onClick={alignCenter} style={activeBtnStyle(editor.isActive({ textAlign: 'center' }))} title="Align center"><RiAlignCenter size={15} /></button>
          <button type="button" onClick={alignRight} style={activeBtnStyle(editor.isActive({ textAlign: 'right' }))} title="Align right"><RiAlignRight size={15} /></button>
          <button type="button" onClick={alignJustify} style={activeBtnStyle(editor.isActive({ textAlign: 'justify' }))} title="Justify"><RiAlignJustify size={15} /></button>
        </div>

        <div style={dividerStyle} />

        {/* Group 8: Bullet / Numbered Lists */}
        <div style={btnGroupStyle}>
          <button type="button" onClick={toggleBulletList} style={activeBtnStyle(editor.isActive('bulletList'))} title="Bulleted list"><RiListUnordered size={15} /></button>
          <button type="button" onClick={toggleOrderedList} style={activeBtnStyle(editor.isActive('orderedList'))} title="Numbered list"><RiListOrdered size={15} /></button>
        </div>

        <div style={dividerStyle} />

        {/* Group 9: Insert Tools */}
        <div style={btnGroupStyle}>
          {/* Insert Table Grid Dropdown */}
          <div ref={gridContainerRef} style={{ position: 'relative' }}>
            <button 
              type="button" 
              onClick={() => setShowTableGrid(!showTableGrid)} 
              style={btnStyle}
              title="Insert Table"
            >
              <RiTable2 size={15} />
            </button>

            {showTableGrid && (
              <div style={tableGridContainerStyle}>
                <p style={{ margin: '0 0 6px 0', fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-600)' }}>
                  Insert Table {hoveredGrid.r > 0 ? `(${hoveredGrid.r}x${hoveredGrid.c})` : ''}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {renderGridSquares()}
                </div>
              </div>
            )}
          </div>

          {/* Insert Shapes Dropdown */}
          <div ref={shapesRef} style={{ position: 'relative' }}>
            <button 
              type="button" 
              onClick={() => setShowShapesDropdown(!showShapesDropdown)} 
              style={btnStyle}
              title="Insert Shape / Box / Badge"
            >
              <RiShapesLine size={15} />
            </button>

            {showShapesDropdown && (
              <div style={{ ...dropdownStyle, width: '180px' }}>
                <p style={dropdownHeadingStyle}>Lines</p>
                <button type="button" onClick={() => insertShapeNode('line-solid')} style={dropdownItemStyle}>⎯⎯ Solid Line</button>
                <button type="button" onClick={() => insertShapeNode('line-double')} style={dropdownItemStyle}>══ Double Line</button>
                <button type="button" onClick={() => insertShapeNode('line-dotted')} style={dropdownItemStyle}>┈ ┈ Dotted Line</button>
                
                <p style={dropdownHeadingStyle}>Callout Boxes</p>
                <button type="button" onClick={() => insertShapeNode('box-info')} style={dropdownItemStyle}>🔵 Info Callout</button>
                <button type="button" onClick={() => insertShapeNode('box-warning')} style={dropdownItemStyle}>🟡 Note/Warning Callout</button>
                <button type="button" onClick={() => insertShapeNode('box-bordered')} style={dropdownItemStyle}>⬜ Bordered Canvas Box</button>
                
                <p style={dropdownHeadingStyle}>Badges</p>
                <button type="button" onClick={() => insertShapeNode('badge-info')} style={dropdownItemStyle}>🔵 Blue Badge</button>
                <button type="button" onClick={() => insertShapeNode('badge-success')} style={dropdownItemStyle}>🟢 Green Badge</button>
              </div>
            )}
          </div>

          {/* Insert Image */}
          <button 
            type="button" 
            onClick={triggerImageUpload} 
            style={btnStyle} 
            title="Insert Logo Image"
          >
            <RiImageAddLine size={15} />
          </button>

          {/* Horizontal Line */}
          <button 
            type="button" 
            onClick={() => editor.chain().focus().setHorizontalRule().run()} 
            style={btnStyle}
            title="Horizontal Line Break"
          >
            <RiSeparator size={15} />
          </button>
        </div>
      </div>

      {/* ─── CONTEXT-AWARE FLOATING PROPERTIES PANEL ───────────────────────────── */}
      {/* 1. Contextual Table Operations Bar */}
      {editor.isActive('table') && (
        <div style={contextualTableBarStyle}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0563c1', textTransform: 'uppercase', marginRight: '0.5rem', borderRight: '1px solid var(--gray-300)', paddingRight: '0.5rem' }}>
            Table Tools
          </span>
          <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()} style={panelBtnStyle}>Insert Row Above</button>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} style={panelBtnStyle}>Insert Row Below</button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} style={{ ...panelBtnStyle, color: '#dc2626' }}>Delete Row</button>
          <div style={{ width: 1, height: 16, backgroundColor: 'var(--gray-300)' }} />
          <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} style={panelBtnStyle}>Insert Column Left</button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} style={panelBtnStyle}>Insert Column Right</button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} style={{ ...panelBtnStyle, color: '#dc2626' }}>Delete Column</button>
          <div style={{ width: 1, height: 16, backgroundColor: 'var(--gray-300)' }} />
          <button type="button" onClick={() => editor.chain().focus().mergeCells().run()} style={panelBtnStyle}>Merge Cells</button>
          <button type="button" onClick={() => editor.chain().focus().splitCell().run()} style={panelBtnStyle}>Split Cell</button>
          <div style={{ width: 1, height: 16, backgroundColor: 'var(--gray-300)' }} />
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} style={{ ...panelBtnStyle, background: '#fef2f2', color: '#dc2626', fontWeight: 'bold' }}>Delete Table</button>
        </div>
      )}

      {/* 2. Shape Properties Inspector */}
      {activeShapeEl && (
        <div style={shapePropertiesBarStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', borderRight: '1px solid var(--gray-300)', paddingRight: '0.5rem' }}>
              Shape Properties
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--gray-500)', textTransform: 'capitalize' }}>
              {shapeProperties.type.replace('-', ' ')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Height (Thickness) - only for lines */}
            {shapeProperties.type.includes('line') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={inspectorLabelStyle}>Thickness:</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={parseInt(shapeProperties.height) || 0}
                  onChange={(e) => updateShapeStyle('height', e.target.value + 'px')}
                  style={inspectorInputStyle}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>px</span>
              </div>
            )}

            {/* Background Color - only for callout boxes / badge */}
            {(shapeProperties.type.includes('box') || shapeProperties.type.includes('badge')) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={inspectorLabelStyle}>Background:</span>
                <input
                  type="color"
                  value={shapeProperties.backgroundColor}
                  onChange={(e) => updateShapeStyle('backgroundColor', e.target.value)}
                  style={inspectorColorInputStyle}
                />
              </div>
            )}

            {/* Shape Border Color */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={inspectorLabelStyle}>{shapeProperties.type.includes('line') ? 'Line Color:' : 'Border Color:'}</span>
              <input
                type="color"
                value={shapeProperties.borderColor === 'transparent' ? '#cbd5e1' : shapeProperties.borderColor}
                onChange={(e) => updateShapeStyle('borderColor', e.target.value)}
                style={inspectorColorInputStyle}
              />
            </div>

            {/* Thickness / Border width for boxes / badges */}
            {(shapeProperties.type.includes('box') || shapeProperties.type.includes('badge')) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={inspectorLabelStyle}>Border:</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={parseInt(shapeProperties.borderWidth) || 0}
                  onChange={(e) => {
                    updateShapeStyle('borderWidth', e.target.value + 'px');
                    updateShapeStyle('borderStyle', e.target.value === '0' ? 'none' : 'solid');
                  }}
                  style={inspectorInputStyle}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>px</span>
              </div>
            )}

            {/* Shape Width (Percentage) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={inspectorLabelStyle}>Width:</span>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={parseInt(shapeProperties.width) || 100}
                onChange={(e) => updateShapeStyle('width', e.target.value + '%')}
                style={{ width: '60px', height: '4px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--gray-700)', minWidth: '30px' }}>
                {shapeProperties.width}
              </span>
            </div>

            {/* Shape Alignment (Position) - for block shapes */}
            {!shapeProperties.type.includes('badge') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={inspectorLabelStyle}>Position:</span>
                <button 
                  type="button" 
                  onClick={() => {
                    updateShapeStyle('marginLeft', '0px');
                    updateShapeStyle('marginRight', 'auto');
                  }} 
                  style={{
                    ...panelBtnStyle, 
                    fontWeight: 'bold', 
                    background: (shapeProperties.marginLeft === '0px' && shapeProperties.marginRight === 'auto') ? '#e0f2fe' : 'transparent',
                    color: (shapeProperties.marginLeft === '0px' && shapeProperties.marginRight === 'auto') ? '#0284c7' : 'var(--gray-600)'
                  }}
                >
                  Left
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    updateShapeStyle('marginLeft', 'auto');
                    updateShapeStyle('marginRight', 'auto');
                  }} 
                  style={{
                    ...panelBtnStyle, 
                    fontWeight: 'bold', 
                    background: (shapeProperties.marginLeft === 'auto' && shapeProperties.marginRight === 'auto') ? '#e0f2fe' : 'transparent',
                    color: (shapeProperties.marginLeft === 'auto' && shapeProperties.marginRight === 'auto') ? '#0284c7' : 'var(--gray-600)'
                  }}
                >
                  Center
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    updateShapeStyle('marginLeft', 'auto');
                    updateShapeStyle('marginRight', '0px');
                  }} 
                  style={{
                    ...panelBtnStyle, 
                    fontWeight: 'bold', 
                    background: (shapeProperties.marginLeft === 'auto' && shapeProperties.marginRight === '0px') ? '#e0f2fe' : 'transparent',
                    color: (shapeProperties.marginLeft === 'auto' && shapeProperties.marginRight === '0px') ? '#0284c7' : 'var(--gray-600)'
                  }}
                >
                  Right
                </button>
              </div>
            )}

            {/* Shape padding (for boxes) */}
            {shapeProperties.type.includes('box') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={inspectorLabelStyle}>Padding:</span>
                <input
                  type="number"
                  min={2}
                  max={40}
                  value={parseInt(shapeProperties.padding) || 0}
                  onChange={(e) => updateShapeStyle('padding', e.target.value + 'px')}
                  style={inspectorInputStyle}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>px</span>
              </div>
            )}

            {/* Shape Border Radius (for boxes) */}
            {shapeProperties.type.includes('box') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={inspectorLabelStyle}>Roundness:</span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={parseInt(shapeProperties.borderRadius) || 0}
                  onChange={(e) => updateShapeStyle('borderRadius', e.target.value + 'px')}
                  style={inspectorInputStyle}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>px</span>
              </div>
            )}

            <div style={{ width: 1, height: 16, backgroundColor: 'var(--gray-300)' }} />

            <button 
              type="button" 
              onClick={() => {
                if (activeShapeEl) {
                  activeShapeEl.remove();
                  onChange(editor.getHTML());
                  setActiveShapeEl(null);
                }
              }} 
              style={{ ...panelBtnStyle, background: '#fef2f2', color: '#dc2626', fontWeight: 'bold' }}
              title="Delete Shape"
            >
              Delete Shape
            </button>
          </div>
        </div>
      )}

      {/* ─── GOOGLE DOCS PAPER CANVAS ─────────────────────────────────────────── */}
      <div style={editorOuterContainerStyle}>
        <div style={editorPaperStyle}>
          <EditorContent editor={editor} style={{ minHeight }} />
        </div>
      </div>

      {/* Inject self-contained stylesheet for ProseMirror editor content */}
      <style>{`
        .ProseMirror {
          outline: none;
          min-height: 320px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #000000;
        }
        .ProseMirror p {
          margin: 0 0 0.5rem 0;
        }
        .ProseMirror ul {
          list-style-type: disc !important;
          margin: 0 0 0.75rem 1.5rem !important;
          padding-left: 0 !important;
        }
        .ProseMirror ol {
          list-style-type: decimal !important;
          margin: 0 0 0.75rem 1.5rem !important;
          padding-left: 0 !important;
        }
        .ProseMirror li {
          margin-bottom: 0.25rem;
        }
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1.5rem 0;
          overflow: hidden;
        }
        .ProseMirror td, .ProseMirror th {
          min-width: 1em;
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          vertical-align: top;
          position: relative;
          box-sizing: border-box;
        }
        .ProseMirror th {
          font-weight: bold;
          background-color: #f8fafc;
          text-align: left;
        }
        .ProseMirror .selectedCell:after {
          background: rgba(14, 165, 233, 0.15);
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }
        .ProseMirror .column-resize-handle {
          background-color: #0563c1;
          bottom: 0;
          position: absolute;
          right: -2px;
          top: 0;
          width: 4px;
          cursor: col-resize;
          z-index: 10;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          display: inline-block;
          margin: 8px 0;
          transition: outline 0.15s;
        }
        .ProseMirror img.ProseMirror-selectednode {
          outline: 3px solid #0563c1;
          outline-offset: 2px;
        }
        .ProseMirror h1 {
          font-size: 2rem;
          font-weight: 800;
          margin: 1.5rem 0 0.5rem 0;
        }
        .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 1.25rem 0 0.4rem 0;
        }
        .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 1.1rem 0 0.3rem 0;
        }
        /* Custom shapes selection outline */
        .ProseMirror [data-shape="true"] {
          transition: outline 0.15s;
          cursor: pointer;
        }
        .ProseMirror [data-shape="true"]:hover {
          outline: 1px dashed rgba(5, 99, 193, 0.5);
        }
        .ProseMirror [data-shape="true"]:focus,
        .ProseMirror [data-shape="true"].ProseMirror-selectednode {
          outline: 2px solid #10b981 !important;
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const editorContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid var(--gray-300)',
  background: '#f3f4f6',
  borderRadius: 0,
  overflow: 'hidden',
  height: '100%',
  width: '100%'
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.4rem',
  alignItems: 'center',
  padding: '0.5rem',
  background: '#ffffff',
  borderBottom: '1px solid var(--gray-200)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  zIndex: 10
};

const btnGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'transparent',
  borderRadius: '4px',
  overflow: 'hidden'
};

const btnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  border: 'none',
  background: 'transparent',
  color: 'var(--gray-700)',
  cursor: 'pointer',
  borderRadius: '4px',
  transition: 'background 0.1s',
  outline: 'none',
};

const activeBtnStyle = (active: boolean): React.CSSProperties => ({
  ...btnStyle,
  background: active ? '#e0f2fe' : 'transparent',
  color: active ? '#0284c7' : 'var(--gray-700)',
  fontWeight: active ? 'bold' : 'normal'
});

const dividerStyle: React.CSSProperties = {
  width: '1px',
  height: '20px',
  backgroundColor: 'var(--gray-300)',
  margin: '0 0.15rem'
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  backgroundColor: 'white',
  border: '1px solid var(--gray-300)',
  borderRadius: '4px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  zIndex: 100,
  minWidth: '150px',
  display: 'flex',
  flexDirection: 'column',
  padding: '4px 0',
  marginTop: '4px'
};

const dropdownItemStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: 'none',
  background: 'none',
  textAlign: 'left',
  width: '100%',
  cursor: 'pointer',
  fontSize: '0.78rem',
  color: 'var(--gray-700)',
  transition: 'background 0.1s',
  outline: 'none',
};

const dropdownHeadingStyle: React.CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 800,
  color: 'var(--gray-400)',
  textTransform: 'uppercase',
  padding: '6px 12px 2px 12px',
  margin: 0,
  letterSpacing: '0.05em'
};

const colorPaletteGridStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  backgroundColor: 'white',
  border: '1px solid var(--gray-300)',
  borderRadius: '6px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  zIndex: 100,
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '4px',
  padding: '8px',
  marginTop: '4px',
  width: '170px'
};

const colorSquareStyle = (color: string): React.CSSProperties => ({
  width: '18px',
  height: '18px',
  backgroundColor: color,
  border: '1px solid #cbd5e1',
  cursor: 'pointer',
  borderRadius: '2px',
  padding: 0
});

const fontSizeContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  border: '1px solid var(--gray-300)',
  borderRadius: '4px',
  overflow: 'hidden',
  height: '26px',
  background: 'white'
};

const fontSizeBtnStyle: React.CSSProperties = {
  width: '20px',
  height: '100%',
  border: 'none',
  background: '#f3f4f6',
  color: 'var(--gray-600)',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.9rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  outline: 'none',
  transition: 'background 0.1s'
};

const fontSizeInputStyle: React.CSSProperties = {
  width: '42px',
  height: '100%',
  border: 'none',
  textAlign: 'center',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  color: 'var(--gray-800)',
  outline: 'none'
};

const tableGridContainerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  backgroundColor: 'white',
  border: '1px solid var(--gray-300)',
  borderRadius: '6px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  zIndex: 100,
  padding: '10px',
  marginTop: '4px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px'
};

// Properties Panels
const contextualTableBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.4rem 0.75rem',
  background: '#eff6ff',
  borderBottom: '1px solid #bfdbfe',
  zIndex: 5,
  flexWrap: 'wrap'
};

const shapePropertiesBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '0.45rem 0.75rem',
  background: '#ecfdf5',
  borderBottom: '1px solid #a7f3d0',
  zIndex: 5,
  flexWrap: 'wrap'
};

const panelBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: '0.68rem',
  border: '1px solid var(--gray-300)',
  borderRadius: '4px',
  background: 'white',
  color: 'var(--gray-700)',
  cursor: 'pointer',
  outline: 'none',
  transition: 'all 0.1s'
};

const inspectorLabelStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 600,
  color: 'var(--gray-600)'
};

const inspectorInputStyle: React.CSSProperties = {
  width: '38px',
  padding: '2px 4px',
  fontSize: '0.68rem',
  border: '1px solid var(--gray-300)',
  borderRadius: '4px',
  textAlign: 'center',
  outline: 'none'
};

const inspectorColorInputStyle: React.CSSProperties = {
  width: '24px',
  height: '20px',
  padding: '0',
  border: '1px solid var(--gray-300)',
  borderRadius: '4px',
  cursor: 'pointer',
  background: 'none'
};

// Paper Layout Styles
const editorOuterContainerStyle: React.CSSProperties = {
  backgroundColor: '#f3f4f6',
  padding: '1.5rem',
  overflowY: 'auto',
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  boxSizing: 'border-box'
};

const editorPaperStyle: React.CSSProperties = {
  backgroundColor: 'white',
  width: '100%',
  maxWidth: '820px',
  minHeight: '100%',
  padding: '2.5rem',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
  border: '1px solid #e5e7eb',
  boxSizing: 'border-box'
};
