# PostgreSQL migration — Snack Time POS

The application now uses PostgreSQL 18.6 at `localhost:5432`, database `snacktime_pos`, through the `pg` driver. MariaDB/XAMPP and its original `snacktime_pos` database were left intact.

## Recovery files

The verified final MariaDB backup is in:

`database/backups/snacktime_pos-2026-10-31T11-07-58-965Z/`

It contains:

- `mariadb.sql`: complete schema/data dump, including all tables, indexes, constraints and password hashes.
- `snapshot.json`: consistent UTC export of every row plus live schema/index/constraint metadata.
- `manifest.json`: file checksums and per-table counts/checksums. The SQL dump was restored in a scratch MariaDB database and every restored row matched the snapshot before migration.
- `images/`: copy of the existing product image assets; database paths remain unchanged.
- `postgresql-validation.json`: import-time validation results.
- `post-test-validation.json`: full validation after tests, including proof that MariaDB still matches the source backup.
- `postgresql.dump` and `postgresql-backup-manifest.json`: PostgreSQL custom archive and checksum, restored into a separate PostgreSQL database and compared against all 440 original records, totals, relationships and indexes.

Backups and credential files are git-ignored. They include password hashes and business records and should remain private. An earlier verified backup and the pre-migration backend code are also retained under `database/backups/`.

## Preservation results

| Data | MariaDB | PostgreSQL |
| --- | ---: | ---: |
| All tables | 15 | 15 |
| All records | 440 | 440 |
| Products | 22 | 22 |
| Categories | 9 | 9 |
| Users | 2 | 2 |
| Ingredients | 19 | 19 |
| Inventory movements | 103 | 103 |
| Orders | 11 | 11 |
| Order items | 118 | 118 |
| Historical option snapshots | 61 | 61 |
| Indexes (including primary/unique indexes) | 40 | 40 |
| Primary keys | 15 | 15 |
| Unique constraints | 9 | 9 |
| Declared foreign keys | 15 | 15 |

Every value in every row was compared, including unchanged bcrypt hashes, original IDs, image paths, historical names/prices/options, soft-delete state and timestamps. Every decimal column's total was checked using decimal arithmetic. All 15 declared relationships plus inventory order references were checked; no orphans were found. Identity sequences retain the source's next IDs, including gaps.

Financial totals match exactly:

- Gross subtotal: **PHP 8,251.00**
- Discounts: **PHP 444.40**
- Net sales: **PHP 7,806.60**

The source's 11 payments are all recorded as completed cash sales. Their tendered amounts and change were copied exactly; existing historical records were not recalculated or repaired. GCash and Other payments remain supported and were exercised in the isolated regression database.

## Schema and backend changes

`database/schema.postgresql.sql` was generated from the actual live database, rather than the older `database/schema.sql` or `copy.sql`.

- Auto-increment keys become PostgreSQL identity columns. Sequences resume at the original next IDs.
- DECIMAL becomes NUMERIC with the original precision/scale. The driver keeps NUMERIC as decimal strings; checkout and stock arithmetic use `decimal.js`. Conversion to JavaScript numbers is limited to compatible immediate-checkout response fields and chart presentation.
- Source TIMESTAMP values were exported in UTC and imported as `timestamptz`. API sessions use `Asia/Manila`; business-day reports and serialized timestamps remain consistent.
- Existing 0/1 flags use `smallint` with checks, preserving the frontend's existing API contract. ENUM values become checked character columns.
- ICU case/accent-insensitive collation preserves the application's case-insensitive identities and unique keys. Search uses deterministic `unaccent(... COLLATE "C") ILIKE` expressions. Collation behavior is a PostgreSQL ICU approximation of MariaDB's Unicode collation; exact historical strings are unchanged.
- All primary keys, unique constraints, foreign-key delete/update rules, and index definitions were recreated and verified. Update triggers replace MariaDB's automatic updated-at behavior.
- SQL uses `$1` parameters, `ANY(integer[])`, `RETURNING id`, `ON CONFLICT`, PostgreSQL date arithmetic, native `rows`/`rowCount`, and PostgreSQL SQLSTATE errors.
- Sales, stock adjustments, recipe replacements and settings writes use `BEGIN`/`COMMIT`/`ROLLBACK` on one checked-out PostgreSQL client. Sales retain row locks and guarded deductions; a transaction advisory lock protects daily order numbering and is released automatically.
- Dashboard chart inputs explicitly convert NUMERIC strings for Recharts rendering, without changing stored/report monetary precision or the UI design.
- `/api/health` now queries the database and identifies PostgreSQL.

