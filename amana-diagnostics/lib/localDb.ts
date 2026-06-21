import path from 'path';

let dbInstance: any = null;

export function getDb(): any {
  if (typeof window !== 'undefined') {
    throw new Error('DatabaseSync can only be used on the server side.');
  }

  if (!dbInstance) {
    // If not local mode or local hub mode, not in development, and we are on Vercel,
    // throw a warning/error to prevent execution.
    if (
      process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE !== 'true' &&
      process.env.IS_LOCAL_HUB !== 'true' &&
      process.env.NODE_ENV !== 'development'
    ) {
      throw new Error('DatabaseSync is disabled in cloud production mode.');
    }

    // Dynamically load node:sqlite using eval('require') to bypass Turbopack's static analysis
    const { DatabaseSync } = eval('require')('node:sqlite');
    
    let dbPath = '';
    if (process.env.IS_LOCAL_HUB === 'true') {
      const appData = process.env.APPDATA || (process.platform === 'darwin' 
        ? path.join(process.env.HOME || '', 'Library', 'Application Support') 
        : path.join(process.env.HOME || '', '.config'));
      const appFolder = path.join(appData, 'AmanaDiagnostics');
      const fs = require('fs');
      if (!fs.existsSync(appFolder)) {
        fs.mkdirSync(appFolder, { recursive: true });
      }
      dbPath = path.join(appFolder, 'amana_clinic.db');
    } else {
      dbPath = path.join(process.cwd(), 'amana_clinic.db');
    }

    dbInstance = new DatabaseSync(dbPath);
    initDb(dbInstance);
  }
  return dbInstance;
}

function initDb(db: any) {
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. Sync outbox table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL, -- JSON string
      timestamp INTEGER NOT NULL
    );
  `);

  // 2. Sync metadata table (stores last pull timestamp, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // 3. Patients table
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      slip_number TEXT,
      registered_at TEXT,
      first_name TEXT,
      surname TEXT,
      middle_name TEXT,
      age TEXT,
      sex TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      referred_by TEXT,
      referring_facility TEXT,
      referring_doctor_id TEXT,
      referring_facility_id TEXT,
      commission_assigned INTEGER DEFAULT 0,
      commission_type TEXT,
      commission_value REAL,
      commission_amount REAL,
      commission_status TEXT,
      commission_paid_at TEXT,
      commission_paid_notes TEXT,
      organization_id TEXT NOT NULL,
      total_amount REAL DEFAULT 0.0,
      discount_type TEXT DEFAULT 'none',
      discount_value REAL DEFAULT 0.0,
      discount_amount REAL DEFAULT 0.0,
      net_amount REAL DEFAULT 0.0,
      paid_amount REAL DEFAULT 0.0,
      payment_status TEXT DEFAULT 'paid',
      payment_method TEXT DEFAULT 'cash',
      updated_at TEXT
    );
  `);

  // 4. Patient Tests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_tests (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      test_id TEXT NOT NULL,
      test_name TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT NOT NULL,
      specimen TEXT,
      results TEXT, -- JSON string
      completed_by TEXT,
      completed_by_signature_url TEXT,
      completed_by_title TEXT,
      completed_at TEXT,
      notes TEXT,
      organization_id TEXT NOT NULL,
      price REAL DEFAULT 0.0,
      commission_type TEXT DEFAULT 'none',
      commission_value REAL DEFAULT 0.0,
      commission_amount REAL DEFAULT 0.0,
      updated_at TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
  `);

  // 5. Radiology Templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS radiology_templates (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      findings TEXT,
      impression TEXT,
      created_at TEXT,
      created_by TEXT,
      updated_at TEXT
    );
  `);

  // 6. Test Prices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_prices (
      organization_id TEXT NOT NULL,
      test_id TEXT NOT NULL,
      test_name TEXT NOT NULL,
      price REAL DEFAULT 0.0,
      commission_type TEXT DEFAULT 'percentage',
      commission_value REAL DEFAULT 0.0,
      PRIMARY KEY (organization_id, test_id)
    );
  `);

  // 7. Referring Facilities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS referring_facilities (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      commission_type TEXT NOT NULL,
      commission_value REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // 8. Referring Doctors table
  db.exec(`
    CREATE TABLE IF NOT EXISTS referring_doctors (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      facility_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      commission_type TEXT NOT NULL,
      commission_value REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (facility_id) REFERENCES referring_facilities(id) ON DELETE SET NULL
    );
  `);

  // 9. Profiles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      title TEXT,
      first_name TEXT,
      surname TEXT,
      last_name TEXT,
      signature_url TEXT,
      role TEXT NOT NULL,
      organization_id TEXT
    );
  `);

  // 10. Organizations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      plan_tier TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      letterhead_line2 TEXT,
      letterhead_html TEXT
    );
  `);

  // 11. Local Auth table for caching user password hashes locally
  db.exec(`
    CREATE TABLE IF NOT EXISTS local_auth (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      user_id TEXT NOT NULL
    );
  `);

  // 12. Custom Tests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_tests (
      id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      category TEXT NOT NULL,
      specimen TEXT NOT NULL,
      parameters TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      updated_at TEXT,
      PRIMARY KEY (organization_id, id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `);

  // 12. Safe Migrations for existing databases
  try {
    db.exec(`ALTER TABLE test_prices ADD COLUMN commission_type TEXT DEFAULT 'percentage';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE test_prices ADD COLUMN commission_value REAL DEFAULT 0.0;`);
  } catch (e) {}

  try {
    db.exec(`ALTER TABLE patient_tests ADD COLUMN price REAL DEFAULT 0.0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE patient_tests ADD COLUMN commission_type TEXT DEFAULT 'none';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE patient_tests ADD COLUMN commission_value REAL DEFAULT 0.0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE patient_tests ADD COLUMN commission_amount REAL DEFAULT 0.0;`);
  } catch (e) {}

  try {
    db.exec(`ALTER TABLE patients ADD COLUMN total_amount REAL DEFAULT 0.0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE patients ADD COLUMN discount_type TEXT DEFAULT 'none';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE patients ADD COLUMN discount_value REAL DEFAULT 0.0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE patients ADD COLUMN discount_amount REAL DEFAULT 0.0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE patients ADD COLUMN net_amount REAL DEFAULT 0.0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE patients ADD COLUMN paid_amount REAL DEFAULT 0.0;`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE patients ADD COLUMN payment_status TEXT DEFAULT 'paid';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE patients ADD COLUMN payment_method TEXT DEFAULT 'cash';`);
  } catch (e) {}
}

/**
 * Helper to queue write operations in the local outbox.
 */
export function queueSync(db: any, tableName: string, action: 'INSERT' | 'UPDATE' | 'DELETE', recordId: string, payload: any) {
  const insertStmt = db.prepare(`
    INSERT INTO sync_outbox (table_name, action, record_id, payload, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertStmt.run(tableName, action, recordId, JSON.stringify(payload), Date.now());
}
