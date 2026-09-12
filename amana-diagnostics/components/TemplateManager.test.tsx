import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the radiology template manager.
 *
 * The overlay a radiologist opens to add, import and edit report templates.
 * Written before the rebuild (decision #28), so each defect shows itself as a
 * failure rather than as a claim in a commit message.
 */

vi.mock('@/components/Notices', () => ({
  useNotices: () => ({ notify: vi.fn(), ask: vi.fn(async () => true) }),
}));

// The editor is loaded with next/dynamic and brings a contenteditable with it.
// A stand-in keeps these tests about the manager around it.
vi.mock('./RichTextEditor', () => ({
  default: ({ value, onChange, ariaLabel, placeholder }: any) => (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const customTemplates = [
  { id: 'c1', organization_id: 'org-1', key: 'knee', name: 'Knee MRI', findings: 'Menisci intact.', impression: 'Normal knee.' },
];

vi.mock('@/lib/store', () => ({
  fetchCustomTemplates: vi.fn(async () => customTemplates),
  addCustomTemplate: vi.fn(async () => ({})),
  updateCustomTemplate: vi.fn(async () => ({})),
  deleteCustomTemplate: vi.fn(async () => ({})),
}));

vi.mock('@/lib/radiology-templates', () => ({
  RADIOLOGY_TEMPLATES: {
    pelvis: { name: 'Normal Pelvis', findings: 'Uterus normal in size.', impression: 'Normal study.' },
  },
  convertTextToFormattedHtml: (s: string) => s,
  splitTemplateContent: (s: string) => ({ findings: s, impression: '' }),
}));

import TemplateManager from './TemplateManager';

const onClose = vi.fn();

const open = () =>
  render(
    <TemplateManager isOpen onClose={onClose} organizationId="org-1" userId="u-1" />,
  );

beforeEach(() => {
  onClose.mockClear();
});

describe('Radiology template manager', () => {
  /**
   * The overlay was hand-rolled: a fixed <div> over a fixed <div>, with no
   * role, no aria-modal and no name. Nothing told the assistive layer a dialog
   * had opened, focus was never trapped inside it, and Escape did nothing —
   * the only way out was to find the small × with a mouse. AGENTS rule 6.
   */
  it('opens as a named dialog', async () => {
    open();

    expect(
      await screen.findByRole('dialog', { name: /radiology templates manager/i }),
    ).toBeInTheDocument();
  });

  it('closes when the radiologist presses Escape', async () => {
    open();
    await screen.findByText(/knee mri/i);

    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  /**
   * Every field in here was a bare <label> over an input with no id — the
   * search box did not even have that, only a placeholder. A screen reader
   * reached four controls and could name none of them.
   */
  it('names the search box', async () => {
    open();
    await screen.findByText(/knee mri/i);

    expect(screen.getByRole('textbox', { name: /search templates/i })).toBeInTheDocument();
  });

  it('names the template name, findings and impression fields', async () => {
    open();
    await screen.findByText(/knee mri/i);

    fireEvent.click(screen.getByRole('button', { name: /add custom template/i }));

    expect(screen.getByRole('textbox', { name: /template name/i })).toBeInTheDocument();
    // The two editors arrive through next/dynamic, so they land a tick later.
    expect(await screen.findByRole('textbox', { name: /findings/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /impression/i })).toBeInTheDocument();
  });

  /**
   * The import dropzone was a <div onClick>. A radiologist without a mouse —
   * or dictating — could not open the file picker at all.
   */
  it('offers the import dropzone as a control a keyboard can reach', async () => {
    open();
    await screen.findByText(/knee mri/i);

    fireEvent.click(screen.getByRole('button', { name: /add custom template/i }));

    expect(screen.getByRole('button', { name: /drag . drop|choose a file|upload/i })).toBeInTheDocument();
  });

  /**
   * The import result was a coloured strip and nothing else: no live region,
   * so a screen reader never heard that the upload had failed, and no word
   * beyond the message itself to separate a failure from a success.
   */
  it('announces a rejected import', async () => {
    open();
    await screen.findByText(/knee mri/i);

    fireEvent.click(screen.getByRole('button', { name: /add custom template/i }));

    const file = new File(['scan'], 'scan.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/unsupported file type/i);
  });

  // Behaviour guards. These held on the old manager too; kept so the rebuild
  // does not lose the list itself.
  it('lists the system templates alongside the custom ones', async () => {
    open();

    expect(await screen.findByText(/knee mri/i)).toBeInTheDocument();
    expect(screen.getByText(/normal pelvis/i)).toBeInTheDocument();
  });

  it('narrows the list to what was searched for', async () => {
    open();
    await screen.findByText(/knee mri/i);

    fireEvent.change(screen.getByPlaceholderText('Search templates...'), {
      target: { value: 'knee' },
    });

    expect(screen.getByText(/knee mri/i)).toBeInTheDocument();
    expect(screen.queryByText(/normal pelvis/i)).not.toBeInTheDocument();
  });
});
