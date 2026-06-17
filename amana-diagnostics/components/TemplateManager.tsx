'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  RiCloseLine, RiUploadCloud2Line, RiFileWordLine, RiFileTextLine, 
  RiSearchLine, RiDeleteBin6Line, RiEdit2Line, RiAddLine, RiCheckLine,
  RiLoader4Line
} from '@remixicon/react';
import { 
  RadiologyTemplate, fetchCustomTemplates, addCustomTemplate, 
  updateCustomTemplate, deleteCustomTemplate 
} from '@/lib/store';
import { RADIOLOGY_TEMPLATES, convertTextToFormattedHtml, splitTemplateContent } from '@/lib/radiology-templates';
import RichTextEditor from './RichTextEditor';

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  userId?: string;
  onTemplateChange?: () => void;
}

export default function TemplateManager({ 
  isOpen, 
  onClose, 
  organizationId, 
  userId,
  onTemplateChange 
}: TemplateManagerProps) {
  const [customTemplates, setCustomTemplates] = useState<RadiologyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [editingTemplate, setEditingTemplate] = useState<Partial<RadiologyTemplate> | null>(null);
  const [formName, setFormName] = useState('');
  const [formFindings, setFormFindings] = useState('');
  const [formImpression, setFormImpression] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | 'loading'; message: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && organizationId) {
      loadTemplates();
    }
  }, [isOpen, organizationId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await fetchCustomTemplates(organizationId);
      setCustomTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Combine default system templates with custom ones
  const allTemplates = [
    ...Object.entries(RADIOLOGY_TEMPLATES).map(([key, val]) => ({
      id: `system_${key}`,
      organization_id: 'system',
      key,
      name: `${val.name} (System)`,
      findings: val.findings,
      impression: val.impression,
      isSystem: true
    })),
    ...customTemplates.map(t => ({ ...t, isSystem: false }))
  ];

  const filteredTemplates = allTemplates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.findings.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startAddTemplate = () => {
    setEditingTemplate({ organization_id: organizationId });
    setFormName('');
    setFormFindings('');
    setFormImpression('');
    setImportStatus(null);
  };

  const startEditTemplate = (template: RadiologyTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    // Convert text templates to HTML if they are plain text
    setFormFindings(convertTextToFormattedHtml(template.findings));
    setFormImpression(convertTextToFormattedHtml(template.impression));
    setImportStatus(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom template?')) return;
    try {
      await deleteCustomTemplate(id);
      await loadTemplates();
      if (onTemplateChange) onTemplateChange();
    } catch (err) {
      alert('Failed to delete template');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formFindings.trim()) {
      alert('Template Name and Findings are required.');
      return;
    }
    setSaving(true);
    
    const templateKey = editingTemplate?.key || formName.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');

    try {
      if (editingTemplate?.id && !editingTemplate.id.startsWith('system_')) {
        await updateCustomTemplate(editingTemplate.id, {
          name: formName,
          key: templateKey,
          findings: formFindings,
          impression: formImpression
        });
      } else {
        await addCustomTemplate({
          organization_id: organizationId,
          name: formName,
          key: templateKey,
          findings: formFindings,
          impression: formImpression
        }, userId);
      }
      
      setEditingTemplate(null);
      await loadTemplates();
      if (onTemplateChange) onTemplateChange();
    } catch (err: any) {
      console.error(err);
      alert('Failed to save template: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Heuristic parser to split Findings and Impression and format as HTML
  const parseAndFillText = (text: string, filename: string) => {
    setImportStatus({ type: 'loading', message: 'Extracting content...' });
    
    const cleanedName = filename
      .replace(/\.[^/.]+$/, "") 
      .replace(/[-_]+/g, " ")    
      .replace(/\b\w/g, c => c.toUpperCase()); 

    const { findings, impression } = splitTemplateContent(text);

    // Process using convertTextToFormattedHtml (strips colons, normalizes white spaces, bolds & capitalizes headers)
    const findingsHtml = convertTextToFormattedHtml(findings);
    const impressionHtml = convertTextToFormattedHtml(impression);

    setFormName(prev => prev || cleanedName);
    setFormFindings(findingsHtml);
    setFormImpression(impressionHtml);
    
    setImportStatus({
      type: 'success',
      message: `Successfully extracted and formatted text from "${filename}". Please review and adjust the fields below.`
    });
  };

  const handleFile = async (file: File) => {
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'txt') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        parseAndFillText(text, file.name);
      };
      reader.onerror = () => {
        setImportStatus({ type: 'error', message: 'Error reading text file' });
      };
      reader.readAsText(file);
    } else if (extension === 'docx') {
      setImportStatus({ type: 'loading', message: 'Reading Word document...' });
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        try {
          const mammoth = await import('mammoth');
          const result = await mammoth.convertToHtml({ arrayBuffer });
          parseAndFillText(result.value, file.name);
        } catch (err: any) {
          console.error(err);
          setImportStatus({ 
            type: 'error', 
            message: `Failed to parse Word Document: ${err.message || err}` 
          });
        }
      };
      reader.onerror = () => {
        setImportStatus({ type: 'error', message: 'Error reading file buffer' });
      };
      reader.readAsArrayBuffer(file);
    } else {
      setImportStatus({ 
        type: 'error', 
        message: 'Unsupported file type. Please upload a Word (.docx) or Text (.txt) file.' 
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Helper to get text preview of HTML content
  const getTextPreview = (htmlOrText: string) => {
    const formatted = convertTextToFormattedHtml(htmlOrText);
    const text = formatted.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    return text.substring(0, 160).trim();
  };

  return (
    <div style={modalOverlay}>
      <div style={modalContainer}>
        {/* Header */}
        <div style={modalHeader}>
          <div>
            <h2 style={modalTitle}>Radiology Templates Manager</h2>
            <p style={modalSubtitle}>Create, import, and customize report templates for your organization</p>
          </div>
          <button onClick={onClose} style={closeButton} aria-label="Close modal">
            <RiCloseLine size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div style={modalBody}>
          {editingTemplate ? (
            /* ADD/EDIT FORM VIEW */
            <form onSubmit={handleSave} style={formContainer}>
              <div style={formHeader}>
                <h3 style={formTitle}>
                  {editingTemplate.id ? 'Edit Template' : 'Add New Template'}
                </h3>
                <button 
                  type="button" 
                  onClick={() => setEditingTemplate(null)}
                  style={cancelFormButton}
                >
                  Back to List
                </button>
              </div>

              {/* Drag and Drop Zone */}
              {!editingTemplate.id && (
                <div 
                  onDragEnter={handleDrag} 
                  onDragOver={handleDrag} 
                  onDragLeave={handleDrag} 
                  onDrop={handleDrop}
                  onClick={triggerFileSelect}
                  style={{
                    ...dropzoneStyle,
                    borderColor: dragActive ? '#7c3aed' : '#d1d5db',
                    backgroundColor: dragActive ? '#f5f3ff' : '#f9fafb',
                  }}
                >
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    onChange={onFileInputChange} 
                    accept=".docx,.txt" 
                    style={{ display: 'none' }} 
                  />
                  <RiUploadCloud2Line size={32} style={{ color: dragActive ? '#7c3aed' : '#9ca3af', marginBottom: '0.5rem' }} />
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-700)', margin: '0 0 0.25rem 0' }}>
                    Drag & drop your Word (.docx) or Text (.txt) template here
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--gray-500)', margin: 0 }}>
                    or click to browse your files
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <span style={fileTypeBadge}><RiFileWordLine size={12} /> Word</span>
                    <span style={fileTypeBadge}><RiFileTextLine size={12} /> Plain Text</span>
                  </div>
                </div>
              )}

              {/* Import status message */}
              {importStatus && (
                <div style={{
                  ...statusMessageStyle,
                  borderColor: importStatus.type === 'error' ? '#f5c6cb' : importStatus.type === 'loading' ? '#bee5eb' : '#c3e6cb',
                  backgroundColor: importStatus.type === 'error' ? '#f8d7da' : importStatus.type === 'loading' ? '#d1ecf1' : '#d4edda',
                  color: importStatus.type === 'error' ? '#721c24' : importStatus.type === 'loading' ? '#0c5460' : '#155724'
                }}>
                  {importStatus.type === 'loading' && <span style={{ marginRight: '0.4rem', display: 'inline-block' }}>⌛</span>}
                  <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{importStatus.message}</span>
                </div>
              )}

              <div style={formInputs}>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Template Name *</label>
                  <input
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Normal Pelvis (Female)"
                    style={inputStyle}
                  />
                </div>

                <div style={fieldGroup}>
                  <label style={labelStyle}>Findings / Organ-by-Organ Description *</label>
                  <RichTextEditor
                    value={formFindings}
                    onChange={setFormFindings}
                    placeholder="Describe findings in detail (e.g. LIVER: Normal in size...)"
                  />
                </div>

                <div style={fieldGroup}>
                  <label style={labelStyle}>Impression / Conclusion (Optional)</label>
                  <RichTextEditor
                    value={formImpression}
                    onChange={setFormImpression}
                    placeholder="e.g. IMPRESSION: Normal pelvic ultrasound findings."
                    minHeight="120px"
                  />
                </div>
              </div>

              <div style={formActions}>
                <button 
                  type="button" 
                  onClick={() => setEditingTemplate(null)}
                  style={secondaryButton}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  style={primaryButton}
                >
                  {saving ? 'Saving...' : <><RiCheckLine size={16} /> Save Template</>}
                </button>
              </div>
            </form>
          ) : (
            /* LIST VIEW */
            <div style={listContainer}>
              <div style={listHeader}>
                {/* Search */}
                <div style={searchWrapper}>
                  <RiSearchLine size={16} style={searchIcon} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    style={searchInput}
                  />
                </div>

                {/* Add Button */}
                <button onClick={startAddTemplate} style={addButton}>
                  <RiAddLine size={16} /> Add Custom Template
                </button>
              </div>

              {/* Templates List */}
              <div style={templatesList}>
                {loading ? (
                  <div style={loadingState}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Loading templates...</p>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div style={emptyState}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>No templates found matching your search.</p>
                  </div>
                ) : (
                  filteredTemplates.map(t => (
                    <div 
                      key={t.id} 
                      style={{
                        ...templateCard,
                        borderLeftColor: t.isSystem ? 'var(--gray-300)' : '#7c3aed'
                      }}
                    >
                      <div style={templateInfo}>
                        <div style={templateHeaderRow}>
                          <h4 style={templateName}>{t.name}</h4>
                          {t.isSystem ? (
                            <span style={systemBadge}>System Default</span>
                          ) : (
                            <span style={customBadge}>Custom Template</span>
                          )}
                        </div>
                        <p style={templatePreviewText}>
                          {getTextPreview(t.findings)}...
                        </p>
                      </div>
                      
                      {/* Action buttons */}
                      {!t.isSystem && (
                        <div style={cardActions}>
                          <button 
                            onClick={() => startEditTemplate(t as RadiologyTemplate)}
                            style={cardIconButton}
                            title="Edit template"
                          >
                            <RiEdit2Line size={14} />
                          </button>
                          <button 
                            onClick={() => handleDelete(t.id)}
                            style={{ ...cardIconButton, color: '#dc2626' }}
                            title="Delete template"
                          >
                            <RiDeleteBin6Line size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline Styles (Strictly square edges to match design system)
const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1.5rem',
};

const modalContainer: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: 0,
  width: '100%',
  maxWidth: '850px',
  maxHeight: '95vh',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  border: '1px solid var(--gray-300)',
};

const modalHeader: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#f8fafc',
  borderRadius: 0,
};

const modalTitle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 700,
  color: '#0f172a',
  margin: 0,
};

const modalSubtitle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#64748b',
  margin: '0.15rem 0 0 0',
};

const closeButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.1s',
};

const modalBody: React.CSSProperties = {
  padding: '1.5rem',
  overflowY: 'auto',
  flex: 1,
};

const listContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
  height: '100%',
};

const listHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const searchWrapper: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  minWidth: '240px',
};

const searchIcon: React.CSSProperties = {
  position: 'absolute',
  left: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#94a3b8',
  pointerEvents: 'none',
};

const searchInput: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.75rem 0.55rem 2.25rem',
  border: '1px solid #cbd5e1',
  borderRadius: 0,
  fontSize: '0.85rem',
  color: '#0f172a',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const addButton: React.CSSProperties = {
  backgroundColor: '#7c3aed',
  color: 'white',
  border: 'none',
  borderRadius: 0,
  padding: '0.55rem 1rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.2)',
};

const templatesList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  maxHeight: '55vh',
  overflowY: 'auto',
  paddingRight: '4px',
};

const templateCard: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '1rem',
  border: '1px solid #e2e8f0',
  borderRadius: 0,
  borderLeftWidth: '4px',
  transition: 'all 0.15s',
  backgroundColor: '#fff',
};

const templateInfo: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  paddingRight: '1rem',
};

const templateHeaderRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.35rem',
  flexWrap: 'wrap',
};

