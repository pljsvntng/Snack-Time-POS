-- Additive online checkout replay protection; existing orders remain unchanged.
CREATE TABLE IF NOT EXISTS online_checkouts (
 user_id INTEGER NOT NULL REFERENCES users(id),
 request_id UUID NOT NULL,
 request_hash TEXT NOT NULL,
 order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
 response JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (user_id, request_id)
);
