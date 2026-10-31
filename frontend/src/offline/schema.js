export const schema = `
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS authorized_users (
 user_id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 aliases_json TEXT NOT NULL, grant_jwt TEXT NOT NULL, salt TEXT NOT NULL, verifier TEXT NOT NULL,
 failures INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, data_json TEXT NOT NULL, stock_quantity INTEGER);
CREATE TABLE IF NOT EXISTS ingredients (id INTEGER PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL, current_units INTEGER NOT NULL CHECK(current_units>=0));
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, data_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS discounts (id INTEGER PRIMARY KEY, data_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cached_orders (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, data_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS drafts (user_id INTEGER PRIMARY KEY REFERENCES authorized_users(user_id), request_id TEXT NOT NULL UNIQUE, data_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS local_orders (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
 user_id INTEGER NOT NULL REFERENCES authorized_users(user_id), device_id TEXT NOT NULL,
 receipt_number TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
 subtotal_cents INTEGER NOT NULL CHECK(subtotal_cents>=0), discount_cents INTEGER NOT NULL CHECK(discount_cents>=0),
 total_cents INTEGER NOT NULL CHECK(total_cents>=0), cash_cents INTEGER NOT NULL CHECK(cash_cents>=total_cents),
 change_cents INTEGER NOT NULL CHECK(change_cents=cash_cents-total_cents), receipt_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS local_orders_user_date ON local_orders(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS local_order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES local_orders(id), snapshot_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory_movements (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES local_orders(id), kind TEXT NOT NULL CHECK(kind IN ('product','ingredient')),
 entity_id INTEGER NOT NULL, quantity_units INTEGER NOT NULL CHECK(quantity_units>0), resulting_units INTEGER NOT NULL CHECK(resulting_units>=0)
);
CREATE TRIGGER IF NOT EXISTS immutable_local_orders_update BEFORE UPDATE ON local_orders BEGIN SELECT RAISE(ABORT,'Local sales are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_local_orders_delete BEFORE DELETE ON local_orders BEGIN SELECT RAISE(ABORT,'Local sales cannot be deleted'); END;
CREATE TRIGGER IF NOT EXISTS immutable_local_items_update BEFORE UPDATE ON local_order_items BEGIN SELECT RAISE(ABORT,'Local sale items are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_local_items_delete BEFORE DELETE ON local_order_items BEGIN SELECT RAISE(ABORT,'Local sale items cannot be deleted'); END;
CREATE TRIGGER IF NOT EXISTS immutable_movements_update BEFORE UPDATE ON inventory_movements BEGIN SELECT RAISE(ABORT,'Stock movements are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_movements_delete BEFORE DELETE ON inventory_movements BEGIN SELECT RAISE(ABORT,'Stock movements cannot be deleted'); END;
PRAGMA user_version=1;
`;
