process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE = 'true';
process.env.NODE_ENV = 'development';

import { getDb } from './lib/localDb';

try {
  const db = getDb();
  console.log('Database successfully initialized!');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables in database:', tables);
} catch (e) {
  console.error('Database initialization failed:', e);
}
