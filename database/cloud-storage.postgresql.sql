-- Additive cloud-only storage: uploaded photos survive Render Free restarts.
CREATE TABLE IF NOT EXISTS product_images (
 path TEXT PRIMARY KEY CHECK(path LIKE '/images/%'),
 mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp','image/svg+xml')),
 contents BYTEA NOT NULL CHECK(octet_length(contents) BETWEEN 1 AND 5242880),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
