'use client';
import dynamic from 'next/dynamic';
import {
  RADIOLOGY_TEMPLATES, convertTextToFormattedHtml,
  type RadiologyFormState,
} from '@/lib/radiology-templates';
import type { Department, RadiologyTemplate } from '@/lib/store';
import TemplatePicker, { PickableTemplate } from './TemplatePicker';
import ObstetricsCalculator from './ObstetricsCalculator';
import ScanImagePicker from './ScanImagePicker';
import { labelStyle } from './entryFormStyles';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });

interface Props {
  value: RadiologyFormState;
  onChange: (next: RadiologyFormState) => void;
  department: Department;
  /** Drives the obstetric calculator, which only applies to an obstetric scan. */
  testId: string;
  customTemplates: RadiologyTemplate[];
  onManageTemplates: () => void;
}

/**
 * Free-text report entry: a prose findings and impression pair, plus the
 * template picker, obstetric calculator and scan images that only radiology
 * gets. A lab test with no catalogue parameters lands here too, and sees just
 * the two editors.
 */
export default function RadiologyEntryForm({
  value, onChange, department, testId, customTemplates, onManageTemplates,
}: Props) {
  const isRadiology = department === 'radiology';
  const isObs = testId === 'us_obs';

  const templates: PickableTemplate[] = [
    ...Object.entries(RADIOLOGY_TEMPLATES).map(([key, val]) => ({
      key, name: val.name, findings: val.findings, impression: val.impression, isSystem: true,
    })),
    ...customTemplates.map(t => ({
      key: t.key, name: t.name, findings: t.findings, impression: t.impression, isSystem: false,
    })),
  ];

  // The pre-split code also stashed a `templateId` on the form state here.
  // Nothing ever read it — it is not part of RadiologyFormState and not
  // serialised — so it is dropped rather than carried across.
  const applyTemplate = (template: PickableTemplate) =>
    onChange({
      ...value,
      findings: convertTextToFormattedHtml(template.findings),
      impression: convertTextToFormattedHtml(template.impression),
    });

  const toggleImage = (path: string) =>
    onChange({
      ...value,
      images: value.images.includes(path)
        ? value.images.filter(img => img !== path)
        : [...value.images, path],
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>

      {isRadiology && (
        <TemplatePicker
          templates={templates}
          onSelect={applyTemplate}
          onManageTemplates={onManageTemplates}
        />
      )}

      {isObs && <ObstetricsCalculator value={value} onChange={onChange} />}

      <div>
        <label style={labelStyle}>Report Findings (Prose)</label>
        <RichTextEditor
          value={value.findings}
          onChange={val => onChange({ ...value, findings: val })}
          placeholder="Describe the findings for each organ in detail..."
        />
      </div>

      <div>
        <label style={labelStyle}>Clinical Impression / Conclusion</label>
        <RichTextEditor
          value={value.impression}
          onChange={val => onChange({ ...value, impression: val })}
          placeholder="Write clinical impression, summary, or suggestions here..."
          minHeight="120px"
        />
      </div>

      {isRadiology && <ScanImagePicker images={value.images} onToggle={toggleImage} />}
    </div>
  );
}
