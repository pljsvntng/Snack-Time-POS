# Render Free + Neon Free deployment

Status: local offline POS implemented and tested. Cloud resources have not been deployed, and automatic synchronization is not implemented yet. No production APK has been configured with an API endpoint. The existing browser POS and local PostgreSQL remain usable.

Local preparation verified on October 31, 2026: 11 SQLite durability/security tests, React/API regressions, Android encryption/URL checks, offline UI restarts, online browser checks, four final phone/tablet viewports, PostgreSQL API regressions, and an Android SQLCipher debug compile passed. The fresh PostgreSQL backup contains 15 tables, 444 records, 12 orders and 22 referenced photos; a test restore matches all values and financial totals. These counts are a dated snapshot, not a reason to reject legitimate subsequent sales.

`render.yaml` passes the current official JSON Schema. Render CLI 2.34.0 is installed under ignored `database/backups/deployment-tools/render-cli`. Account/workspace validation still requires sign-in:

```powershell
.\database\backups\deployment-tools\render-cli\render.exe login
```

Authorize the CLI in your browser and select your intended workspace. Then the agent can perform workspace-aware Blueprint validation and deploy. Installing the plugin alone does not establish an authenticated CLI/MCP session.

## 1. Accounts and free plans

Connect the Render plugin and the Neon plugin using your own accounts. GitHub access to `pljsvntng/Snack-Time-POS` is connected. Neon CLI 8.15.1 is installed; its current profile is not signed in. If using the CLI, run `neon login` yourself and finish browser sign-in. The agent must not start unattended browser authentication.

Create a **Neon Free** project, PostgreSQL **18**, preferably Singapore (`aws-ap-southeast-1`) to match the Render region. Use a new empty database, e.g. `snacktime_pos`. Keep default scale-to-zero. Do not select Launch, Scale, paid storage, or a paid organization. If your account already has a project, use an empty database in that project rather than overwriting anything.

Copy the direct/unpooled and pooled connection strings from Neon's Connect dialog into ignored `backend/.env.neon`:

```dotenv
NEON_DATABASE_URL=<the real direct connection string>
DATABASE_URL=<the real pooled connection string>
```

These are private configuration examples, not Android build values. Keep credentials out of chat and Git. The runtime uses `pg` with verified TLS and a five-connection pool. Migration/dump/restore uses the direct connection.

## 2. Backup, import, and validate

Before final cutover, finish any current checkout and pause local sales. Otherwise new local-server sales after the backup will not exist in Neon. The migration does not connect the two online databases for ongoing replication.

```powershell
npm --prefix backend run backup:postgresql
npm --prefix backend run migrate:neon
```

`backup:postgresql` creates a consistent custom-format `pg_dump`, copies referenced product photos, records SHA-256 checksums, restores the dump into a new disposable local database, and compares every row, all NUMERIC totals, column definitions/defaults/identity attributes, constraints and indexes. Verification databases use random `snacktime_restore_` names and are removed after checking. Backups are private under ignored `database/backups/postgresql-<timestamp>`.

`migrate:neon` refuses a nonempty target and requires a direct `.neon.tech` endpoint. It takes another fresh verified backup, restores atomically, and checks counts, row hashes (including user password hashes), exact decimal totals, constraints, columns and indexes. Restored foreign keys must be validated. It then adds `product_images` and imports each backed-up photo into BYTEA storage with checksum verification. Original MariaDB and local PostgreSQL records are never modified. The private backup directory receives `neon-validation.json`. Do not declare success without that report.

An import or validation failure stops the process. A failed target is not automatically erased or reused; inspect it or create another empty database. Do not run MariaDB-era verification against an old snapshot as proof that newer PostgreSQL sales were migrated.

## 3. Cloud passwords and secrets

The migration first preserves password hashes exactly. The source currently has known demo credentials. Public cloud startup refuses those passwords. Change affected **cloud** accounts before deploying, keeping local credentials unchanged. Set a chosen account and a unique password in ignored `backend/.env.cloud-credentials`:

```dotenv
CLOUD_USERNAME=<existing username>
CLOUD_NEW_PASSWORD=<unique password with at least 12 characters>
```

Run `node backend/scripts/change-cloud-password.js`, repeat for each affected account, verify sign-in, then remove the private password entry. The helper accepts only a Neon target and uses bcrypt; it does not touch local databases. Real-device initial online authorization must use these cloud credentials.

