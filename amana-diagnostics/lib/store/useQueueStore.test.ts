import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { filterPatientsByDate, filterPatientsBySearchAndDept, selectPendingPatients, selectCompletedPatients } from './useQueueStore';
import { Patient } from '@/lib/store';

describe('useQueueStore filters', () => {
  beforeEach(() => {
    // Mock system time to a fixed date so date filters are predictable
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 12, 0, 0)); // July 27, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockPatients: any[] = [
    {
      id: 1,
      name: 'John Doe',
      slipNumber: 'SLIP-001',
      registeredAt: new Date(2026, 6, 27, 10, 0, 0).toISOString(), // Today
      tests: [{ department: 'lab' }]
    },
    {
      id: 2,
      name: 'Jane Smith',
      slipNumber: 'SLIP-002',
      registeredAt: new Date(2026, 6, 22, 10, 0, 0).toISOString(), // 5 days ago (in 7 days)
      tests: [{ department: 'radiology' }]
    },
    {
      id: 3,
      name: 'Alice Johnson',
      slipNumber: 'SLIP-003',
      registeredAt: new Date(2026, 6, 10, 10, 0, 0).toISOString(), // 17 days ago (in 30 days)
      tests: [{ department: 'lab' }, { department: 'radiology' }]
    },
    {
      id: 4,
      name: 'Bob Brown',
      slipNumber: 'SLIP-004',
      registeredAt: new Date(2026, 5, 1, 10, 0, 0).toISOString(), // Over 30 days ago
      tests: []
    }
  ];

  describe('filterPatientsByDate', () => {
    it('should correctly filter today', () => {
      const result = filterPatientsByDate(mockPatients, 'today');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
    });

    it('should correctly filter last 7 days', () => {
      const result = filterPatientsByDate(mockPatients, 'seven_days');
      expect(result.length).toBe(2);
      expect(result.map(p => p.id).sort()).toEqual([1, 2]);
    });

    it('should correctly filter last 30 days', () => {
      const result = filterPatientsByDate(mockPatients, 'thirty_days');
      expect(result.length).toBe(3);
      expect(result.map(p => p.id).sort()).toEqual([1, 2, 3]);
    });
  });

  describe('filterPatientsBySearchAndDept', () => {
    it('should return all on empty search and all dept', () => {
      const result = filterPatientsBySearchAndDept(mockPatients, '', 'all');
      expect(result.length).toBe(4);
    });

    it('should filter by name (case insensitive)', () => {
      const result = filterPatientsBySearchAndDept(mockPatients, 'jane', 'all');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(2);
    });

    it('should filter by slip number', () => {
      const result = filterPatientsBySearchAndDept(mockPatients, 'slip-003', 'all');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(3);
    });

    it('should filter by lab department', () => {
      const result = filterPatientsBySearchAndDept(mockPatients, '', 'lab');
      // John (1) and Alice (3) have lab tests
      expect(result.length).toBe(2);
      expect(result.map(p => p.id).sort()).toEqual([1, 3]);
    });

    it('should filter by radiology department', () => {
      const result = filterPatientsBySearchAndDept(mockPatients, '', 'radiology');
      // Jane (2) and Alice (3) have radiology tests
      expect(result.length).toBe(2);
      expect(result.map(p => p.id).sort()).toEqual([2, 3]);
    });

    it('should filter by search query AND department', () => {
      const result = filterPatientsBySearchAndDept(mockPatients, 'john', 'radiology');
      // John Doe (1) has 'john' but no radiology. Alice Johnson (3) has 'john' and radiology.
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(3);
    });
  });
});

describe('Tab badge counts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 12, 0, 0)); // July 27, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const patient = (id: number, daysAgo: number, statuses: string[]): Patient => ({
    id,
    name: `Patient ${id}`,
    slipNumber: `SLIP-${id}`,
    registeredAt: new Date(2026, 6, 27 - daysAgo, 10, 0, 0).toISOString(),
    tests: statuses.map((status, i) => ({ testId: `t${i}`, testName: `Test ${i}`, department: 'lab', status })),
  }) as unknown as Patient;

  const today = patient(1, 0, ['pending']);
  const tenDaysAgo = patient(2, 10, ['in_progress']);
  const doneToday = patient(3, 0, ['completed']);
  const doneTenDaysAgo = patient(4, 10, ['completed']);

  const all = [today, tenDaysAgo, doneToday, doneTenDaysAgo];

  // Regression: ReceptionPage held its own dateFilter state whose setter was never
  // called, so the badges stayed pinned to 'today' while the lists widened.
  it('counts only today when the window is today', () => {
    expect(selectPendingPatients(all, 'today').map(p => p.id)).toEqual([1]);
    expect(selectCompletedPatients(all, 'today').map(p => p.id)).toEqual([3]);
  });

  it('widens the pending count when the user widens the date window', () => {
    expect(selectPendingPatients(all, 'thirty_days').map(p => p.id).sort()).toEqual([1, 2]);
  });

  it('widens the completed count when the user widens the date window', () => {
    expect(selectCompletedPatients(all, 'thirty_days').map(p => p.id).sort()).toEqual([3, 4]);
  });

  it('counts a partly finished patient as both outstanding and having results', () => {
    const partly = patient(5, 0, ['completed', 'pending']);
    expect(selectPendingPatients([partly], 'today').map(p => p.id)).toEqual([5]);
    expect(selectCompletedPatients([partly], 'today').map(p => p.id)).toEqual([5]);
  });

  it('leaves a fully completed patient out of the outstanding count', () => {
    expect(selectPendingPatients([doneToday], 'today')).toEqual([]);
  });
});
