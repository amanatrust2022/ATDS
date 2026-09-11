import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TestSelection from './TestSelection';
import type { Test } from '@/lib/store';
import type { SelectedTestDetail } from '@/lib/store/registrationBilling';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';

const catalogue: Test[] = [
  { id: 'fbc', name: 'Full Blood Count', department: 'lab', category: 'Hematology', specimen: 'Whole Blood', parameters: [] },
  { id: 'us_pelvic', name: 'Pelvic Scan', department: 'radiology', category: 'Ultrasound', specimen: 'Scan', parameters: [] },
];

const details: SelectedTestDetail[] = [
  { testId: 'fbc', testName: 'Full Blood Count', department: 'lab', specimen: 'Whole Blood', price: 1500, commissionType: 'flat', commissionValue: 0 },
  { testId: 'us_pelvic', testName: 'Pelvic Scan', department: 'radiology', specimen: 'Scan', price: 5000, commissionType: 'flat', commissionValue: 0 },
];

const withSelected = (ids: string[]) => useRegistrationStore.setState({ selectedTests: ids });

beforeEach(() => {
  useRegistrationStore.getState().resetForm();
});

describe('Selected-tests panel', () => {
  /**
   * The one that failed on the old panel. A test's department — lab or
   * radiology — was carried only by the colour of its card border (teal versus
   * a hard-coded violet). Invisible to a colour-blind technologist, lost on a
   * monochrome printout, and silent to a screen reader.
   */
  it('says each test department in words, not by colour alone', () => {
    withSelected(['fbc', 'us_pelvic']);
    render(<TestSelection catalogue={catalogue} selectedTestDetails={details} />);

    expect(screen.getByText(/^lab$/i)).toBeInTheDocument();
    expect(screen.getByText(/radiology/i)).toBeInTheDocument();
  });

  // The rest passed on the old panel too — it already listed the tests, priced
  // them, named its remove buttons and had an empty state. Kept as behaviour
  // guards through the rebuild, not as defect findings.
  it('lists each selected test with its price', () => {
    withSelected(['fbc', 'us_pelvic']);
    render(<TestSelection catalogue={catalogue} selectedTestDetails={details} />);

    expect(screen.getByText('Full Blood Count')).toBeInTheDocument();
    expect(screen.getByText(/1,500/)).toBeInTheDocument();
    expect(screen.getByText('Pelvic Scan')).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it('removes a single test by its named button', () => {
    withSelected(['fbc', 'us_pelvic']);
    render(<TestSelection catalogue={catalogue} selectedTestDetails={details} />);

    fireEvent.click(screen.getByRole('button', { name: /remove full blood count/i }));

    expect(useRegistrationStore.getState().selectedTests).toEqual(['us_pelvic']);
  });

  it('clears every test at once', () => {
    withSelected(['fbc', 'us_pelvic']);
    render(<TestSelection catalogue={catalogue} selectedTestDetails={details} />);

    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));

    expect(useRegistrationStore.getState().selectedTests).toEqual([]);
  });

  it('shows an empty state when nothing is selected', () => {
    withSelected([]);
    render(<TestSelection catalogue={catalogue} selectedTestDetails={details} />);

    expect(screen.getByText(/no tests selected/i)).toBeInTheDocument();
  });
});
