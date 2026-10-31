# Phase 6 — Android SQLite synchronization

The Android app uploads completed offline cash sales to `https://snack-time-pos.onrender.com/api` through Express. PostgreSQL on Neon remains the central database. The web POS keeps its existing online checkout, tenders, roles, reports and administration. No database connection strings or private signing keys are included in the APK.

## Delivery and recovery

SQLite schema version 2 adds `sync_outbox`. Checkout writes the immutable receipt, item snapshots, integer financial amounts, inventory deductions and delivery payload in the same SQLite transaction. Existing version 1 receipts are backfilled on first open without changing their contents. Delivery rows and completed financial records cannot be deleted through application SQL. Android encryption, Keystore protection and offline password verifiers are unchanged.

The native Network plugin and app foreground listener start one serialized delivery worker. It checks API/database readiness before uploading, gives cold starts up to 90 seconds per HTTP request, and retries transient failures with jittered exponential backoff capped at five minutes. Pending records resume when the app reopens; Android does not promise JavaScript execution while an app is terminated. A transport failure after central commit leaves the local sale pending. The next identical request obtains the original acknowledgment without another sale or deduction. No synchronization keep-alive or paid worker service is used.

Each device UUID / checkout UUID pair is unique in PostgreSQL. A canonical payload fingerprint rejects conflicting reuse. Acknowledgments identify the same device and checkout and include the central order ID and synchronization timestamp. SQLite marks a sale synchronized only after validating this response. A SQLite acknowledgment failure is safely retried. Unsynchronized rows are retained for authentication errors, rejected payloads, timeouts and storage/database failures; the UI exposes their state.

## Historical data and authentication

Initial online login issues a signed, device-bound seven-day authorization. Its existing cashier scopes now include sales synchronization and catalog refresh. Delivery requires that grant over HTTPS plus current server-side checks of account activation, role and password version. Online reauthorization renews delivery authority without rewriting the original sale proof or receipt. Expired/disabled/changed accounts cannot upload until authorized again; records remain queued.

The server archives a minimal immutable historical catalog containing prices, option rules, recipe quantities, discounts and receipt settings. New offline receipts reference its ID and preserve the signed grant used at checkout. The server recomputes amounts against that catalog, not today's prices, and verifies the historical authorization window. Seven-day catalog expiry prevents indefinite use of stale offline pricing. The existing POS has no tax calculation or separate payments table: its existing discount and single-tender financial model is preserved, with offline cash only.

Catalog refresh changes current product information, prices, availability, photos and local stock only. It subtracts still-unacknowledged local deductions, conservatively understating stock if a server acknowledgment was lost. Any saved nonempty cart defers a catalog replacement so its prices and choices remain stable. Clear/complete that cart to apply the update. Receipt snapshots and pending upload payloads remain immutable. Local/server transaction lists merge without showing synchronized sales twice.

Phase 5 receipts lack a verifiable historical catalog. They are permanently archived as `review_required`, remain visibly pending, and require an online administrator to review and approve them under **Inventory → Offline reconciliation**. Approval creates normal central orders and deductions atomically. This prevents unverified old prices from being silently accepted or old sales from being discarded. There is no reject/delete action.

## Shared inventory and administrator review

Online checkout and offline upload use the same transaction advisory lock. Row locks and relative deductions also protect against concurrent inventory adjustments. Each stock movement is audited once. If multiple devices sold the last unit, both completed cash sales are saved; central stock is deducted only to zero and an explicit shortage records requested versus applied quantity. Missing stock records or changed stock tracking also create review cases. Soft-deleted historical products retain their IDs and can still receive already-completed sales; genuinely missing product FK records must be restored before that receipt can be accepted.

An administrator reviews issues online, physically counts stock, and enters the actual count plus a reason of at least 10 characters. The API requires the expected central quantity; if it changed meanwhile, reconciliation fails with HTTP 409 and the administrator refreshes/reconfirms. Successful reconciliation records administrator identity, count, reason and a separate immutable stock movement. It never changes the original receipt amounts. Cashiers cannot access these endpoints.

## Additive migrations and backup

`database/synchronization.postgresql.sql` adds four tables: `offline_catalogs`, `offline_sales`, `offline_stock_movements`, `offline_stock_conflicts`, their indexes, FKs, UUID uniqueness and audit triggers. It does not rewrite existing POS tables or data. `frontend/src/offline/schema.js` includes the new SQLite ledger and upgrades `user_version` atomically.

Run once per server target from the project root:

```powershell
node backend/scripts/migrate-synchronization.js local
node backend/scripts/migrate-synchronization.js cloud
```

Cloud uses the direct `NEON_DATABASE_URL` in ignored `backend/.env.neon`; runtime retains its pooled URL. Each command first creates a complete custom-format PostgreSQL backup, verifies its archive table of contents, then applies the additive schema. It compares every original table fingerprint and numeric total before/after, saving private reports and backup checksums under ignored `database/backups/phase6-<target>-<timestamp>/`. It changes no account passwords and never touches MariaDB. Cloud startup also checks the schema idempotently before serving requests.

## API endpoints

| Method / path under `/api` | Authorization / purpose |
|---|---|
| `POST /offline/catalog` | Online session or current device grant; body `device_id`; fresh catalog and immutable historical policy ID |
| `POST /offline/sales` | Current device grant; validate and atomically persist one immutable sale |
| `GET /offline/sales/:clientId` | Same device and cashier; delivery acknowledgment / approval polling |
| `GET /offline/issues` | Online administrator; stock conflicts and legacy approvals |
| `POST /offline/reviews/:id/approve` | Online administrator; body `note`; approve an archived Phase 5 receipt |
| `POST /offline/conflicts/:id/resolve` | Online administrator; `counted_quantity`, `expected_quantity`, `note`; audited reconciliation |

