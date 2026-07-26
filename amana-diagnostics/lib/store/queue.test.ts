import { describe, it, expect } from 'vitest';
import { filterPatientsByDate, filterPatientsBySearchAndDept } from './useQueueStore';
import { Patient } from '@/lib/store';

describe('Queue Store Filters', () => {
  const now = new Date();
  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).toISOString();
  const sixDaysAgoStr = new Date(now.getTime() - (6 * 24 * 60 * 60 * 1000)).toISOString();
  const twentyDaysAgoStr = new Date(now.getTime() - (20 * 24 * 60 * 60 * 1000)).toISOString();
  
  const mockPatients: Partial<Patient>[] = [
    { id: 1, name: 'John Doe', slipNumber: 'SLIP-001', registeredAt: todayStr, tests: [{ department: 'lab', status: 'pending' } as any] },
    { id: 2, name: 'Jane Smith', slipNumber: 'SLIP-002', registeredAt: sixDaysAgoStr, tests: [{ department: 'radiology', status: 'completed' } as any] },
    { id: 3, name: 'Old Patient', slipNumber: 'SLIP-003', registeredAt: twentyDaysAgoStr, tests: [{ department: 'lab', status: 'pending' } as any] },
  ];

  it('filters by date correctly', () => {
    const todayPatients = filterPatientsByDate(mockPatients as Patient[], 'today');
    expect(todayPatients.length).toBe(1);
    expect(todayPatients[0].name).toBe('John Doe');

    const sevenDaysPatients = filterPatientsByDate(mockPatients as Patient[], 'seven_days');
    expect(sevenDaysPatients.length).toBe(2);

    const thirtyDaysPatients = filterPatientsByDate(mockPatients as Patient[], 'thirty_days');
    expect(thirtyDaysPatients.length).toBe(3);
  });

  it('filters by search query correctly', () => {
    const res1 = filterPatientsBySearchAndDept(mockPatients as Patient[], 'jane', 'all');
    expect(res1.length).toBe(1);
    expect(res1[0].name).toBe('Jane Smith');

    const res2 = filterPatientsBySearchAndDept(mockPatients as Patient[], 'SLIP-003', 'all');
    expect(res2.length).toBe(1);
    expect(res2[0].name).toBe('Old Patient');
  });

  it('filters by department correctly', () => {
    const labPatients = filterPatientsBySearchAndDept(mockPatients as Patient[], '', 'lab');
    expect(labPatients.length).toBe(2);
    
    const radPatients = filterPatientsBySearchAndDept(mockPatients as Patient[], '', 'radiology');
    expect(radPatients.length).toBe(1);
    expect(radPatients[0].name).toBe('Jane Smith');
  });
});
