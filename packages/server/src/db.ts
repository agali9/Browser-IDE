import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data/ide.db');

// sql.js wraps a synchronous SQLite API identical to better-sqlite3
// but compiles to WASM — no native build needed on Windows.
let _db: SqlJsDatabase;

// Thin compatibility shim so the rest of the code stays unchanged.
// Exposes .prepare(sql).run(...) / .get(...) / .all(...) and .exec(sql)
export const db = new Proxy({} as any, {
  get(_target, prop) {
    if (prop === 'prepare') {
      return (sql: string) => ({
        run: (...params: any[]) => { _db.run(sql, params); persist(); },
        get: (...params: any[]) => {
          const stmt = _db.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all: (...params: any[]) => {
          const stmt = _db.prepare(sql);
          stmt.bind(params);
          const rows: any[] = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
      });
    }
    if (prop === 'exec') {
      return (sql: string) => { _db.run(sql); persist(); };
    }
  },
});

function persist() {
  const data = _db.export();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      name TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'typescript',
      content TEXT NOT NULL DEFAULT '',
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      joined_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);
  persist();
  console.log('[db] initialized');
}
