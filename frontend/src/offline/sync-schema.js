export const syncSchema=`
CREATE TABLE IF NOT EXISTS sync_outbox (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id TEXT NOT NULL UNIQUE REFERENCES local_orders(id), user_id INTEGER NOT NULL REFERENCES authorized_users(user_id),
 payload_json TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','uploading','synced','review_required','blocked','auth_required')),
 attempts INTEGER NOT NULL DEFAULT 0, error TEXT, next_attempt_ms INTEGER NOT NULL DEFAULT 0,
 ack_json TEXT, last_attempt_ms INTEGER, synced_at TEXT
);
CREATE INDEX IF NOT EXISTS sync_outbox_state_sequence ON sync_outbox(state,sequence);
CREATE TRIGGER IF NOT EXISTS immutable_outbox_payload BEFORE UPDATE OF payload_json,order_id,user_id ON sync_outbox BEGIN SELECT RAISE(ABORT,'Queued financial data is immutable'); END;
CREATE TRIGGER IF NOT EXISTS retain_outbox BEFORE DELETE ON sync_outbox BEGIN SELECT RAISE(ABORT,'Delivery records cannot be deleted'); END;
`;
