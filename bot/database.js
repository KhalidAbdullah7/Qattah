const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { DB_PATH } = require('./config');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id     TEXT NOT NULL,
    group_title  TEXT,
    restaurant   TEXT NOT NULL,
    delivery_app TEXT,
    restaurant_url TEXT,
    status       TEXT DEFAULT 'collecting',
    created_at   TEXT DEFAULT (datetime('now')),
    closed_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    category   TEXT,
    name       TEXT NOT NULL,
    price      REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id    TEXT NOT NULL,
    username   TEXT,
    first_name TEXT,
    items      TEXT NOT NULL,
    total      REAL NOT NULL,
    confirmed  INTEGER DEFAULT 0,
    dm_sent    INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(session_id, user_id)
  );
`);

const _getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const _setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

const _createSession = db.prepare(`
  INSERT INTO sessions (group_id, group_title, restaurant, delivery_app, restaurant_url)
  VALUES (:group_id, :group_title, :restaurant, :delivery_app, :restaurant_url)
`);

const _getActiveSession = db.prepare(`
  SELECT * FROM sessions WHERE group_id = ? AND status = 'collecting' ORDER BY id DESC LIMIT 1
`);

const _getSession = db.prepare('SELECT * FROM sessions WHERE id = ?');
const _closeSession = db.prepare(`UPDATE sessions SET status = 'closed', closed_at = datetime('now') WHERE id = ?`);
const _insertMenuItem = db.prepare(`INSERT INTO menu_items (session_id, category, name, price) VALUES (:session_id, :category, :name, :price)`);
const _getMenuItems = db.prepare('SELECT * FROM menu_items WHERE session_id = ?');

const _upsertOrder = db.prepare(`
  INSERT INTO orders (session_id, user_id, username, first_name, items, total, confirmed)
  VALUES (:session_id, :user_id, :username, :first_name, :items, :total, :confirmed)
  ON CONFLICT(session_id, user_id) DO UPDATE SET
    items = excluded.items, total = excluded.total,
    confirmed = excluded.confirmed, created_at = datetime('now')
`);

const _getOrder = db.prepare('SELECT * FROM orders WHERE session_id = ? AND user_id = ?');
const _getSessionOrders = db.prepare('SELECT * FROM orders WHERE session_id = ? ORDER BY created_at');
const _markDmSent = db.prepare('UPDATE orders SET dm_sent = 1 WHERE id = ?');
const _getLatestMenuForRestaurant = db.prepare(`
  SELECT m.category, m.name, m.price
  FROM menu_items m
  INNER JOIN sessions s ON s.id = m.session_id
  WHERE s.delivery_app = ?
    AND LOWER(TRIM(s.restaurant)) = LOWER(TRIM(?))
  ORDER BY s.id DESC, m.id ASC
`);

const _getSessions = db.prepare(`
  SELECT s.*, COUNT(o.id) as order_count, COALESCE(SUM(o.total), 0) as grand_total
  FROM sessions s
  LEFT JOIN orders o ON o.session_id = s.id
  GROUP BY s.id
  ORDER BY s.id DESC
  LIMIT 50
`);

module.exports = {
  db,
  getSetting: (key) => _getSetting.get(key)?.value,
  setSetting: (key, value) => _setSetting.run(key, String(value)),
  createSession: (data) => _createSession.run(data),
  getActiveSession: (groupId) => _getActiveSession.get(groupId),
  getSession: (id) => _getSession.get(id),
  closeSession: (id) => _closeSession.run(id),
  insertMenuItems: (items) => {
    for (const item of items) _insertMenuItem.run(item);
  },
  getMenuItems: (sessionId) => _getMenuItems.all(sessionId),
  upsertOrder: (data) => _upsertOrder.run(data),
  getOrder: (sessionId, userId) => _getOrder.get(sessionId, userId),
  getSessionOrders: (sessionId) => _getSessionOrders.all(sessionId),
  markDmSent: (orderId) => _markDmSent.run(orderId),
  getLatestMenuForRestaurant: (deliveryApp, restaurant) =>
    _getLatestMenuForRestaurant.all(deliveryApp, restaurant),
  getSessions: () => _getSessions.all(),
};
