import path from 'path';

let dbInstance: any = null;


/**
 * Adds a column if the table has not got one already.
 *
 * These used to be `try { ALTER TABLE ... } catch (e) {}` — around twenty-five of
 * them, run on every single start-up. That is one way to express "the column may
 * already exist", but it says the same thing about a locked file, a full disk
 * and a typo in the DDL: nothing. The app then carried on against a schema it
 * believed was correct.
 *
 * Asking what columns exist first means "already there" is a fact rather than an
 * exception, so anything that still fails is a real failure and gets said out
 * loud.
 */
function addColumn(db: any, table: string, column: string, definition: string): void {
  let existing: any[];
  try {
    existing = db.prepare(`PRAGMA table_info(${table})`).all();
  } catch (err) {
    console.error(`[db] cannot inspect ${table}; skipping column ${column}:`, err);
    return;
  }

  if (!existing.length) return;                       // table not created yet
  if (existing.some((c: any) => c.name === column)) return;  // nothing to do

  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition};`);
    console.log(`[db] added ${table}.${column}`);
  } catch (err) {
    // Loud on purpose. Silently continuing here is how a machine ends up
    // running against a schema nobody knows is wrong.
    console.error(`[db] FAILED to add ${table}.${column} — the database is not in the shape the app expects:`, err);
    throw err;
  }
}

/** Bumped when the expected schema changes, so a machine can say where it is. */
export const EXPECTED_SCHEMA_VERSION = 1;

/** Records which schema this database has been brought up to. */
function recordSchemaVersion(db: any): void {
  try {
    db.prepare(`INSERT INTO sync_metadata (key, value) VALUES ('schema_version', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .run(String(EXPECTED_SCHEMA_VERSION));
  } catch (err) {
    console.warn('[db] could not record the schema version:', err);
  }
}

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
      timestamp INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt_at INTEGER,
      dead INTEGER NOT NULL DEFAULT 0 -- set aside after MAX_ATTEMPTS; never deleted unsent
    );
  `);

  // 2. Sync metadata table (stores last pull timestamp, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // 3. Patient Profiles table (Permanent patient records)
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_profiles (
      id INTEGER PRIMARY KEY,
      organization_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      surname TEXT NOT NULL,
      middle_name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      sex TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 4. Patients table (Visits/Encounters)
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY,
      patient_profile_id INTEGER,
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
      billing_account_id TEXT,
      updated_at TEXT,
      FOREIGN KEY (patient_profile_id) REFERENCES patient_profiles(id) ON DELETE SET NULL
    );
  `);

  // 5. Patient Tests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_tests (
      id TEXT PRIMARY KEY,
      patient_id INTEGER,
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
      organization_id TEXT,
      email TEXT
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
    addColumn(db, 'test_prices', 'commission_type', `commission_type TEXT DEFAULT 'percentage'`);
    addColumn(db, 'test_prices', 'commission_value', `commission_value REAL DEFAULT 0.0`);

    addColumn(db, 'patient_tests', 'price', `price REAL DEFAULT 0.0`);
    addColumn(db, 'patient_tests', 'commission_type', `commission_type TEXT DEFAULT 'none'`);
    addColumn(db, 'patient_tests', 'commission_value', `commission_value REAL DEFAULT 0.0`);
    addColumn(db, 'patient_tests', 'commission_amount', `commission_amount REAL DEFAULT 0.0`);

    addColumn(db, 'patients', 'total_amount', `total_amount REAL DEFAULT 0.0`);
    addColumn(db, 'patients', 'discount_type', `discount_type TEXT DEFAULT 'none'`);
    addColumn(db, 'patients', 'discount_value', `discount_value REAL DEFAULT 0.0`);
    addColumn(db, 'patients', 'discount_amount', `discount_amount REAL DEFAULT 0.0`);
    addColumn(db, 'patients', 'net_amount', `net_amount REAL DEFAULT 0.0`);
    addColumn(db, 'patients', 'paid_amount', `paid_amount REAL DEFAULT 0.0`);
    addColumn(db, 'patients', 'payment_status', `payment_status TEXT DEFAULT 'paid'`);
    addColumn(db, 'patients', 'payment_method', `payment_method TEXT DEFAULT 'cash'`);

  // 13. Billing and Wallets Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS billing_accounts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      owner_patient_id TEXT NOT NULL,
      balance REAL DEFAULT 0.0,
      credit_limit REAL DEFAULT 0.0,
      type TEXT NOT NULL, -- 'individual' | 'family' | 'corporate'
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS billing_ledger_transactions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      billing_account_id TEXT NOT NULL,
      patient_id TEXT, -- nullable
      type TEXT NOT NULL, -- 'deposit' | 'charge' | 'refund' | 'adjustment'
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      reference_id TEXT,
      payment_method TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (billing_account_id) REFERENCES billing_accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS external_department_charges (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      billing_account_id TEXT, -- nullable
      department TEXT NOT NULL,
      receipt_number TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT DEFAULT 'paid',
      description TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (billing_account_id) REFERENCES billing_accounts(id) ON DELETE SET NULL
    );
  `);

    addColumn(db, 'patients', 'billing_account_id', `billing_account_id TEXT`);

    addColumn(db, 'patients', 'patient_profile_id', `patient_profile_id INTEGER`);

    addColumn(db, 'profiles', 'email', `email TEXT`);

  // Outbox retry bookkeeping. A row that the cloud will not accept is counted
  // and eventually set aside (dead = 1) instead of blocking every change behind
  // it — see lib/sync/outbox.ts.
    addColumn(db, 'sync_outbox', 'attempts', `attempts INTEGER NOT NULL DEFAULT 0`);
    addColumn(db, 'sync_outbox', 'last_error', `last_error TEXT`);
    addColumn(db, 'sync_outbox', 'last_attempt_at', `last_attempt_at INTEGER`);
    addColumn(db, 'sync_outbox', 'dead', `dead INTEGER NOT NULL DEFAULT 0`);

  // Indexes. There were none at all: every lookup by clinic, every lookup of a
  // patient's tests, and every ordering by registration date was a full scan.
  // They cover exactly the columns the queries above filter and sort on.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_patients_org_registered ON patients (organization_id, registered_at DESC);
    CREATE INDEX IF NOT EXISTS idx_patients_org_billing ON patients (organization_id, billing_account_id);
    CREATE INDEX IF NOT EXISTS idx_patients_profile ON patients (patient_profile_id);
    CREATE INDEX IF NOT EXISTS idx_patient_tests_patient ON patient_tests (patient_id);
    CREATE INDEX IF NOT EXISTS idx_patient_tests_org_dept ON patient_tests (organization_id, department, status);
    CREATE INDEX IF NOT EXISTS idx_patient_profiles_org ON patient_profiles (organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ledger_account ON billing_ledger_transactions (billing_account_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ledger_org ON billing_ledger_transactions (organization_id);
    CREATE INDEX IF NOT EXISTS idx_billing_accounts_org ON billing_accounts (organization_id);
    CREATE INDEX IF NOT EXISTS idx_charges_org ON external_department_charges (organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_charges_account ON external_department_charges (billing_account_id);
    CREATE INDEX IF NOT EXISTS idx_outbox_live ON sync_outbox (dead, id);
  `);

  // Two desks counting today's registrations at the same moment both arrive at
  // the same next slip number (D-06). The API settles the number under the
  // write lock; this is the guarantee behind it.
  //
  // Deliberately separate from the block above: if a database already holds
  // duplicate slip numbers this will fail, and it must not take the other
  // indexes down with it. The warning is the signal to go and settle them.
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_org_slip ON patients (organization_id, slip_number) WHERE slip_number IS NOT NULL;`);
  } catch (e: any) {
    console.warn(
      '[localDb] Could not make slip numbers unique — this database already has duplicates. ' +
      'Find them with: SELECT organization_id, slip_number, COUNT(*) FROM patients ' +
      'WHERE slip_number IS NOT NULL GROUP BY 1,2 HAVING COUNT(*) > 1;',
      e?.message,
    );
  }

  // Reached only if every step above succeeded, so this says what shape the
  // database is actually in rather than what shape it was asked to be in.
  recordSchemaVersion(db);
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

/**
 * Runs `fn` inside a SQLite transaction, rolling back if it throws.
 *
 * BEGIN IMMEDIATE takes the write lock straight away, so two concurrent
 * wallet charges serialise instead of both reading the same balance — the
 * SQLite counterpart of SELECT ... FOR UPDATE on Postgres.
 *
 * `fn` must not return early past the COMMIT; throw instead.
 */
export function inTransaction<T>(db: any, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // A rollback failure must not mask the error that caused it.
    }
    throw err;
  }
}

/** An error carrying the HTTP status an API route should answer with. */
export class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'HttpError';
  }
}
