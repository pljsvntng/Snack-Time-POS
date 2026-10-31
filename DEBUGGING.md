> Historical notes from the pre-migration MariaDB debugging phase. Current database and tests are documented in [MIGRATION.md](MIGRATION.md).

# Debugging and verification notes

The application remains React/Vite + Express + MariaDB. No existing database schema, credentials, sales, or stock were changed. The current screen design and routes are retained.

## Significant changes

- Authentication checks the user's current active status and role on every protected request. New tokens include a password-derived credential version, so password resets invalidate existing sessions. Old tokens require a fresh login. The frontend restores identity from `/auth/me`, handles expired sessions, tolerates malformed saved user JSON, and clears cart state when the signed-in user changes.
- Database environment loading now resolves `backend/.env` independently of the launch directory. MariaDB sessions and timestamp serialization consistently use UTC+08:00, matching the Manila business-day helpers.
- Product list/detail queries no longer depend on permissive GROUP BY behavior. `includeUnavailable=false` is interpreted correctly. Product prices, names, stock flags, stock counts, and thresholds are validated; zero thresholds are retained. Disabling stock tracking clears the old stock count, enabling it initializes a missing count, and blank SKUs can be cleared. Restoring a missing product returns 404.
- Inventory operations reject invalid/non-finite/negative values. Recipe updates reject negative requirements, duplicate ingredients, and missing products before replacing the recipe. Existing transaction/row-lock stock safeguards remain intact.
- Checkout rejects malformed items, invalid option collections, foreign-product options, invalid cash values, and unavailable discounts. Discounts and totals are rounded consistently. The frontend supplies an expected total; checkout rejects stale catalog/discount totals instead of silently charging a different amount.
- Order numbers use the maximum daily numeric suffix rather than row count. A database-scoped MariaDB named lock serializes checkout before taking row locks and remains held through commit/rollback. This prevents concurrent numbering collisions without adding tables. The tradeoff is serialized checkout throughput; this is intended for the existing small POS deployment.
- Immediate receipts include a server timestamp. Receipt rendering accepts both immediate and historical option field names, restoring option names on reprints.
- Transactions use calendar week/month boundaries and Manila business dates. Reports validate ranges and use half-open intervals (including the entire final day). Report printing has dedicated CSS instead of being hidden by receipt-only print rules. Error states are displayed on Transactions, Reports, and Settings.
- API calls report unreachable servers clearly, preserve HTTP error status, and expire rejected sessions. The default development API host follows the browser hostname. Images are loaded from the backend image endpoint, allowing uploaded photos to work with a separately built frontend. `VITE_API_URL` still overrides the default for deployment; configure it for your production API.
- Image uploads use UUID filenames and extensions based on allowed MIME types. Cross-volume moves are supported, and missing products/failed updates clean up new files. Existing upload/removal functionality is retained.
- Settings updates are validated and saved atomically. User-management validation avoids accidental server errors for malformed names, passwords, and active flags.
- Malformed JSON, oversized uploads, unavailable databases, invalid SQL values, constraint conflicts, and deadlocks receive appropriate API responses. Handled errors no longer log SQL statements containing password hashes.
- The supplied demo password hashes in `database/seed.sql` were invalid. They now match the documented demo passwords. This file change does not reset existing database users. Do not reimport the seed into the existing database.

## Verification

Run from the project root:

```powershell
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
```

- Backend suite: 11 tests passed (parent test, nine API regression groups, and one existing-database smoke test).
- Regression writes run in a uniquely named `snacktime_test_*` MariaDB database, removed in a finally block. This requires database creation/drop privileges on the configured MariaDB server. The production database is only queried, never seeded or updated by the tests.
- Covered authentication, changed roles, disabled accounts, password resets, product CRUD/restoration, strict GROUP BY queries, stock tracking toggles, inventory validation/history, recipes, insufficient stock, checkout rollback, required/foreign options, percentage/fixed discounts, cash/change, GCash recording, stale-total rejection, concurrency, receipt snapshots, history ownership, report totals/date validation, user creation, duplicate usernames, settings, and image upload/removal.
- Thirteen GET API endpoints passed against the actual `snacktime_pos` database on MariaDB 10.4.32. Its 11 existing orders remained unchanged.
- Frontend suite: five tests passed, covering shared ingredient consumption, fractional/direct stock limits, immediate and historical receipt rendering, Manila date boundaries, and API image/error/session behavior.
- Production Vite build passed. The build retains the existing large-chunk advisory (bundle exceeds 500 kB); this is not a build failure. In the restricted agent environment, esbuild needs the approved build command outside the sandbox.
- Backend JavaScript syntax checks and `git diff --check` passed.

## Operational notes and limits

Restart the backend and frontend after applying these changes, then sign in again; previously issued tokens are intentionally invalidated. No PostgreSQL, Capacitor, or SQLite work was introduced.

Physical receipt printing, browser visual interaction, Android devices, and external GCash settlement were not tested. GCash remains a manually recorded tender. Checkout has no durable request-id deduplication: an ambiguous network failure after commit still requires checking transaction history before resubmitting. No automatic sale retry was added. Offline synchronization and comprehensive stock auditing remain separate planned work.
