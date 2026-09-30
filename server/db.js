// SQLite storage using Node's built-in node:sqlite (Node 22.5+). No external dependencies.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { COLLECTIONS } from './schema.js';
import { SEED_ITEMS, SEED_SETTINGS } from './seed.js';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(import.meta.dirname, '..', 'data'));
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads'); // public images, served at /uploads/
export const CV_DIR = path.join(DATA_DIR, 'cvs');         // private, admin-only downloads
for (const dir of [DATA_DIR, UPLOAD_DIR, CV_DIR]) mkdirSync(dir, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'ntalec.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    collection TEXT NOT NULL,
    data TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS items_collection ON items(collection, sort_order);
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY,
    job_id INTEGER,
    job_title TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    linkedin TEXT NOT NULL DEFAULT '',
    cover_letter TEXT NOT NULL DEFAULT '',
    cv_file TEXT,
    cv_name TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT NOT NULL DEFAULT '',
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------- first-run seed ----------
const itemCount = db.prepare('SELECT COUNT(*) AS n FROM items').get().n;
if (itemCount === 0) {
  const insert = db.prepare('INSERT INTO items (collection, data, sort_order) VALUES (?, ?, ?)');
  for (const [collection, rows] of Object.entries(SEED_ITEMS)) {
    rows.forEach((row, i) => insert.run(collection, JSON.stringify(row), i));
  }
}
const setSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING');
for (const [k, v] of Object.entries(SEED_SETTINGS)) setSetting.run(k, v);

// ---------- helpers ----------
const rowToItem = (r) => ({ id: r.id, ...JSON.parse(r.data), sort_order: r.sort_order, published: !!r.published, updated_at: r.updated_at });

export function listItems(collection, { publishedOnly = false } = {}) {
  if (!COLLECTIONS[collection]) return [];
  const sql = `SELECT * FROM items WHERE collection = ? ${publishedOnly ? 'AND published = 1' : ''} ORDER BY sort_order, id`;
  return db.prepare(sql).all(collection).map(rowToItem);
}

export function getItem(collection, id) {
  const r = db.prepare('SELECT * FROM items WHERE collection = ? AND id = ?').get(collection, id);
  return r ? rowToItem(r) : null;
}

export function createItem(collection, data, published = true) {
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM items WHERE collection = ?').get(collection).m;
  const { lastInsertRowid } = db.prepare('INSERT INTO items (collection, data, sort_order, published) VALUES (?, ?, ?, ?)')
    .run(collection, JSON.stringify(data), max + 1, published ? 1 : 0);
  return getItem(collection, Number(lastInsertRowid));
}

export function updateItem(collection, id, data, published) {
  db.prepare(`UPDATE items SET data = ?, published = ?, updated_at = datetime('now') WHERE collection = ? AND id = ?`)
    .run(JSON.stringify(data), published ? 1 : 0, collection, id);
  return getItem(collection, id);
}

export function deleteItem(collection, id) {
  return db.prepare('DELETE FROM items WHERE collection = ? AND id = ?').run(collection, id).changes > 0;
}

export function reorderItems(collection, ids) {
  const stmt = db.prepare('UPDATE items SET sort_order = ? WHERE collection = ? AND id = ?');
  db.exec('BEGIN');
  try {
    ids.forEach((id, i) => stmt.run(i, collection, id));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getSettings() {
  return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
}

export function saveSettings(values) {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(values)) stmt.run(k, v);
}
