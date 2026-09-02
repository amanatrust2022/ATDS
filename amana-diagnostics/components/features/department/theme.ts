import type { Department } from '@/lib/store';

/** Lab is teal, radiology is violet. One place decides, so the two agree. */
export interface DepartmentTheme {
  accent: string;
  light: string;
  border: string;
  text: string;
}

export const departmentTheme = (department: Department): DepartmentTheme =>
  department === 'lab'
    ? { accent: 'var(--teal-600)', light: 'var(--teal-50)', border: 'var(--teal-200)', text: 'var(--teal-800)' }
    : { accent: '#7c3aed', light: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6' };
