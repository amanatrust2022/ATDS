import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import ParameterTable, { type EditableResult } from './ParameterTable';

/**
 * Characterisation tests for the parameter/result grid.
 *
 * The grid was already careful — an sr-only caption, column headers with
 * scope, a labelled input per row, a flag carrying its letter and its word.
 * The tests below hold all of that still while the raw <table> becomes the
 * system's Table, which is the last thing the ratchet counts on this screen.
 * Only the first is a finding.
 */

const row = (over: Partial<EditableResult> = {}): EditableResult => ({
  parameter: 'Haemoglobin', result: '', unit: 'g/dL', range: '13-17', flag: '', ...over,
});

const show = (results: EditableResult[]) =>
  render(<ParameterTable results={results} onUpdate={vi.fn()} sex="male" />);

describe('Parameter grid', () => {
  it('keeps the parameter name as the row header', () => {
    show([row()]);

    const header = screen.getByRole('rowheader', { name: /haemoglobin/i });
    expect(header).toBeInTheDocument();
  });

  // Behaviour guards. All of these held before the rebuild.
  it('names the grid for a screen reader', () => {
    show([row()]);

    expect(screen.getByRole('table', { name: /test parameters/i })).toBeInTheDocument();
  });

  it('names each result box after its parameter', () => {
    show([row(), row({ parameter: 'Platelets', unit: '10^9/L', range: '150-400' })]);

    expect(screen.getByRole('textbox', { name: /haemoglobin result/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /platelets result/i })).toBeInTheDocument();
  });

  it('derives the flag from the reference range rather than waiting to be told', () => {
    show([row({ result: '9' })]);

    // The flag says "Low" twice on purpose — once for the eye, once for a
    // reader — and the override list offers "L — low" as well.
    const line = screen.getByRole('row', { name: /haemoglobin/i });
    expect(within(line).getAllByText('Low').length).toBeGreaterThan(0);
  });

  it('offers the override as a named control', () => {
    show([row()]);

    expect(
      screen.getByRole('combobox', { name: /override the flag for haemoglobin/i }),
    ).toBeInTheDocument();
  });

  it('shows the unit and the range beside the result', () => {
    show([row()]);

    const line = screen.getByRole('row', { name: /haemoglobin/i });
    expect(within(line).getByText('g/dL')).toBeInTheDocument();
    expect(within(line).getByText('13-17')).toBeInTheDocument();
  });
});

describe('Qualitative entry grids', () => {
  it('shows serology as Investigation and Result only', () => {
    render(
      <ParameterTable
        testId="hbsag"
        testName="HBsAg"
        results={[row({ parameter: 'HBsAg', unit: '', range: '' })]}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Investigation' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Result' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Unit' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: /Reference range/i })).toBeNull();
  });

  it('offers graded positive and negative urinalysis results', () => {
    render(
      <ParameterTable
        testId="urinalysis"
        testName="Urinalysis"
        results={[row({ parameter: 'Protein', unit: '', range: '' })]}
        onUpdate={vi.fn()}
      />,
    );

    const result = screen.getByRole('combobox', { name: 'Protein result' });
    expect(within(result).getByRole('option', { name: 'Negative' })).toBeInTheDocument();
    expect(within(result).getByRole('option', { name: 'Positive (++++)' })).toBeInTheDocument();
  });

  it('offers the standard RVS wording without preventing a custom result', () => {
    render(
      <ParameterTable
        testId="rvs"
        testName="RVS"
        results={[row({ parameter: 'RVS', unit: '', range: '' })]}
        onUpdate={vi.fn()}
      />,
    );

    const input = screen.getByRole('combobox', { name: 'RVS result' });
    expect(input).toHaveAttribute('list');
    expect(document.querySelector('option[value="Sero positive to determine 1/2"]')).toBeInTheDocument();
    expect(document.querySelector('option[value="Sero negative to determine 1/2"]')).toBeInTheDocument();
  });
});
