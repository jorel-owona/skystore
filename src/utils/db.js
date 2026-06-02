// Database helper — wraps Electron IPC for SQLite queries
// Falls back gracefully when not running in Electron (dev mode)

const query = async (sql, params = []) => {
  if (window.api?.dbQuery) {
    try {
      return await window.api.dbQuery(sql, params);
    } catch (err) {
      console.error('[DB Error]', err, '\nSQL:', sql, '\nParams:', params);
      throw err;
    }
  }
  // Dev mode fallback
  console.warn('[DB] Not running in Electron, query skipped:', sql.substring(0, 60));
  if (sql.trim().toUpperCase().startsWith('SELECT')) return [];
  return { id: Date.now(), changes: 1 };
};

export default query;
