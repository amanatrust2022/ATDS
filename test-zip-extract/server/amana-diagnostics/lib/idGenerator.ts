/**
 * Helper to calculate the next sequential numeric ID for a table given a worker node ID (defaults to Node 1).
 * Range per node is 10,000,000 values, strictly keeping the ID within 8 digits (10,000,000 to 99,999,999).
 */
export function getNextNumericID(db: any, tableName: string, nodeId: number = 1): number {
  const minRange = nodeId * 10000000;
  const maxRange = minRange + 9999999;
  
  const stmt = db.prepare(`
    SELECT MAX(id) as maxId FROM ${tableName}
    WHERE id >= ? AND id <= ?
  `);
  const row = stmt.get(minRange, maxRange) as { maxId: number | null };
  
  return row.maxId ? row.maxId + 1 : minRange + 1;
}
