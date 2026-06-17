'use client';
import { useEffect, useRef, useState } from 'react';
import { 
  RiBold, RiItalic, RiUnderline, RiListUnordered, RiListOrdered,
  RiAlignLeft, RiAlignCenter, RiAlignRight, RiAlignJustify,
  RiTable2, RiFormatClear, RiArrowDownSLine,
  RiArrowGoBackLine, RiArrowGoForwardLine,
  RiFontColor, RiFontFamily, RiFontSize, RiImageAddLine,
  RiShapesLine
} from '@remixicon/react';

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const FONTS = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' }
];

const SIZES = ['10px', '11px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '48px'];

const COLOR_PALETTE = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9ee1', '#6fa8dc', '#8e7cc3', '#c27ba0',
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
  '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
  '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'
];

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = 'Type here...', 
  minHeight = '220px' 
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  
  // Dropdown states
  const [showTableGrid, setShowTableGrid] = useState(false);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showShapesDropdown, setShowShapesDropdown] = useState(false);
  
  const [hoveredGrid, setHoveredGrid] = useState({ r: 0, c: 0 });
  const [activeCell, setActiveCell] = useState<HTMLTableCellElement | null>(null);
  
  // Image & Shape selection states
  const [activeImage, setActiveImage] = useState<HTMLImageElement | null>(null);
  const [activeShape, setActiveShape] = useState<HTMLElement | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [isDraggingHandle, setIsDraggingHandle] = useState<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Shape color tools states
  const [showShapeBgDropdown, setShowShapeBgDropdown] = useState(false);
  const [showShapeBorderDropdown, setShowShapeBorderDropdown] = useState(false);
  const [showShapeTextDropdown, setShowShapeTextDropdown] = useState(false);

  const shapeBgRef = useRef<HTMLDivElement>(null);
  const shapeBorderRef = useRef<HTMLDivElement>(null);
  const shapeTextRef = useRef<HTMLDivElement>(null);

  // Custom text color values
  const [customColorVal, setCustomColorVal] = useState('');

  // Active styles at cursor state
  const [editorState, setEditorState] = useState({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isBulletList: false,
    isOrderedList: false,
    fontFamily: 'Times New Roman',
    fontSize: '11pt',
    alignment: 'left'
  });

  // Refs for click outside
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const fontRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const shapesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enable modern CSS style editing instead of legacy HTML tags
  useEffect(() => {
    if (typeof document !== 'undefined') {
      try {
        document.execCommand('styleWithCSS', false, 'true');
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Sync value to DOM
  useEffect(() => {
    if (editorRef.current) {
      if (isFirstRender.current) {
        editorRef.current.innerHTML = value || '';
        isFirstRender.current = false;
      } else if (editorRef.current.innerHTML !== value) {
        const selection = window.getSelection();
        let range: Range | null = null;
        if (selection && selection.rangeCount > 0) {
          range = selection.getRangeAt(0).cloneRange();
        }
        
        editorRef.current.innerHTML = value || '';
        
        if (range && document.activeElement === editorRef.current) {
          try {
            selection?.removeAllRanges();
            selection?.addRange(range);
          } catch (e) {
            // ignore
          }
        }
      }
    }
  }, [value]);

  // Helper to query computed styles at selection
  const getComputedStyleAtSelection = (propertyName: string) => {
    if (typeof window === 'undefined') return '';
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode || node;
      }
      if (node && node.nodeType === Node.ELEMENT_NODE) {
        const style = window.getComputedStyle(node as Element);
        return style.getPropertyValue(propertyName);
      }
    }
    return '';
  };

  // Update editor formatting state for toolbar highlights
  const updateEditorState = () => {
    if (typeof window === 'undefined') return;
    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    const isUnderline = document.queryCommandState('underline');
    const isBulletList = document.queryCommandState('insertUnorderedList');
    const isOrderedList = document.queryCommandState('insertOrderedList');
    
    const computedFontFamily = getComputedStyleAtSelection('font-family');
    const computedFontSize = getComputedStyleAtSelection('font-size');
    const computedAlignment = getComputedStyleAtSelection('text-align');

    // Normalize font family label
    let fontFamilyLabel = 'Times New Roman';
    if (computedFontFamily) {
      const matched = FONTS.find(f => computedFontFamily.toLowerCase().includes(f.label.toLowerCase()));
      if (matched) fontFamilyLabel = matched.label;
    }

    // Normalize font size label
    let fontSizeLabel = '11pt';
    if (computedFontSize) {
      const parsed = parseFloat(computedFontSize);
      if (!isNaN(parsed)) {
        fontSizeLabel = Math.round(parsed) + 'px';
      } else {
        fontSizeLabel = computedFontSize;
      }
    }

    setEditorState({
      isBold,
      isItalic,
      isUnderline,
      isBulletList,
      isOrderedList,
      fontFamily: fontFamilyLabel,
      fontSize: fontSizeLabel,
      alignment: computedAlignment || 'left'
    });
  };

  // Selection change and click listeners
  useEffect(() => {
    const handleSelectionUpdate = () => {
      updateEditorState();
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const parent = range.commonAncestorContainer;
        const element = parent.nodeType === Node.ELEMENT_NODE ? (parent as HTMLElement) : parent.parentElement;
        const td = element?.closest('td');
        setActiveCell(td || null);
      } else {
        setActiveCell(null);
      }
      setTimeout(updateSelectionRect, 10);
    };

    document.addEventListener('selectionchange', handleSelectionUpdate);
    
    const editor = editorRef.current;
    if (editor) {
      const handleEditorClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const shapeEl = target.closest('[data-shape]') as HTMLElement | null;

        if (shapeEl) {
          if (activeShape && activeShape !== shapeEl) {
            activeShape.removeAttribute('data-selected');
          }
          if (activeImage) {
            activeImage.removeAttribute('data-selected');
            setActiveImage(null);
          }
          setActiveShape(shapeEl);
          shapeEl.setAttribute('data-selected', 'true');
        } else if (target.tagName === 'IMG') {
          if (activeShape) {
            activeShape.removeAttribute('data-selected');
            setActiveShape(null);
          }
          if (activeImage && activeImage !== target) {
            activeImage.removeAttribute('data-selected');
          }
          setActiveImage(target as HTMLImageElement);
          target.setAttribute('data-selected', 'true');
        } else {
          if (activeShape) {
            activeShape.removeAttribute('data-selected');
            setActiveShape(null);
          }
          if (activeImage) {
            activeImage.removeAttribute('data-selected');
            setActiveImage(null);
          }
        }
        updateEditorState();
      };
      
      editor.addEventListener('click', handleEditorClick);
      return () => {
        document.removeEventListener('selectionchange', handleSelectionUpdate);
        editor.removeEventListener('click', handleEditorClick);
      };
    }

    return () => {
      document.removeEventListener('selectionchange', handleSelectionUpdate);
    };
  }, [activeImage, activeShape]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (gridContainerRef.current && !gridContainerRef.current.contains(target)) {
        setShowTableGrid(false);
      }
      if (fontRef.current && !fontRef.current.contains(target)) {
        setShowFontDropdown(false);
      }
      if (sizeRef.current && !sizeRef.current.contains(target)) {
        setShowSizeDropdown(false);
      }
      if (colorRef.current && !colorRef.current.contains(target)) {
        setShowColorDropdown(false);
      }
      if (shapesRef.current && !shapesRef.current.contains(target)) {
        setShowShapesDropdown(false);
      }
      if (shapeBgRef.current && !shapeBgRef.current.contains(target)) {
        setShowShapeBgDropdown(false);
      }
      if (shapeBorderRef.current && !shapeBorderRef.current.contains(target)) {
        setShowShapeBorderDropdown(false);
      }
      if (shapeTextRef.current && !shapeTextRef.current.contains(target)) {
        setShowShapeTextDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update image bounds for resize handles overlay
  const updateSelectionRect = () => {
    const activeEl = activeImage || activeShape;
    if (!activeEl || !editorRef.current) {
      setSelectionRect(null);
      return;
    }
    const editorEl = editorRef.current;
    const editorRect = editorEl.getBoundingClientRect();
    const targetRect = activeEl.getBoundingClientRect();
    
    setSelectionRect({
      top: targetRect.top - editorRect.top + editorEl.scrollTop,
      left: targetRect.left - editorRect.left + editorEl.scrollLeft,
      width: targetRect.width,
      height: targetRect.height
    });
  };

  useEffect(() => {
    updateSelectionRect();
  }, [activeImage, activeShape]);

  // Handle scrolling and resizing to keep resize handles locked onto the selected element
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    const handleScroll = () => {
      updateSelectionRect();
    };
    
    editor.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    return () => {
      editor.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [activeImage, activeShape]);

  // Resizing drag gestures (images and shapes)
  const startHandleDrag = (e: React.MouseEvent, handle: string) => {
    const activeEl = activeImage || activeShape;
    if (!activeEl) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingHandle(handle);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: activeEl.offsetWidth,
      h: activeEl.offsetHeight
    };
  };

  useEffect(() => {
    const activeEl = activeImage || activeShape;
    if (!isDraggingHandle || !activeEl) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diffX = e.clientX - dragStartRef.current.x;
      const diffY = e.clientY - dragStartRef.current.y;
      
      let newWidth = dragStartRef.current.w;
      if (isDraggingHandle === 'br' || isDraggingHandle === 'tr' || isDraggingHandle === 'r') {
        newWidth = dragStartRef.current.w + diffX;
      } else if (isDraggingHandle === 'bl' || isDraggingHandle === 'tl' || isDraggingHandle === 'l') {
        newWidth = dragStartRef.current.w - diffX;
      } else if (isDraggingHandle === 'b') {
        const scale = (dragStartRef.current.h + diffY) / (dragStartRef.current.h || 1);
        newWidth = dragStartRef.current.w * scale;
      } else if (isDraggingHandle === 't') {
        const scale = (dragStartRef.current.h - diffY) / (dragStartRef.current.h || 1);
        newWidth = dragStartRef.current.w * scale;
      }
      
      // Limit bounds to editor width
      newWidth = Math.max(10, Math.min(newWidth, editorRef.current?.offsetWidth || 1000));
      
      if (activeImage) {
        activeImage.style.width = `${newWidth}px`;
        activeImage.style.height = 'auto';
      } else if (activeShape) {
        activeShape.style.width = `${newWidth}px`;
        // If dragging top/bottom handles, resize height for shapes too
        if (isDraggingHandle === 'b' || isDraggingHandle === 't' || isDraggingHandle === 'bl' || isDraggingHandle === 'br' || isDraggingHandle === 'tl' || isDraggingHandle === 'tr') {
          let newHeight = dragStartRef.current.h;
          if (isDraggingHandle === 'b' || isDraggingHandle === 'bl' || isDraggingHandle === 'br') {
            newHeight = dragStartRef.current.h + diffY;
          } else {
            newHeight = dragStartRef.current.h - diffY;
          }
          newHeight = Math.max(4, newHeight);
          activeShape.style.height = `${newHeight}px`;
        }
      }
      
      updateSelectionRect();
    };

    const handleMouseUp = () => {
      setIsDraggingHandle(null);
      handleInput();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHandle, activeImage, activeShape]);

  // Table resizing logic (dragging column borders)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let isResizing = false;
    let currentTd: HTMLTableCellElement | null = null;
    let startX = 0;
    let startWidth = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && currentTd) {
        const diffX = e.clientX - startX;
        currentTd.style.width = `${Math.max(30, startWidth + diffX)}px`;
        return;
      }

      const target = e.target as HTMLElement;
      const td = target.closest('td');
      if (td) {
        const rect = td.getBoundingClientRect();
        const isNearRightEdge = rect.right - e.clientX <= 6 && rect.right - e.clientX >= 0;
        if (isNearRightEdge) {
          td.style.cursor = 'col-resize';
        } else {
          td.style.cursor = '';
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const td = target.closest('td');
      if (td && td.style.cursor === 'col-resize') {
        isResizing = true;
        currentTd = td;
        startX = e.clientX;
        startWidth = td.offsetWidth;
        e.preventDefault();
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        currentTd = null;
        handleInput();
      }
    };

    editor.addEventListener('mousemove', handleMouseMove);
    editor.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      editor.removeEventListener('mousemove', handleMouseMove);
      editor.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const exec = (command: string, arg: string = '') => {
    if (typeof document !== 'undefined') {
      try {
        document.execCommand('styleWithCSS', false, 'true');
      } catch (e) {}
    }
    document.execCommand(command, false, arg);
    handleInput();
    updateEditorState();
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const setFontFamily = (fontValue: string) => {
    exec('fontName', fontValue);
    setShowFontDropdown(false);
  };

  const setFontSize = (sizePx: string) => {
    try {
      document.execCommand('styleWithCSS', false, 'false');
    } catch (e) {}
    
    document.execCommand('fontSize', false, '1');
    
    if (editorRef.current) {
      const fontElements = editorRef.current.querySelectorAll('font[size="1"]');
      fontElements.forEach(font => {
        const span = document.createElement('span');
        span.style.fontSize = sizePx;
        span.innerHTML = font.innerHTML;
        font.replaceWith(span);
      });
      handleInput();
    }
    
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch (e) {}
    
    setShowSizeDropdown(false);
  };

  const setTextColor = (colorValue: string) => {
    exec('foreColor', colorValue);
    setShowColorDropdown(false);
  };

  const insertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const html = `<img src="${dataUrl}" style="max-width: 100%; height: auto; max-height: 150px; display: inline-block; margin: 8px 0;" alt="Uploaded Logo" />`;
      
      editorRef.current?.focus();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (editorRef.current?.contains(range.commonAncestorContainer)) {
          document.execCommand('insertHTML', false, html);
          return;
        }
      }
      
      if (editorRef.current) {
        editorRef.current.innerHTML += html;
        handleInput();
      }
    };
    reader.readAsDataURL(file);
  };

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
            onClick={() => insertTable(r, c)}
            style={{
              width: '16px',
              height: '16px',
              border: '1px solid #cbd5e1',
              backgroundColor: isHighlighted ? '#ddd6fe' : '#ffffff',
              borderColor: isHighlighted ? '#7c3aed' : '#cbd5e1',
              cursor: 'pointer',
              transition: 'background-color 0.05s, border-color 0.05s',
            }}
          />
        );
      }
      gridRows.push(
        <div key={r} style={{ display: 'flex', gap: '3px' }}>
          {rowCells}
        </div>
      );
    }
    return gridRows;
  };

  const insertTable = (rows: number, cols: number) => {
    let html = '<table style="width:100%; border-collapse:collapse; margin:16px 0; border:1px solid #cbd5e1; table-layout:fixed;"><tbody>';
    for (let i = 0; i < rows; i++) {
      html += '<tr>';
      for (let j = 0; j < cols; j++) {
        html += '<td style="border:1px solid #cbd5e1; padding:8px; min-width:50px; height:24px; vertical-align:top; font-size:11pt;">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><p>&nbsp;</p>';
    
    editorRef.current?.focus();
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        document.execCommand('insertHTML', false, html);
        setShowTableGrid(false);
        return;
      }
    }
    
    if (editorRef.current) {
      editorRef.current.innerHTML += html;
      handleInput();
    }
    setShowTableGrid(false);
  };

  const insertShape = (shapeType: string) => {
    let html = '';
    switch (shapeType) {
      case 'line-solid':
        html = '<div data-shape="line" data-shape-type="solid" style="height: 4px; background-color: #3b82f6; margin: 8px 0; width: 100%; display: block; border-radius: 0; box-sizing: border-box;"></div><p>&nbsp;</p>';
        break;
      case 'line-double':
        html = '<div data-shape="line" data-shape-type="double" style="height: 6px; border-top: 2px solid #9ca3af; border-bottom: 2px solid #9ca3af; background: transparent; margin: 8px 0; width: 100%; display: block; border-radius: 0; box-sizing: border-box;"></div><p>&nbsp;</p>';
        break;
      case 'line-dotted':
        html = '<div data-shape="line" data-shape-type="dotted" style="height: 0px; border-top: 3px dotted #9ca3af; margin: 8px 0; width: 100%; display: block; border-radius: 0; box-sizing: border-box;"></div><p>&nbsp;</p>';
        break;
      case 'box-info':
        html = '<div data-shape="box" data-shape-type="info" style="border-left: 6px solid #3b82f6; background-color: #eff6ff; padding: 12px; margin: 8px 0; color: #1e3a8a; border-radius: 0; min-height: 40px; box-sizing: border-box; width: 100%;"><strong>INFO:</strong> Enter details...</div><p>&nbsp;</p>';
        break;
      case 'box-warning':
        html = '<div data-shape="box" data-shape-type="warning" style="border-left: 6px solid #f59e0b; background-color: #fffbeb; padding: 12px; margin: 8px 0; color: #78350f; border-radius: 0; min-height: 40px; box-sizing: border-box; width: 100%;"><strong>NOTE:</strong> Enter details...</div><p>&nbsp;</p>';
        break;
      case 'box-bordered':
        html = '<div data-shape="box" data-shape-type="bordered" style="border: 2px solid #cbd5e1; padding: 12px; margin: 8px 0; background-color: #f8fafc; border-radius: 0; min-height: 40px; box-sizing: border-box; width: 100%;">Box content...</div><p>&nbsp;</p>';
        break;
      case 'badge-info':
        html = '<span data-shape="badge" data-shape-type="info" style="border: 1px solid #3b82f6; padding: 4px 8px; border-radius: 0; display: inline-block; font-size: 0.75rem; font-weight: bold; color: #3b82f6; background-color: #eff6ff; margin: 0 4px; box-sizing: border-box;">Info</span>';
        break;
      case 'badge-success':
        html = '<span data-shape="badge" data-shape-type="success" style="border: 1px solid #10b981; padding: 4px 8px; border-radius: 0; display: inline-block; font-size: 0.75rem; font-weight: bold; color: #10b981; background-color: #ecfdf5; margin: 0 4px; box-sizing: border-box;">Success</span>';
        break;
      case 'arrow-right':
        html = ' ➔ ';
        break;
      case 'arrow-left':
        html = ' ◀ ';
        break;
      case 'arrow-up':
        html = ' ▲ ';
        break;
      case 'arrow-down':
        html = ' ▼ ';
        break;
      case 'arrow-double':
        html = ' ↔ ';
        break;
      default:
        break;
    }

    editorRef.current?.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        document.execCommand('insertHTML', false, html);
        setShowShapesDropdown(false);
        return;
      }
    }
    
    if (editorRef.current) {
      editorRef.current.innerHTML += html;
      handleInput();
    }
    setShowShapesDropdown(false);
  };

  const addRow = (direction: 'above' | 'below') => {
    if (!activeCell) return;
    const tr = activeCell.closest('tr') as HTMLTableRowElement;
    const container = tr.closest('tbody') || tr.closest('table');
    if (!container) return;
    const newRow = tr.cloneNode(true) as HTMLTableRowElement;
    
    Array.from(newRow.cells).forEach(cell => {
      cell.innerHTML = '&nbsp;';
    });
    
    if (direction === 'above') {
      container.insertBefore(newRow, tr);
    } else {
      container.insertBefore(newRow, tr.nextSibling);
    }
    handleInput();
  };

  const deleteRow = () => {
    if (!activeCell) return;
    const tr = activeCell.closest('tr') as HTMLTableRowElement;
    const table = tr.closest('table') as HTMLTableElement;
    if (table.rows.length <= 1) {
      table.remove();
      setActiveCell(null);
    } else {
      tr.remove();
      setActiveCell(null);
    }
    handleInput();
  };

  const addColumn = (direction: 'left' | 'right') => {
    if (!activeCell) return;
    const tr = activeCell.closest('tr') as HTMLTableRowElement;
    const colIndex = activeCell.cellIndex;
    const table = tr.closest('table') as HTMLTableElement;
    
    Array.from(table.rows).forEach(row => {
      const newCell = document.createElement('td');
      newCell.style.border = '1px solid #cbd5e1';
      newCell.style.padding = '8px';
      newCell.style.minWidth = '50px';
      newCell.style.height = '24px';
      newCell.style.verticalAlign = 'top';
      newCell.style.fontSize = '11pt';
      newCell.innerHTML = '&nbsp;';
      
      const referenceCell = row.cells[colIndex];
      if (direction === 'left') {
        row.insertBefore(newCell, referenceCell);
      } else {
        row.insertBefore(newCell, referenceCell.nextSibling);
      }
    });
    handleInput();
  };

  const deleteColumn = () => {
    if (!activeCell) return;
    const tr = activeCell.closest('tr') as HTMLTableRowElement;
    const colIndex = activeCell.cellIndex;
    const table = tr.closest('table') as HTMLTableElement;
    
    if (tr.cells.length <= 1) {
      table.remove();
      setActiveCell(null);
    } else {
      Array.from(table.rows).forEach(row => {
        row.cells[colIndex]?.remove();
      });
      setActiveCell(null);
    }
    handleInput();
  };

  const deleteTable = () => {
    if (!activeCell) return;
    const table = activeCell.closest('table') as HTMLTableElement;
    table.remove();
    setActiveCell(null);
    handleInput();
  };

  // Image manipulation options
  const adjustImageWidth = (amount: number) => {
    if (!activeImage) return;
    const currentWidth = activeImage.offsetWidth;
    const parentWidth = activeImage.parentElement?.offsetWidth || 500;
    const currentPercent = Math.round((currentWidth / parentWidth) * 100);
    const newPercent = Math.min(100, Math.max(10, currentPercent + amount));
    activeImage.style.width = `${newPercent}%`;
    activeImage.style.height = 'auto';
    handleInput();
    setTimeout(updateSelectionRect, 20); // allow DOM layout to update before rechecking bounds
  };

  const setImageWidthPercent = (pct: number) => {
    if (!activeImage) return;
    activeImage.style.width = `${pct}%`;
    activeImage.style.height = 'auto';
    handleInput();
    setTimeout(updateSelectionRect, 20);
  };

  const resetImageWidth = () => {
    if (!activeImage) return;
    activeImage.style.width = '';
    activeImage.style.height = '';
    handleInput();
    setTimeout(updateSelectionRect, 20);
  };

  const alignImage = (align: 'left' | 'center' | 'right' | 'inline') => {
    if (!activeImage) return;
    if (align === 'left') {
      activeImage.style.display = 'block';
      activeImage.style.margin = '8px auto 8px 0';
    } else if (align === 'center') {
      activeImage.style.display = 'block';
      activeImage.style.margin = '8px auto';
    } else if (align === 'right') {
      activeImage.style.display = 'block';
      activeImage.style.margin = '8px 0 8px auto';
    } else {
      activeImage.style.display = 'inline-block';
      activeImage.style.margin = '0 8px';
    }
    handleInput();
    setTimeout(updateSelectionRect, 20);
  };

  const deleteImage = () => {
    if (!activeImage) return;
    activeImage.remove();
    setActiveImage(null);
    handleInput();
  };

  // Shape manipulation options
  const setShapeBgColor = (color: string) => {
    if (activeShape) {
      activeShape.style.backgroundColor = color;
      handleInput();
      updateSelectionRect();
    }
  };

  const setShapeBorderColor = (color: string) => {
    if (activeShape) {
      const shapeType = activeShape.getAttribute('data-shape');
      if (shapeType === 'line') {
        const lineType = activeShape.getAttribute('data-shape-type');
        if (lineType === 'solid') {
          activeShape.style.backgroundColor = color;
        } else {
          activeShape.style.borderColor = color;
          activeShape.style.borderTopColor = color;
          activeShape.style.borderBottomColor = color;
        }
      } else {
        activeShape.style.borderColor = color;
        if (activeShape.style.borderLeft) {
          activeShape.style.borderLeftColor = color;
        }
      }
      handleInput();
      updateSelectionRect();
    }
  };

  const setShapeTextColor = (color: string) => {
    if (activeShape) {
      activeShape.style.color = color;
      handleInput();
      updateSelectionRect();
    }
  };

  const adjustShapeMargin = (amount: number) => {
    if (!activeShape) return;
    const currentMargin = parseInt(activeShape.style.marginTop || '16') || 0;
    const newMargin = Math.max(0, currentMargin + amount);
    activeShape.style.marginTop = `${newMargin}px`;
    activeShape.style.marginBottom = `${newMargin}px`;
    handleInput();
    setTimeout(updateSelectionRect, 20);
  };

  const adjustShapeWidth = (amount: number) => {
    if (!activeShape) return;
    const currentWidth = activeShape.offsetWidth;
    const parentWidth = activeShape.parentElement?.offsetWidth || 500;
    const currentPercent = Math.round((currentWidth / parentWidth) * 100);
    const newPercent = Math.min(100, Math.max(10, currentPercent + amount));
    activeShape.style.width = `${newPercent}%`;
    handleInput();
    setTimeout(updateSelectionRect, 20);
  };

  const alignShape = (align: 'left' | 'center' | 'right') => {
    if (!activeShape) return;
    activeShape.style.display = 'block';
    if (align === 'left') {
      activeShape.style.marginLeft = '0';
      activeShape.style.marginRight = 'auto';
    } else if (align === 'center') {
      activeShape.style.marginLeft = 'auto';
      activeShape.style.marginRight = 'auto';
    } else {
      activeShape.style.marginLeft = 'auto';
      activeShape.style.marginRight = '0';
    }
    handleInput();
    setTimeout(updateSelectionRect, 20);
  };

  const adjustLineThickness = (amount: number) => {
    if (!activeShape) return;
    const shapeType = activeShape.getAttribute('data-shape');
    if (shapeType !== 'line') return;
    const lineType = activeShape.getAttribute('data-shape-type');
    if (lineType === 'solid') {
      const currentHeight = parseInt(activeShape.style.height || '4') || 0;
      const newHeight = Math.max(1, currentHeight + amount);
      activeShape.style.height = `${newHeight}px`;
    } else if (lineType === 'double') {
      const currentBorderWidth = parseInt(activeShape.style.borderTopWidth || '2') || 0;
      const newBorderWidth = Math.max(1, currentBorderWidth + amount);
      activeShape.style.borderTopWidth = `${newBorderWidth}px`;
      activeShape.style.borderBottomWidth = `${newBorderWidth}px`;
      activeShape.style.height = `${newBorderWidth * 3}px`;
    } else if (lineType === 'dotted') {
      const currentBorderWidth = parseInt(activeShape.style.borderTopWidth || '3') || 0;
      const newBorderWidth = Math.max(1, currentBorderWidth + amount);
      activeShape.style.borderTop = `${newBorderWidth}px dotted ${activeShape.style.borderTopColor || '#9ca3af'}`;
    }
    handleInput();
    setTimeout(updateSelectionRect, 20);
  };

  const deleteShape = () => {
    if (!activeShape) return;
    activeShape.remove();
    setActiveShape(null);
    handleInput();
  };

  const isColorMatch = (c1: string, c2: string) => {
    if (!c1 || !c2) return false;
    if (c1.toLowerCase() === c2.toLowerCase()) return true;
    
    const hexToRgb = (hex: string) => {
      const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
      return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : '';
    };

    const rgbToRgba = (rgb: string) => {
      if (rgb.startsWith('rgb(')) {
        return rgb.replace('rgb(', 'rgba(').replace(')', ', 1)');
      }
      return rgb;
    };
    
    const r1 = c1.startsWith('#') ? hexToRgb(c1) : c1;
    const r2 = c2.startsWith('#') ? hexToRgb(c2) : c2;
    
    const clean = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const cr1 = clean(r1);
    const cr2 = clean(r2);
    
    if (cr1 === cr2) return true;
    if (clean(rgbToRgba(r1)) === clean(rgbToRgba(r2))) return true;
    
    return false;
  };

  const getShapeColors = () => {
    if (!activeShape || typeof window === 'undefined') {
      return { bgColor: '', borderColor: '', textColor: '' };
    }
    const style = window.getComputedStyle(activeShape);
    
    let bgColor = activeShape.style.backgroundColor || style.backgroundColor;
    let borderColor = activeShape.style.borderColor || style.borderColor || activeShape.style.borderLeftColor || style.borderLeftColor;
    let textColor = activeShape.style.color || style.color;
    
    const shapeType = activeShape.getAttribute('data-shape');
    const shapeTypeAttr = activeShape.getAttribute('data-shape-type');
    if (shapeType === 'line') {
      if (shapeTypeAttr === 'solid') {
        borderColor = activeShape.style.backgroundColor || style.backgroundColor;
      } else {
        borderColor = activeShape.style.borderTopColor || style.borderTopColor;
      }
      bgColor = 'transparent';
    }
    
    return { bgColor, borderColor, textColor };
  };

  const { bgColor: shapeBgColor, borderColor: shapeBorderColor, textColor: shapeTextColor } = getShapeColors();

  const handleStyle = (cursor: string): React.CSSProperties => ({
    position: 'absolute',
    width: '8px',
    height: '8px',
    backgroundColor: '#7c3aed',
    border: '1px solid white',
    zIndex: 1000,
    cursor,
    boxSizing: 'border-box',
    borderRadius: 0
  });

  return (
    <div style={containerStyle}>
      <style>{`
        .rich-editor-content img, .rich-editor-content [data-shape] {
          transition: outline 0.15s ease, box-shadow 0.15s ease;
          cursor: pointer;
        }
        .rich-editor-content img[data-selected="true"], .rich-editor-content [data-shape][data-selected="true"] {
          outline: 2px dashed #7c3aed !important;
          outline-offset: 2px;
        }
      `}</style>

      {/* TOOLBAR */}
      <div style={toolbarStyle}>
        {/* Undo / Redo */}
        <button type="button" onClick={() => exec('undo')} style={btnStyle} title="Undo (Ctrl+Z)"><RiArrowGoBackLine size={16} /></button>
        <button type="button" onClick={() => exec('redo')} style={btnStyle} title="Redo (Ctrl+Y)"><RiArrowGoForwardLine size={16} /></button>
        
        <div style={dividerStyle} />

        {/* Font Family Dropdown */}
        <div ref={fontRef} style={{ position: 'relative' }}>
          <button 
            type="button" 
            onClick={() => setShowFontDropdown(!showFontDropdown)} 
            style={{ ...btnStyle, gap: '4px', fontSize: '0.75rem', fontWeight: 600, minWidth: '95px', justifyContent: 'space-between' }} 
            title="Font Family"
          >
            <span>{editorState.fontFamily}</span>
            <RiArrowDownSLine size={12} />
          </button>
          {showFontDropdown && (
            <div style={dropdownListStyle}>
              {FONTS.map(f => {
                const isActive = editorState.fontFamily.toLowerCase() === f.label.toLowerCase();
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFontFamily(f.value)}
                    style={{ 
                      ...dropdownItemStyle, 
                      fontFamily: f.value,
                      backgroundColor: isActive ? '#f3f4f6' : 'transparent',
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? '#7c3aed' : 'var(--gray-700)'
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Font Size Dropdown */}
        <div ref={sizeRef} style={{ position: 'relative' }}>
          <button 
            type="button" 
            onClick={() => setShowSizeDropdown(!showSizeDropdown)} 
            style={{ ...btnStyle, gap: '4px', fontSize: '0.75rem', fontWeight: 600, minWidth: '48px', justifyContent: 'space-between' }} 
            title="Font Size"
          >
            <span>{editorState.fontSize}</span>
            <RiArrowDownSLine size={12} />
          </button>
          {showSizeDropdown && (
            <div style={{ ...dropdownListStyle, maxHeight: '200px', overflowY: 'auto' }}>
              {SIZES.map(s => {
                const isActive = editorState.fontSize === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFontSize(s)}
                    style={{ 
                      ...dropdownItemStyle,
                      backgroundColor: isActive ? '#f3f4f6' : 'transparent',
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? '#7c3aed' : 'var(--gray-700)'
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Text Color Dropdown */}
        <div ref={colorRef} style={{ position: 'relative' }}>
          {(() => {
            const computedColor = getComputedStyleAtSelection('color') || '#000000';
            return (
              <>
                <button 
                  type="button" 
                  onClick={() => setShowColorDropdown(!showColorDropdown)} 
                  style={{ ...btnStyle, gap: '2px' }} 
                  title="Text Color"
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <RiFontColor size={16} style={{ color: computedColor }} />
                    <div style={{ width: '16px', height: '3px', backgroundColor: computedColor, marginTop: '1px' }} />
                  </div>
                  <RiArrowDownSLine size={12} />
                </button>
                {showColorDropdown && (
                  <div style={{ ...gridPopupStyle, minWidth: '220px', padding: '10px' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '6px', textTransform: 'uppercase' }}>Theme Palette</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px', marginBottom: '8px' }}>
                      {COLOR_PALETTE.map(c => {
                        const isCurrent = isColorMatch(c, computedColor);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setTextColor(c)}
                            style={{
                              width: '16px',
                              height: '16px',
                              backgroundColor: c,
                              border: isCurrent ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                              cursor: 'pointer',
                              padding: 0,
                              borderRadius: 0
                            }}
                            title={c}
                          />
                        );
                      })}
                    </div>
                    <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '8px', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '4px', textTransform: 'uppercase' }}>Custom Color</div>
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (customColorVal.trim()) {
                            setTextColor(customColorVal.trim());
                          }
                        }}
                        style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: customColorVal || computedColor || '#ffffff',
                          flexShrink: 0,
                          borderRadius: 0
                        }} />
                        <input
                          value={customColorVal}
                          onChange={e => setCustomColorVal(e.target.value)}
                          placeholder="#hex or rgba()"
                          style={{
                            flex: 1,
                            fontSize: '0.72rem',
                            padding: '3px 4px',
                            border: '1px solid var(--gray-300)',
                            outline: 'none',
                            borderRadius: 0
                          }}
                        />
                        <button
                          type="submit"
                          style={{
                            backgroundColor: '#7c3aed',
                            color: 'white',
                            border: 'none',
                            fontSize: '0.7rem',
                            padding: '3px 6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            borderRadius: 0
                          }}
                        >
                          Apply
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div style={dividerStyle} />

        {/* Font styling */}
        <button type="button" onClick={() => exec('bold')} style={editorState.isBold ? activeBtnStyle : btnStyle} title="Bold"><RiBold size={16} /></button>
        <button type="button" onClick={() => exec('italic')} style={editorState.isItalic ? activeBtnStyle : btnStyle} title="Italic"><RiItalic size={16} /></button>
        <button type="button" onClick={() => exec('underline')} style={editorState.isUnderline ? activeBtnStyle : btnStyle} title="Underline"><RiUnderline size={16} /></button>
        
        <div style={dividerStyle} />
        
        {/* Alignment */}
        <button type="button" onClick={() => exec('justifyLeft')} style={editorState.alignment === 'left' ? activeBtnStyle : btnStyle} title="Align Left"><RiAlignLeft size={16} /></button>
        <button type="button" onClick={() => exec('justifyCenter')} style={editorState.alignment === 'center' ? activeBtnStyle : btnStyle} title="Align Center"><RiAlignCenter size={16} /></button>
        <button type="button" onClick={() => exec('justifyRight')} style={editorState.alignment === 'right' ? activeBtnStyle : btnStyle} title="Align Right"><RiAlignRight size={16} /></button>
        <button type="button" onClick={() => exec('justifyFull')} style={editorState.alignment === 'justify' ? activeBtnStyle : btnStyle} title="Justify"><RiAlignJustify size={16} /></button>
        
        <div style={dividerStyle} />

        {/* Table Dropdown */}
        <div ref={gridContainerRef} style={{ position: 'relative' }}>
          <button 
            type="button" 
            onClick={() => setShowTableGrid(!showTableGrid)} 
            style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '2px' }} 
            title="Insert Table"
          >
            <RiTable2 size={16} />
            <RiArrowDownSLine size={12} />
          </button>
          
          {showTableGrid && (
            <div style={gridPopupStyle} onMouseLeave={() => setHoveredGrid({ r: 0, c: 0 })}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '6px', textAlign: 'center' }}>
                INSERT TABLE ({hoveredGrid.r}x{hoveredGrid.c})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {renderGridSquares()}
              </div>
            </div>
          )}
        </div>

        {/* Shapes Dropdown */}
        <div ref={shapesRef} style={{ position: 'relative' }}>
          <button 
            type="button" 
            onClick={() => setShowShapesDropdown(!showShapesDropdown)} 
            style={{ ...btnStyle, gap: '2px' }} 
            title="Insert Shapes"
          >
            <RiShapesLine size={16} />
            <RiArrowDownSLine size={12} />
          </button>
          {showShapesDropdown && (
            <div style={{ ...dropdownListStyle, minWidth: '200px', maxHeight: '320px', overflowY: 'auto', padding: '6px' }}>
              <div style={shapeHeaderStyle}>Lines</div>
              <button type="button" onClick={() => insertShape('line-solid')} style={shapeItemStyle}>— Solid Blue Line</button>
              <button type="button" onClick={() => insertShape('line-double')} style={shapeItemStyle}>═ Double Gray Line</button>
              <button type="button" onClick={() => insertShape('line-dotted')} style={shapeItemStyle}>⋯ Dotted Gray Line</button>
              
              <div style={shapeHeaderStyle}>Callout Boxes</div>
              <button type="button" onClick={() => insertShape('box-info')} style={shapeItemStyle}>ℹ Info Box (Blue)</button>
              <button type="button" onClick={() => insertShape('box-warning')} style={shapeItemStyle}>⚠ Warning Box (Yellow)</button>
              <button type="button" onClick={() => insertShape('box-bordered')} style={shapeItemStyle}>☐ Bordered Box</button>
              
              <div style={shapeHeaderStyle}>Badges</div>
              <button type="button" onClick={() => insertShape('badge-info')} style={shapeItemStyle}>● Blue Pill Badge</button>
              <button type="button" onClick={() => insertShape('badge-success')} style={shapeItemStyle}>● Green Pill Badge</button>
              
              <div style={shapeHeaderStyle}>Symbols & Arrows</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', padding: '4px' }}>
                <button type="button" onClick={() => insertShape('arrow-right')} style={symbolBtnStyle} title="Right Arrow">➔</button>
                <button type="button" onClick={() => insertShape('arrow-left')} style={symbolBtnStyle} title="Left Arrow">◀</button>
                <button type="button" onClick={() => insertShape('arrow-up')} style={symbolBtnStyle} title="Up Arrow">▲</button>
                <button type="button" onClick={() => insertShape('arrow-down')} style={symbolBtnStyle} title="Down Arrow">▼</button>
                <button type="button" onClick={() => insertShape('arrow-double')} style={symbolBtnStyle} title="Double Arrow">↔</button>
              </div>
            </div>
          )}
        </div>

        {/* Insert Image */}
        <input 
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              insertImage(e.target.files[0]);
            }
            e.target.value = '';
          }}
          style={{ display: 'none' }}
        />
        <button 
          type="button" 
          onClick={() => fileInputRef.current?.click()} 
          style={btnStyle} 
          title="Insert Image (Logo/Signature)"
        >
          <RiImageAddLine size={16} />
        </button>

        <button type="button" onClick={() => exec('removeFormat')} style={btnStyle} title="Clear Formatting"><RiFormatClear size={16} /></button>

        {/* Contextual Table Tools */}
        {activeCell && (
          <div style={tableToolsWrapper}>
            <div style={dividerStyle} />
            <span style={tableToolsLabel}>Table Tools:</span>
            <button type="button" onClick={() => addRow('above')} style={tableBtnStyle} title="Insert Row Above">Row +↑</button>
            <button type="button" onClick={() => addRow('below')} style={tableBtnStyle} title="Insert Row Below">Row +↓</button>
            <button type="button" onClick={deleteRow} style={tableDeleteBtnStyle} title="Delete Row">Delete Row</button>
            <button type="button" onClick={() => addColumn('left')} style={tableBtnStyle} title="Insert Column Left">Col +←</button>
            <button type="button" onClick={() => addColumn('right')} style={tableBtnStyle} title="Insert Column Right">Col +→</button>
            <button type="button" onClick={deleteColumn} style={tableDeleteBtnStyle} title="Delete Column">Delete Col</button>
            <button type="button" onClick={deleteTable} style={{ ...tableDeleteBtnStyle, fontWeight: 700 }} title="Delete Table">Delete Table</button>
          </div>
        )}

        {/* Contextual Image Tools */}
        {activeImage && (
          <div style={tableToolsWrapper}>
            <div style={dividerStyle} />
            <span style={tableToolsLabel}>Image Tools:</span>
            <button type="button" onClick={() => alignImage('left')} style={tableBtnStyle} title="Align Block Left">Left</button>
            <button type="button" onClick={() => alignImage('center')} style={tableBtnStyle} title="Align Center">Center</button>
            <button type="button" onClick={() => alignImage('right')} style={tableBtnStyle} title="Align Block Right">Right</button>
            <button type="button" onClick={() => alignImage('inline')} style={tableBtnStyle} title="Align Inline with Text">Inline</button>
            
            <div style={dividerStyle} />
            <button type="button" onClick={() => adjustImageWidth(-10)} style={tableBtnStyle} title="Shrink Image 10%">Width -10%</button>
            <button type="button" onClick={() => adjustImageWidth(10)} style={tableBtnStyle} title="Enlarge Image 10%">Width +10%</button>
            <button type="button" onClick={() => setImageWidthPercent(25)} style={tableBtnStyle}>25%</button>
            <button type="button" onClick={() => setImageWidthPercent(50)} style={tableBtnStyle}>50%</button>
            <button type="button" onClick={() => setImageWidthPercent(100)} style={tableBtnStyle}>100%</button>
            <button type="button" onClick={resetImageWidth} style={tableBtnStyle}>Auto</button>
            
            <button type="button" onClick={deleteImage} style={tableDeleteBtnStyle} title="Delete Image">Delete Image</button>
          </div>
        )}

        {/* Contextual Shape Tools */}
        {activeShape && (
          <div style={tableToolsWrapper}>
            <div style={dividerStyle} />
            <span style={tableToolsLabel}>Shape Tools:</span>
            
            {/* Shape Background Color */}
            <div ref={shapeBgRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button 
                type="button" 
                onClick={() => setShowShapeBgDropdown(!showShapeBgDropdown)} 
                style={{ ...tableBtnStyle, gap: '4px' }} 
                title="Shape Background Color"
              >
                <span>Bg:</span>
                <span style={{ 
                  width: '12px', 
                  height: '12px', 
                  backgroundColor: shapeBgColor || 'transparent', 
                  border: '1px solid #94a3b8',
                  display: 'inline-block'
                }} />
                <RiArrowDownSLine size={10} />
              </button>
              {showShapeBgDropdown && (
                <div style={shapeToolsColorDropdownStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px', marginBottom: '6px' }}>
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setShapeBgColor(c);
                          setShowShapeBgDropdown(false);
                        }}
                        style={{
                          width: '14px',
                          height: '14px',
                          backgroundColor: c,
                          border: isColorMatch(c, shapeBgColor) ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                          cursor: 'pointer',
                          padding: 0,
                          borderRadius: 0
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShapeBgColor('transparent');
                      setShowShapeBgDropdown(false);
                    }} 
                    style={{ ...tableBtnStyle, width: '100%', justifyContent: 'center' }}
                  >
                    Clear Background
                  </button>
                </div>
              )}
            </div>

            {/* Shape Border/Line Color */}
            <div ref={shapeBorderRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button 
                type="button" 
                onClick={() => setShowShapeBorderDropdown(!showShapeBorderDropdown)} 
                style={{ ...tableBtnStyle, gap: '4px' }} 
                title="Shape Border/Line Color"
              >
                <span>Border:</span>
                <span style={{ 
                  width: '12px', 
                  height: '12px', 
                  backgroundColor: shapeBorderColor || 'transparent', 
                  border: '1px solid #94a3b8',
                  display: 'inline-block'
                }} />
                <RiArrowDownSLine size={10} />
              </button>
              {showShapeBorderDropdown && (
                <div style={shapeToolsColorDropdownStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setShapeBorderColor(c);
                          setShowShapeBorderDropdown(false);
                        }}
                        style={{
                          width: '14px',
                          height: '14px',
                          backgroundColor: c,
                          border: isColorMatch(c, shapeBorderColor) ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                          cursor: 'pointer',
                          padding: 0,
                          borderRadius: 0
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Shape Text Color */}
            <div ref={shapeTextRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button 
                type="button" 
                onClick={() => setShowShapeTextDropdown(!showShapeTextDropdown)} 
                style={{ ...tableBtnStyle, gap: '4px' }} 
                title="Shape Text Color"
              >
                <span>Text:</span>
                <span style={{ 
                  width: '12px', 
                  height: '12px', 
                  backgroundColor: shapeTextColor || '#000000', 
                  border: '1px solid #94a3b8',
                  display: 'inline-block'
                }} />
                <RiArrowDownSLine size={10} />
              </button>
              {showShapeTextDropdown && (
                <div style={shapeToolsColorDropdownStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setShapeTextColor(c);
                          setShowShapeTextDropdown(false);
                        }}
                        style={{
                          width: '14px',
                          height: '14px',
                          backgroundColor: c,
                          border: isColorMatch(c, shapeTextColor) ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                          cursor: 'pointer',
                          padding: 0,
                          borderRadius: 0
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Margins / Spacing */}
            <button type="button" onClick={() => adjustShapeMargin(-4)} style={tableBtnStyle} title="Decrease Margins">Margin -</button>
            <button type="button" onClick={() => adjustShapeMargin(4)} style={tableBtnStyle} title="Increase Margins">Margin +</button>
            
            {/* Width Adjustment */}
            <button type="button" onClick={() => adjustShapeWidth(-10)} style={tableBtnStyle} title="Decrease Width 10%">Width -10%</button>
            <button type="button" onClick={() => adjustShapeWidth(10)} style={tableBtnStyle} title="Increase Width 10%">Width +10%</button>
            
            {/* Alignment */}
            <button type="button" onClick={() => alignShape('left')} style={tableBtnStyle}>Left</button>
            <button type="button" onClick={() => alignShape('center')} style={tableBtnStyle}>Center</button>
            <button type="button" onClick={() => alignShape('right')} style={tableBtnStyle}>Right</button>

            {/* Line thickness (only for line shape) */}
            {activeShape.getAttribute('data-shape') === 'line' && (
              <>
                <button type="button" onClick={() => adjustLineThickness(-1)} style={tableBtnStyle}>Thinner</button>
                <button type="button" onClick={() => adjustLineThickness(1)} style={tableBtnStyle}>Thicker</button>
              </>
            )}

            <button type="button" onClick={deleteShape} style={tableDeleteBtnStyle} title="Delete Shape">Delete Shape</button>
          </div>
        )}
      </div>

      {/* WRAPPER FOR EDITOR + HANDLES */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* EDITABLE CONTENT AREA */}
        <div 
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          style={{
            ...editorStyle,
            minHeight,
          }}
          data-placeholder={placeholder}
          className="rich-editor-content"
        />

        {/* Bounding box resize handles absolute overlay */}
        {selectionRect && (
          <>
            {/* Outline Box */}
            <div style={{
              position: 'absolute',
              top: selectionRect.top,
              left: selectionRect.left,
              width: selectionRect.width,
              height: selectionRect.height,
              border: '2px solid #7c3aed',
              pointerEvents: 'none',
              zIndex: 999,
              boxSizing: 'border-box'
            }} />
            
            {/* Edge Border Hover Zones */}
            <div 
              style={{
                position: 'absolute',
                top: selectionRect.top - 3,
                left: selectionRect.left,
                width: selectionRect.width,
                height: '6px',
                cursor: 'ns-resize',
                zIndex: 998
              }}
              onMouseDown={(e) => startHandleDrag(e, 't')}
            />
            <div 
              style={{
                position: 'absolute',
                top: selectionRect.top + selectionRect.height - 3,
                left: selectionRect.left,
                width: selectionRect.width,
                height: '6px',
                cursor: 'ns-resize',
                zIndex: 998
              }}
              onMouseDown={(e) => startHandleDrag(e, 'b')}
            />
            <div 
              style={{
                position: 'absolute',
                top: selectionRect.top,
                left: selectionRect.left - 3,
                width: '6px',
                height: selectionRect.height,
                cursor: 'ew-resize',
                zIndex: 998
              }}
              onMouseDown={(e) => startHandleDrag(e, 'l')}
            />
            <div 
              style={{
                position: 'absolute',
                top: selectionRect.top,
                left: selectionRect.left + selectionRect.width - 3,
                width: '6px',
                height: selectionRect.height,
                cursor: 'ew-resize',
                zIndex: 998
              }}
              onMouseDown={(e) => startHandleDrag(e, 'r')}
            />
            
            {/* Corner Control Point Handles */}
            <div 
              style={{ ...handleStyle('nwse-resize'), top: selectionRect.top - 4, left: selectionRect.left - 4 }} 
              onMouseDown={(e) => startHandleDrag(e, 'tl')}
            />
            <div 
              style={{ ...handleStyle('nesw-resize'), top: selectionRect.top - 4, left: selectionRect.left + selectionRect.width - 4 }} 
              onMouseDown={(e) => startHandleDrag(e, 'tr')}
            />
            <div 
              style={{ ...handleStyle('nesw-resize'), top: selectionRect.top + selectionRect.height - 4, left: selectionRect.left - 4 }} 
              onMouseDown={(e) => startHandleDrag(e, 'bl')}
            />
            <div 
              style={{ ...handleStyle('nwse-resize'), top: selectionRect.top + selectionRect.height - 4, left: selectionRect.left + selectionRect.width - 4 }} 
              onMouseDown={(e) => startHandleDrag(e, 'br')}
            />

            {/* Edge Midpoint Control Point Handles */}
            <div 
              style={{ ...handleStyle('ns-resize'), top: selectionRect.top - 4, left: selectionRect.left + (selectionRect.width / 2) - 4 }} 
              onMouseDown={(e) => startHandleDrag(e, 't')}
            />
            <div 
              style={{ ...handleStyle('ns-resize'), top: selectionRect.top + selectionRect.height - 4, left: selectionRect.left + (selectionRect.width / 2) - 4 }} 
              onMouseDown={(e) => startHandleDrag(e, 'b')}
            />
            <div 
              style={{ ...handleStyle('ew-resize'), top: selectionRect.top + (selectionRect.height / 2) - 4, left: selectionRect.left - 4 }} 
              onMouseDown={(e) => startHandleDrag(e, 'l')}
            />
            <div 
              style={{ ...handleStyle('ew-resize'), top: selectionRect.top + (selectionRect.height / 2) - 4, left: selectionRect.left + selectionRect.width - 4 }} 
              onMouseDown={(e) => startHandleDrag(e, 'r')}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Inline Styles (Strictly square edges, premium styling)
const containerStyle: React.CSSProperties = {
  border: '1px solid var(--gray-300)',
  borderRadius: 0,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'white',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 8px',
  backgroundColor: 'var(--gray-50)',
  borderBottom: '1px solid var(--gray-300)',
  flexWrap: 'wrap',
  gap: '4px',
};

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--gray-700)',
  padding: '6px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 0,
  transition: 'background 0.1s, color 0.1s',
};

const activeBtnStyle: React.CSSProperties = {
  background: '#ddd6fe',
  border: 'none',
  color: '#7c3aed',
  padding: '6px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 0,
  transition: 'background 0.1s, color 0.1s',
};

const dividerStyle: React.CSSProperties = {
  width: '1px',
  height: '18px',
  backgroundColor: 'var(--gray-300)',
  margin: '0 4px',
};

const gridPopupStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 100,
  backgroundColor: 'white',
  border: '1px solid var(--gray-300)',
  boxShadow: 'var(--shadow-md)',
  padding: '8px',
  marginTop: '4px',
  borderRadius: 0,
};

const dropdownListStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 100,
  backgroundColor: 'white',
  border: '1px solid var(--gray-300)',
  boxShadow: 'var(--shadow-md)',
  display: 'flex',
  flexDirection: 'column',
  padding: '4px 0',
  marginTop: '4px',
  borderRadius: 0,
  minWidth: '120px'
};

const dropdownItemStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  textAlign: 'left',
  padding: '6px 12px',
  fontSize: '0.75rem',
  cursor: 'pointer',
  color: 'var(--gray-700)',
  width: '100%',
  display: 'block',
  transition: 'background 0.1s'
};

const editorStyle: React.CSSProperties = {
  padding: '12px',
  outline: 'none',
  fontFamily: 'Times New Roman, serif',
  fontSize: '11pt',
  lineHeight: '1.6',
  color: '#000',
  overflowY: 'auto',
  cursor: 'text',
};

const tableToolsWrapper: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  flexWrap: 'wrap',
};

const tableToolsLabel: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 700,
  color: '#7c3aed',
  textTransform: 'uppercase',
  marginRight: '2px',
};

const tableBtnStyle: React.CSSProperties = {
  background: '#f3f4f6',
  border: '1px solid #d1d5db',
  borderRadius: 0,
  color: 'var(--gray-700)',
  padding: '3px 6px',
  fontSize: '0.68rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  fontWeight: 600,
};

const tableDeleteBtnStyle: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 0,
  color: '#dc2626',
  padding: '3px 6px',
  fontSize: '0.68rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  fontWeight: 600,
};

const shapeHeaderStyle: React.CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 700,
  color: 'var(--gray-500)',
  textTransform: 'uppercase',
  padding: '6px 8px 2px 8px',
  borderTop: '1px solid var(--gray-100)',
  marginTop: '4px',
};

const shapeItemStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  textAlign: 'left',
  padding: '6px 8px',
  fontSize: '0.75rem',
  cursor: 'pointer',
  color: 'var(--gray-700)',
  width: '100%',
  display: 'block',
  transition: 'background 0.1s',
  borderRadius: 0,
};

const symbolBtnStyle: React.CSSProperties = {
  background: '#f3f4f6',
  border: '1px solid #cbd5e1',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '24px',
  fontSize: '0.85rem',
  borderRadius: 0,
  transition: 'background 0.1s',
  color: 'var(--gray-700)',
};

const shapeToolsColorDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  zIndex: 100,
  backgroundColor: 'white',
  border: '1px solid var(--gray-300)',
  boxShadow: 'var(--shadow-md)',
  padding: '8px',
  marginTop: '4px',
  borderRadius: 0,
  minWidth: '180px'
};
