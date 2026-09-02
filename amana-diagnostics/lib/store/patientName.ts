import type { Patient } from '@/lib/store';

/**
 * The name to show for a patient.
 *
 * `patients.name` is a real column, but only `update()` ever wrote it, so rows
 * created before that was fixed have it empty. Fall back to the parts, which
 * are always present.
 */
export const patientDisplayName = (p: Pick<Patient, 'name' | 'firstName' | 'middleName' | 'surname'>) =>
  p.name || [p.firstName, p.middleName, p.surname].filter(Boolean).join(' ');
