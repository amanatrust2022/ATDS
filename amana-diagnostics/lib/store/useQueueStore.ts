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

// Helper functions for filtering that can be used across components
export const filterPatientsByDate = (patients: Patient[], filterType: DateFilter) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = today - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = today - (30 * 24 * 60 * 60 * 1000);

  return patients.filter(p => {
    if (!p.registeredAt) return false;
    const pDate = new Date(p.registeredAt).getTime();
    
    if (filterType === 'today') {
      return pDate >= today;
    } else if (filterType === 'seven_days') {
      return pDate >= sevenDaysAgo;
    } else if (filterType === 'thirty_days') {
      return pDate >= thirtyDaysAgo;
    }
    return true;
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
