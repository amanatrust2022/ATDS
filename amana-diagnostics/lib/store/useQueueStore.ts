import { create } from 'zustand';
import { Patient } from '@/lib/store';
import { patientDisplayName } from '@/lib/store/patientName';

export type DateFilter = 'today' | 'seven_days' | 'thirty_days';
export type DeptFilter = 'all' | 'lab' | 'radiology';

interface QueueState {
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  deptFilter: DeptFilter;
  setDeptFilter: (filter: DeptFilter) => void;

  dateFilter: DateFilter;
  setDateFilter: (filter: DateFilter) => void;

  slipModalPatientId: number | null;
  setSlipModalPatientId: (id: number | null) => void;

  resultModalPatientId: number | null;
  setResultModalPatientId: (id: number | null) => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  deptFilter: 'all',
  setDeptFilter: (filter) => set({ deptFilter: filter }),

  dateFilter: 'today',
  setDateFilter: (filter) => set({ dateFilter: filter }),

  slipModalPatientId: null,
  setSlipModalPatientId: (id) => set({ slipModalPatientId: id }),

  resultModalPatientId: null,
  setResultModalPatientId: (id) => set({ resultModalPatientId: id }),
}));

/**
 * The moment a date window begins.
 *
 * This is what the database is now asked to filter on, and it is also what the
 * in-browser filter below uses — deliberately the same function, so the two can
 * never drift into disagreeing about what "the last 7 days" means.
 */
export const windowStartFor = (filterType: DateFilter, now: Date = new Date()): Date => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = filterType === 'today' ? 0 : filterType === 'seven_days' ? 7 : 30;
  return new Date(startOfToday.getTime() - days * 24 * 60 * 60 * 1000);
};

/** The same boundary as an ISO string, for handing to a query. */
export const windowStartIso = (filterType: DateFilter, now?: Date): string =>
  windowStartFor(filterType, now).toISOString();

/**
 * Kept as a second line of defence and for the badge counts. The rows have
 * already been bounded by the query; this catches anything that arrives from a
 * realtime update outside the current window.
 */
export const filterPatientsByDate = (patients: Patient[], filterType: DateFilter) => {
  const start = windowStartFor(filterType).getTime();
  return patients.filter(p => {
    if (!p.registeredAt) return false;
    return new Date(p.registeredAt).getTime() >= start;
  });
};

/**
 * Patients counted on the "Patient Queue" tab badge: anyone with work outstanding,
 * within the currently selected date window.
 */
export const selectPendingPatients = (patients: Patient[], dateFilter: DateFilter) =>
  filterPatientsByDate(patients.filter(p => p.tests.some(t => t.status !== 'completed')), dateFilter);

/**
 * Patients counted on the "Results Ready" tab badge and the header notification count:
 * anyone with at least one completed test, within the currently selected date window.
 */
export const selectCompletedPatients = (patients: Patient[], dateFilter: DateFilter) =>
  filterPatientsByDate(patients.filter(p => p.tests.some(t => t.status === 'completed')), dateFilter);

export const filterPatientsBySearchAndDept = (
  patients: Patient[],
  searchQuery: string,
  deptFilter: DeptFilter
) => {
  return patients.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchSearch = q === '' || (
      (patientDisplayName(p).toLowerCase().includes(q)) || 
      (p.slipNumber?.toLowerCase().includes(q))
    );

    const matchDept = deptFilter === 'all' || p.tests.some(t => t.department === deptFilter);

    return matchSearch && matchDept;
  });
};
