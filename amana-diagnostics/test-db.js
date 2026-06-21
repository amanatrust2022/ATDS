try {
  const { getDb } = require('./lib/localDb');
  const db = getDb();
  console.log('Database successfully initialized!');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables in database:', tables);
} catch (e) {
  console.error('Database initialization failed:', e);
}
