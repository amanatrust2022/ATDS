'use client';
import { useNotices } from '@/components/Notices';
import { useState, useEffect, useRef } from 'react';
import {
  RiUploadCloud2Line,
  RiSearchLine, RiDeleteBin6Line, RiEdit2Line, RiAddLine, RiCheckLine,
} from '@remixicon/react';
import { 
  RadiologyTemplate, fetchCustomTemplates, addCustomTemplate, 
  updateCustomTemplate, deleteCustomTemplate 
} from '@/lib/store';
import { RADIOLOGY_TEMPLATES, convertTextToFormattedHtml, splitTemplateContent } from '@/lib/radiology-templates';
import dynamic from 'next/dynamic';
const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false });

import {
  Alert, Badge, Button, Dialog, EmptyState, Field, Input, LoadingPanel,
} from '@/components/ui';
import type { AlertTone } from '@/components/ui';

import styles from './templateManager.module.css';

const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ');

/** An import either failed, is running, or worked. Each gets its own voice. */
const IMPORT_TONE: Record<'success' | 'error' | 'loading', AlertTone> = {
  success: 'success',
  error: 'critical',
  loading: 'info',
};

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
  const { notify, ask } = useNotices();
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
    if (!await ask('Are you sure you want to delete this custom template?')) return;
    try {
      await deleteCustomTemplate(id);
      await loadTemplates();
      if (onTemplateChange) onTemplateChange();
    } catch (err) {
      notify('Failed to delete template', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formFindings.trim()) {
      notify('Template Name and Findings are required.', 'info');
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
      notify('Failed to save template: ' + err.message, 'error');
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
    <Dialog
      open={isOpen}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title="Radiology Templates Manager"
      description="Create, import, and customize report templates for your organization"
      size="lg"
      tall
    >
      {editingTemplate ? (
        /* ADD/EDIT FORM VIEW */
        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.formHead}>
            <h3 className={styles.formTitle}>
              {editingTemplate.id ? 'Edit Template' : 'Add New Template'}
            </h3>
            <Button type="button" size="sm" onClick={() => setEditingTemplate(null)}>
              Back to List
            </Button>
          </div>

          {/* Drag and Drop Zone */}
          {!editingTemplate.id && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={onFileInputChange}
                accept=".docx,.txt"
                className={styles.fileInput}
                aria-label="Template file to import"
              />
              <button
                type="button"
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={cx(styles.dropzone, dragActive && styles.dropzoneActive)}
              >
                <RiUploadCloud2Line size={32} className={styles.dropIcon} aria-hidden="true" />
                <p className={styles.dropLead}>
                  Drag &amp; drop your Word (.docx) or Text (.txt) template here
                </p>
                <p className={styles.dropHint}>or click to browse your files</p>
                <span className={styles.dropKinds}>
                  <Badge tone="neutral">Word</Badge>
                  <Badge tone="neutral">Plain Text</Badge>
                </span>
              </button>
            </div>
          )}

          {/* Import status message */}
          {importStatus && (
            <Alert tone={IMPORT_TONE[importStatus.type]} live>
              {importStatus.message}
            </Alert>
          )}

          <div className={styles.fields}>
            <Field label="Template name" required>
              <Input
                required
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Normal Pelvis (Female)"
              />
            </Field>

            <RichTextEditor
              value={formFindings}
              onChange={setFormFindings}
              ariaLabel="Findings, organ by organ (required)"
              placeholder="Describe findings in detail (e.g. LIVER: Normal in size...)"
            />

            <RichTextEditor
              value={formImpression}
              onChange={setFormImpression}
              ariaLabel="Impression or conclusion (optional)"
              placeholder="e.g. IMPRESSION: Normal pelvic ultrasound findings."
              minHeight="120px"
            />
          </div>

          <div className={styles.formActions}>
            <Button type="button" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button type="submit" intent="primary" disabled={saving} icon={<RiCheckLine size={16} />}>
              {saving ? 'Saving…' : 'Save Template'}
            </Button>
          </div>
        </form>
      ) : (
        /* LIST VIEW */
        <div className={styles.list}>
          <div className={styles.listHeader}>
            <div className={styles.search}>
              <Field label="Search templates">
                <Input
                  prefix={<RiSearchLine size={16} />}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                />
              </Field>
            </div>

            <Button intent="primary" icon={<RiAddLine size={16} />} onClick={startAddTemplate}>
              Add Custom Template
            </Button>
          </div>

          <div className={styles.cards}>
            {loading ? (
              <LoadingPanel label="Loading templates…" />
            ) : filteredTemplates.length === 0 ? (
              <div className={styles.empty}>
                <EmptyState title="No templates found matching your search.">
                  Clear the search, or add a template of your own.
                </EmptyState>
              </div>
            ) : (
              filteredTemplates.map(t => (
                <div key={t.id} className={cx(styles.card, !t.isSystem && styles.cardCustom)}>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardHead}>
                      <h4 className={styles.cardName}>{t.name}</h4>
                      {t.isSystem ? (
                        <Badge tone="neutral">System Default</Badge>
                      ) : (
                        <Badge tone="accent">Custom Template</Badge>
                      )}
                    </div>
                    <p className={styles.cardPreview}>{getTextPreview(t.findings)}...</p>
                  </div>

                  {/* Action buttons */}
                  {!t.isSystem && (
                    <div className={styles.cardActions}>
                      <Button
                        size="sm"
                        icon={<RiEdit2Line size={14} />}
                        aria-label={`Edit ${t.name}`}
                        onClick={() => startEditTemplate(t as RadiologyTemplate)}
                      />
                      <Button
                        size="sm"
                        intent="dangerQuiet"
                        icon={<RiDeleteBin6Line size={14} />}
                        aria-label={`Delete ${t.name}`}
                        onClick={() => handleDelete(t.id)}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
