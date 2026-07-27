import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { filterPatientsByDate, filterPatientsBySearchAndDept } from './useQueueStore';
import { Patient } from './index';

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