`mysql2` remains installed for the read-only MariaDB backup/verification tools. The running application imports only the PostgreSQL database pool.

## Configuration and startup

Application connection values are in ignored `backend/.env.postgresql`, with an example at `backend/.env.postgresql.example`. JWT/server/CORS settings remain in `backend/.env`. The previous MariaDB settings are preserved in ignored `backend/.env.mariadb` for recovery and verification.

```text
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=snacktime_pos
PG_USER=postgres
PG_PASSWORD=<your local password>
PG_SSL=false
```

Explicit process environment values take precedence over files. For a TLS-enabled remote database set `PG_SSL=true`; an optional `PG_SSL_CA` supplies a trusted CA file. Do not place database credentials in frontend variables.

From the project root, use two terminals:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

Open `http://localhost:5173`. The backend uses port 4000. XAMPP is no longer required to run the POS, but its MariaDB database remains available. Do not use the old MySQL setup/seed instructions for the migrated application, and do not import demo seed data into the populated PostgreSQL database.

## Verification commands

```powershell
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run test:browser
npm --prefix frontend run build
node backend/scripts/verify-migration.js database/backups/snacktime_pos-2026-10-31T11-07-58-965Z
```

The backend suite uses disposable PostgreSQL databases and never writes test orders into the migrated database. Creating/dropping test databases requires sufficient privileges. The existing-database smoke test exercises 13 GET endpoints with an internal short-lived test token. The browser smoke test starts temporary servers on ports 14800/15179, logs in through the UI, prohibits all writes except login, then stops its servers. It uses the installed Chrome executable and the existing demo logins unless `TEST_ADMIN_USER`, `TEST_ADMIN_PASSWORD`, `TEST_CASHIER_USER`, `TEST_CASHIER_PASSWORD`, or `TEST_CHROME` override them. External Google font requests are disabled in that test to avoid unrelated network waits.

Backend coverage includes both roles, disabled accounts, role changes, password resets, product CRUD/restoration, categories, uploads/removal, inventory/recipes, discounts, all three tenders, historical receipts, search filters, report totals/ranges, settings, concurrency and stock exhaustion. A deliberately rejected inventory audit insert verifies that an order and deductions roll back even after partial SQL writes. Decimal checks include a PHP 0.30 sale with a PHP 0.06 discount saved exactly as PHP 0.24.

All 13 backend tests and all five frontend tests passed. The Chrome smoke test passed every listed screen/role/cart/receipt/report/print-rendering scenario with zero JavaScript/API errors and no production writes. A final post-test comparison confirmed that both PostgreSQL and the untouched MariaDB source still match the backup.

The isolated PostgreSQL test cluster has been stopped; its files are retained with the private backup artifacts.

The Vite build retains its existing large-bundle advisory. Physical receipt printers and real external GCash settlement are outside automated verification; GCash remains a recorded tender.

## Recovery and repeat migrations

The import script accepts only a checksum-verified backup and refuses a destination containing application tables. The entire schema/data import is transactional. Do not bypass the empty-destination check or rerun against the populated production database.

```powershell
node backend/scripts/migrate-postgresql.js <absolute-path-to-verified-backup-folder>
```

For rollback before new PostgreSQL sales exist, use the preserved pre-migration backend code and MariaDB connection file; verify it in an isolated checkout before switching. After accepting new PostgreSQL sales, reconcile/export those sales before any rollback. Restoring only the old backup would lose those newer records. The original MariaDB database was not deleted or updated during this migration.