const templateName: React.CSSProperties = {
  fontSize: '0.88rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: 0,
};

const systemBadge: React.CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 600,
  padding: '1px 6px',
  borderRadius: 0,
  backgroundColor: '#f1f5f9',
  color: '#475569',
  border: '1px solid #e2e8f0',
};

const customBadge: React.CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 600,
  padding: '1px 6px',
  borderRadius: 0,
  backgroundColor: '#f5f3ff',
  color: '#6d28d9',
  border: '1px solid #ddd6fe',
};

const templatePreviewText: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#64748b',
  margin: 0,
  lineHeight: '1.4',
};

const cardActions: React.CSSProperties = {
  display: 'flex',
  gap: '0.25rem',
};

const cardIconButton: React.CSSProperties = {
  background: 'none',
  border: '1px solid #e2e8f0',
  borderRadius: 0,
  width: '28px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#64748b',
  cursor: 'pointer',
  transition: 'all 0.1s',
};

const loadingState: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '3rem 0',
};

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: '2.5rem 0',
  border: '1px dashed #cbd5e1',
  borderRadius: 0,
  backgroundColor: '#f8fafc',
};

// Form styles
const formContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
};

const formHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px dashed #e2e8f0',
  paddingBottom: '0.75rem',
};

const formTitle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#0f172a',
  margin: 0,
};

