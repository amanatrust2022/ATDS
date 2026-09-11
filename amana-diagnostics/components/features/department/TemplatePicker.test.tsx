import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import TemplatePicker, { type PickableTemplate } from './TemplatePicker';

/**
 * Characterisation tests for the report template picker.
 *
 * A radiologist types a few letters, picks the matching template and the
 * findings and impression are filled in from it. It is the single most-used
 * control on the reporting screen, and it was built out of clickable divs: the
 * search box took focus, and then there was no way forward without a mouse —
 * no arrow keys, no Enter, no tab stop on any result.
 *
 * Written before the rebuild. See decision #28.
 */

const templates: PickableTemplate[] = [
  { key: 'usg_appendicitis', name: 'Appendicitis', findings: 'F1', impression: 'I1', isSystem: true },
  { key: 'usg_pelvic', name: 'Normal Pelvic Scan', findings: 'F2', impression: 'I2', isSystem: true },
  { key: 'house_style', name: 'House Abdomen', findings: 'F3', impression: 'I3', isSystem: false },
];

const renderPicker = (onSelect = vi.fn(), onManage = vi.fn()) => {
  const utils = render(
    <TemplatePicker templates={templates} onSelect={onSelect} onManageTemplates={onManage} />,
  );
  return { ...utils, onSelect, onManage };
};

const search = () => screen.getByRole('combobox', { name: /template/i });

describe('The report template picker', () => {
  it('names the search box', () => {
    renderPicker();
    expect(search()).toBeInTheDocument();
  });

  it('filters by name and by key', () => {
    renderPicker();

    fireEvent.change(search(), { target: { value: 'appendi' } });
    expect(screen.getByRole('option', { name: /appendicitis/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /pelvic/i })).not.toBeInTheDocument();

    fireEvent.change(search(), { target: { value: 'usg_pelvic' } });
    expect(screen.getByRole('option', { name: /pelvic/i })).toBeInTheDocument();
  });

  /**
   * The whole point of a type-ahead: type, arrow down, Enter. None of it
   * existed — the results were <div onClick> with no tabindex and no key
   * handler, so the keyboard could reach the search box and then nothing.
   */
  it('picks a template with the keyboard alone', () => {
    const { onSelect } = renderPicker();

    fireEvent.change(search(), { target: { value: 'appendi' } });
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    fireEvent.keyDown(search(), { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]![0]!.key).toBe('usg_appendicitis');
  });

  it('picks a template with the mouse', () => {
    const { onSelect } = renderPicker();

    fireEvent.change(search(), { target: { value: 'appendi' } });
    fireEvent.click(screen.getByRole('option', { name: /appendicitis/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape without choosing anything', () => {
    const { onSelect } = renderPicker();

    fireEvent.change(search(), { target: { value: 'appendi' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(search(), { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('says when nothing matches', () => {
    renderPicker();
    fireEvent.change(search(), { target: { value: 'zzzz' } });
    expect(screen.getByText(/no matching templates/i)).toBeInTheDocument();
  });

  it('marks which templates belong to this organisation', () => {
    renderPicker();
    fireEvent.change(search(), { target: { value: 'house' } });
    expect(screen.getByRole('option', { name: /house abdomen/i })).toHaveTextContent(/custom/i);
  });

  it('reaches the template manager as a button', () => {
    const { onManage } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /manage templates/i }));
    expect(onManage).toHaveBeenCalled();
  });
});
