// Banco de dados SQLite — arquivo único, zero configuração.
//
// Driver primário: better-sqlite3 (rápido, prebuilt para macOS/Windows/Linux).
// Fallback automático: módulo nativo do Node "node:sqlite" (Node >= 22.5),
// usado caso o better-sqlite3 não esteja instalado/compilado. Assim o app roda
// mesmo sem dependências nativas. A interface é normalizada para ser idêntica.
const path = require('path');
const fs = require('fs');

// Em produção (ex.: Render com disco persistente), defina MBV_DATA_DIR=/var/data
const DATA_DIR = process.env.MBV_DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'mbv.db');

let db;
try {
  // ---- Driver primário ----
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
  try { db.pragma('journal_mode = WAL'); } catch (_) {}
  try { db.pragma('foreign_keys = ON'); } catch (_) {}
  db.__driver = 'better-sqlite3';
} catch (primaryErr) {
  // ---- Fallback: node:sqlite (banco embutido no Node) ----
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (builtinErr) {
    console.error('\n[MBV] Nenhum driver de banco de dados pôde ser carregado.');
    console.error('  • Node 22.5 a 23.3:  rode  "npm run start:builtin"');
    console.error('  • Node 24+:          rode  "npm start" (banco nativo já incluso)');
    console.error('  • Alternativa:       instale o compilador com  "xcode-select --install"  e rode  "npm install"  novamente\n');
    throw builtinErr;
  }
  const raw = new DatabaseSync(DB_PATH);
  try { raw.exec('PRAGMA journal_mode = WAL'); } catch (_) {}
  try { raw.exec('PRAGMA foreign_keys = ON'); } catch (_) {}

  db = {
    __driver: 'node:sqlite',
    exec: (sql) => raw.exec(sql),
    pragma: (p) => raw.exec('PRAGMA ' + p),
    prepare: (sql) => {
      const stmt = raw.prepare(sql);
      return {
        get: (...args) => stmt.get(...args),
        all: (...args) => stmt.all(...args),
        run: (...args) => {
          const r = stmt.run(...args);
          return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
        }
      };
    },
    // Emula db.transaction(fn) do better-sqlite3.
    transaction: (fn) => (...args) => {
      raw.exec('BEGIN');
      try { const out = fn(...args); raw.exec('COMMIT'); return out; }
      catch (e) { try { raw.exec('ROLLBACK'); } catch (_) {} throw e; }
    }
  };
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer',
  mbv_balance   REAL NOT NULL DEFAULT 0,
  wallet_address TEXT,
  phone         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  icon        TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  slug            TEXT,
  description     TEXT,
  price           REAL NOT NULL DEFAULT 0,
  compare_at_price REAL,
  category_id     INTEGER REFERENCES categories(id),
  stock           INTEGER NOT NULL DEFAULT 0,
  unit            TEXT DEFAULT 'un',
  pack_size       TEXT,
  image           TEXT,
  gallery         TEXT,
  badges          TEXT,
  rating          REAL NOT NULL DEFAULT 0,
  rating_count    INTEGER NOT NULL DEFAULT 0,
  featured        INTEGER NOT NULL DEFAULT 0,
  co2             REAL NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE,
  type         TEXT NOT NULL DEFAULT 'percent',
  value        REAL NOT NULL DEFAULT 0,
  description  TEXT,
  min_subtotal REAL NOT NULL DEFAULT 0,
  cashback_mbv REAL NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  code           TEXT NOT NULL,
  subtotal       REAL NOT NULL DEFAULT 0,
  discount       REAL NOT NULL DEFAULT 0,
  shipping       REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,
  coupon_code    TEXT,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  status         TEXT NOT NULL DEFAULT 'processing',
  mbv_amount     REAL NOT NULL DEFAULT 0,
  cashback_mbv   REAL NOT NULL DEFAULT 0,
  pix_code       TEXT,
  ship_name      TEXT, ship_cep TEXT, ship_address TEXT,
  ship_city      TEXT, ship_state TEXT, ship_phone TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id),
  name        TEXT NOT NULL,
  price       REAL NOT NULL,
  quantity    INTEGER NOT NULL,
  unit        TEXT,
  image       TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  amount        REAL NOT NULL,
  balance_after REAL NOT NULL,
  description   TEXT,
  ref           TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name   TEXT,
  rating      INTEGER NOT NULL,
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, user_id)
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,            -- 'reset' | 'verify'
  token       TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
`);

// Migrações leves (colunas para pagamento on-chain) — ignora se já existirem.
for (const stmt of [
  'ALTER TABLE orders ADD COLUMN tx_hash TEXT',
  'ALTER TABLE orders ADD COLUMN chain_id INTEGER',
  'ALTER TABLE orders ADD COLUMN cpf_cnpj TEXT',
  'ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE coupons ADD COLUMN cpf_cnpj TEXT',
  'ALTER TABLE coupons ADD COLUMN affiliate TEXT',
  'ALTER TABLE coupons ADD COLUMN commission_pct REAL NOT NULL DEFAULT 0'
]) { try { db.exec(stmt); } catch (_) {} }

module.exports = db;