The existing `/offline/bootstrap`, login and normal POS routes are retained. Financial writes use a single PostgreSQL client/transaction; payload failures roll back central sales, items, movements and idempotency records together. Unexpected error logs include sanitized error codes, never tokens, passwords, hashes or raw database messages.

## Tests

Executed automated scenarios use the real Express routes, file-backed SQLite and PostgreSQL. Business-write fixtures use disposable local databases or the separate existing Neon QA branch, never production orders. Production is checked with read-only authenticated endpoints and catalog preparation, and its existing data is fingerprinted around migrations/QA.

| Required scenario | Automated result |
|---|---|
| 1. Complete an offline discounted cash sale | PASS |
| 2. Restart and retain its receipt and pending queue | PASS |
| 3. Restore connectivity and upload through Express | PASS |
| 4. Verify exact PostgreSQL receipt/items/options/cashier/timestamp | PASS |
| 5. Retry/concurrently submit the same sale without duplication | PASS |
| 6. Disconnect after server commit, before acknowledgment | PASS |
| 7. Restart/resume without repeating stock deductions | PASS |
| 8. Two devices oversell, preserve both sales and reconcile explicitly | PASS |
| 9. Simulate cold-start 503s and 90-second request aborts/backoff | PASS |
| 10. Change prices/availability without changing historical totals | PASS |
| 11. Reject missing/expired/wrong-device/revoked credentials; enforce admin roles | PASS |
| 12. PostgreSQL partial-write rollback and SQLite acknowledgment failure retain sales | PASS |

All twelve were executed successfully locally and against Neon QA through Express. Additional cases cover Phase 5 approval, deferred catalog replacement and pending deductions, partial-batch restart and expired delivery reauthorization. Existing backend and SQLite regression suites remain required. The cold-start/timeout faults are controlled simulations; these tests do not claim a physical network outage or Android OS restart.

```powershell
npm --prefix backend test
npm --prefix frontend test
# Explicit isolated cloud QA only:
$env:PHASE6_QA='1'
$env:POS_QA_HOST='your-separate-existing-qa-endpoint.neon.tech'
node --test backend/tests/synchronization.test.js
Remove-Item Env:PHASE6_QA
Remove-Item Env:POS_QA_HOST
```

Do not point the local disposable database test suite at a production `DATABASE_URL`.

## Android acceptance and current limitations

1. Build with `npm --prefix frontend run android:prepare`, then `npm --prefix frontend run android:debug` on this Windows/OneDrive workspace. The latter stages native sources outside OneDrive. Install the resulting `database/backups/android-build-artifacts/snack-time-pos-cloud-debug.apk` on a test Android device. Use an update with the same signing key/app ID to retain existing SQLite data; never uninstall/clear data with pending sales.
2. With internet, choose **Online POS** and sign in normally. Verify offline preparation completes. Choose **Use offline POS** and sign in with that authorized account.
3. Enable airplane mode, complete a cash sale with a discount, record its `OFF-…` receipt number, and verify the pending count. Close and reopen the app; sign in offline, open transaction history and reprint the same receipt.
4. Restore internet. The indicator should show **Synchronizing**, then pending zero and a last-success time after the API wakes. Keep **Offline cash POS** selected if continuing to sell locally while connected; delivery runs independently of that choice.
5. Sign in online on the web and locate the corresponding synchronized receipt in Orders, then check reports and stock. Retry synchronization repeatedly; it must remain one central order.
6. Repeat with two devices against a dedicated QA environment selling the same final stock. An administrator must see the shortage under **Inventory → Offline reconciliation** and record a verified physical count. Avoid creating artificial sales in the production business database.

Physical-device SQLCipher/Keystore, Android reboot, native connectivity callbacks and printer behavior still require hands-on acceptance on actual phones/tablets. Desktop tests exercise the identical storage/synchronization engines, real React UI and PostgreSQL APIs; they cannot substitute for that hardware check. The APK is a debug testing artifact, not a signed Play Store release. An app that is terminated synchronizes when reopened. Device loss, clearing app data, uninstalling or storage hardware failure can destroy records that have never reached the server. Preserve app data while any receipt is pending. No Phase 7 work is included.

## Changed files

Backend: `controllers/syncController.js`, `controllers/offlineController.js`, `controllers/orderController.js`, `routes/offline.js`, `utils/syncAuthentication.js`, `utils/offlineSaleValidation.js`, `utils/syncSchema.js`, `utils/offlineGrant.js`, `scripts/migrate-synchronization.js`, `scripts/migrate-neon.js`, `scripts/cloud-start.js`, `server.js`, `tests/synchronization.test.js`, `tests/integration.test.js`.

Frontend: `src/offline/sync-manager.js`, `sync-store.js`, `sync-schema.js`, `store.js`, `schema.js`, `runtime.js`; `src/context/AuthContext.jsx`, `CartContext.jsx`; `src/components/SyncIndicator.jsx`, `OfflineReconciliation.jsx`, `ReceiptView.jsx`; `src/utils/syncLabel.js`; `src/layouts/AppLayout.jsx`; `src/pages/Inventory.jsx`, `POS.jsx`, `Transactions.jsx`, `Login.jsx`; `src/services/api.js`; `src/index.css`; package manifests/lockfile; native Network registration; Android build helper; offline browser test transport and UI scenarios. Documentation: this file plus `OFFLINE.md`, `DEPLOYMENT.md` and README link.

References used for native callbacks and transaction handling: [Capacitor Network](https://capacitorjs.com/docs/apis/network), [node-postgres transactions](https://node-postgres.com/features/transactions). Deployment verification follows [Render deploys](https://render.com/docs/deploys) and [health checks](https://render.com/docs/health-checks).