Run `node backend/scripts/prepare-render-env.js` to generate ignored `backend/.env.render`. It retains the existing offline RSA signing key, checks its public key against the Android bundle, and generates a random JWT secret. It refuses to overwrite an existing file. Import these values through Render's private environment settings; never publish them or rotate the offline signing key casually. Previously installed devices pin its public key.

## 4. Render Free web service

Review/publish the prepared code to a deployment branch on your GitHub repository. Exclude `.env` files, private PEM keys, backups, SDKs, databases and APK/build output. The supplied `render.yaml` defines **one Free Node web service**, without paid disks, paid databases or background workers. Neon provides PostgreSQL separately; do not create Render Postgres (its Free database expires).

Create a Blueprint from the deployment branch, or a Web Service with these settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Region | Singapore |
| Instance plan | **Free** |
| Root directory | Repository root |
| Build command | `npm ci --prefix backend && npm ci --prefix frontend --include=dev && npm run build --prefix frontend` |
| Start command | `npm run start:cloud --prefix backend` |
| Health check | `/api/health` |
| Build environment | `VITE_API_URL=/api` |
| Automatic deploys | Off during migration/validation |

Import secrets from `.env.render`; retain `NODE_ENV=production`, `SERVE_WEB=true`, `PRODUCT_IMAGE_STORAGE=postgres`, and `CLIENT_ORIGIN=https://localhost` (Capacitor's secure bundled-app origin). The frontend is served by Express on the same Render origin. Use the actual Render HTTPS URL once created. No separate paid frontend service is needed.

Cloud startup checks secrets/key compatibility and demo passwords, creates the additive photo table, and verifies that referenced photos exist. Photos are read from PostgreSQL before bundled asset fallback. New uploads and product-image updates commit together in PostgreSQL and survive service restarts.

## 5. Cloud acceptance checks

Check the actual HTTPS `/api/health`, initial login, roles, catalog/search/options, image upload and survival after redeploy, inventory/recipes, cash/GCash/other checkout, discounts, unique order numbers, history/receipts, reports, settings and user management. Perform writes on a separate test Neon branch and confirm financial totals/stock rollback there. Test production read-only. Do not run the local disposable-database suite directly against a cloud production database.

## 6. Android endpoint and synchronization phase

Only after the cloud checks pass, put the actual deployed Render URL plus `/api` into `frontend/.env.android.local` as `VITE_API_URL`. Run `npm --prefix frontend run android:prepare`. This command refuses missing, HTTP, loopback, reserved example/test URLs and non-`/api` paths; it also requires a successful PostgreSQL health response. Bundled app assets remain local. Complete a signed release build and physical Android tests before distributing an APK.

Automatic synchronization remains a required next phase, not a claimed capability of this build. Implement and test:

1. A separate durable delivery ledger for immutable SQLite sales; pending receipts remain visible until the server acknowledges a permanent UUID.
2. An authenticated device-bound server endpoint with a unique device/sale UUID, request-content fingerprint, and one PostgreSQL transaction for central sale/items/inventory/audit/idempotency records.
3. Historical catalog/price/discount provenance so completed cash receipts retain original amounts rather than being repriced. Treat shared-inventory conflicts as visible reconciliation cases; never silently discard a completed cash sale.
4. Resume on connectivity/app foreground with bounded retry/backoff, safe handling of Render cold starts, expired credentials and lost acknowledgments. A repeat request returns the same server receipt and never deducts twice. No artificial keep-alive traffic.
5. Tests for disconnect before/during/after upload, crash after central commit but before local acknowledgment, multiple devices, changed/deleted products, expired/revoked accounts, conflicting payloads and central financial/stock reconciliation.

Only enable uploads against the verified actual Render URL. Until then the SQLite build explicitly labels sales as local/not uploaded and never transmits them.

## Free-plan operating limits

Render Free can spin down after 15 minutes idle and has an ephemeral filesystem. Neon Free scales to zero and currently includes 1 GB/project, 100 CU-hours/project and 5 GB/project public transfer. Both have quotas; first online authorization may wait for cold starts. Stay on Free, monitor usage, avoid adding payment methods/automatic upgrades, and stop before accepting any paid plan. Offline cash operations do not require either service to be awake.

Official references: [Render Free](https://render.com/docs/free), [Render Blueprint](https://render.com/docs/blueprint-spec), [Neon plans](https://neon.com/docs/introduction/plans), [Neon pooling](https://neon.com/docs/connect/connection-pooling), [pg TLS](https://node-postgres.com/features/ssl).