const cancelFormButton: React.CSSProperties = {
  background: 'none',
  border: '1px solid #cbd5e1',
  borderRadius: 0,
  padding: '0.35rem 0.75rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#475569',
  cursor: 'pointer',
};

const dropzoneStyle: React.CSSProperties = {
  border: '2px dashed #cbd5e1',
  borderRadius: 0,
  padding: '1.5rem',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s ease-in-out',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const fileTypeBadge: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 0,
  backgroundColor: '#e2e8f0',
  color: '#475569',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
};

const statusMessageStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: 0,
  border: '1px solid',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const formInputs: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const fieldGroup: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#334155',
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
};

const inputStyle: React.CSSProperties = {
  padding: '0.55rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: 0,
  fontSize: '0.85rem',
  color: '#0f172a',
  outline: 'none',
};

const textareaStyle: React.CSSProperties = {
  padding: '0.65rem 0.85rem',
  border: '1px solid #cbd5e1',
  borderRadius: 0,
  fontSize: '0.85rem',
  color: '#0f172a',
  outline: 'none',
  resize: 'vertical',
  lineHeight: '1.5',
};

const formActions: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
  borderTop: '1px solid #e2e8f0',
  paddingTop: '1.25rem',
  marginTop: '0.5rem',
};

const primaryButton: React.CSSProperties = {
  backgroundColor: '#7c3aed',
  color: 'white',
  border: 'none',
  borderRadius: 0,
  padding: '0.6rem 1.25rem',
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.2)',
};

const secondaryButton: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  color: '#334155',
  border: '1px solid #cbd5e1',
  borderRadius: 0,
  padding: '0.6rem 1.25rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};
