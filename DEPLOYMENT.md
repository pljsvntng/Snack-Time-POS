# Render Free + Neon Free deployment

Status: deployed on Render Free at **https://snack-time-pos.onrender.com**, using Neon Free PostgreSQL 18. The API is **https://snack-time-pos.onrender.com/api**. The Android build configuration uses this verified actual HTTPS API. Automatic synchronization is not implemented yet; local Android sales remain on-device. The original MariaDB and local PostgreSQL records were not modified.

The deployed source is the `codex/offline-render-neon` branch of `pljsvntng/Snack-Time-POS`. Automatic deployment is disabled. Render service `srv-dbiv84g473hc73ao5cqg` is in **My Workspace**, region Ohio, with compute plan **free**. Neon organization plan **free** was verified. No paid database, disk, worker or service was created. Render uses its default TCP service probe; `/api/health` has been checked directly over HTTPS.

Migration evidence is private under `database/backups/postgresql-2026-10-31T13-49-12-954Z/neon-validation.json`. All 445 source records and 12 orders matched before the owner-approved cloud password rotation; all 22 referenced product photos were copied and checked. Original password hashes remain in the verified backups and local databases. The existing cloud logins were subsequently moved into Windows DPAPI-protected owner storage without resetting them. See ADMIN-ACCESS.md for hidden password setup/reset commands; no plaintext administrator password file is used.

Live HTTPS browser checks cover real login, both roles, dashboard charts, catalog, inventory, users, settings, history, receipt/report print rendering, customized carts, payment dialogs and logout cleanup without writing production sales. The isolated Neon QA branch `codex-deployment-qa-20261031` exercises sales writes, all tender types, discounts, exact stock/money, user/settings edits and photo persistence; its records are not production sales. The branch is within the Free plan's included branch allowance and retains the account's default suspend behavior.

The cloud-backed offline UI test also passed: real Render authorization/bootstrap, disconnected product search and restored cart, offline cash checkout, then receipt/history recovery after two SQLite/application restarts. Its SQLite bridge and origin translation are test-only; native Android CORS was verified separately using `Origin: https://localhost`. Production order count remained 12. Use `TEST_REMOTE_API=https://snack-time-pos.onrender.com` for that test, and `TEST_REMOTE_SITE=https://snack-time-pos.onrender.com` for the read-only browser test.

The Windows test APK built successfully using materialized native/plugin sources outside OneDrive. `database/backups/android-build-artifacts/snack-time-pos-cloud-debug.apk` contains the actual Render API and SQLCipher libraries for four architectures; no SQLite test bridge or private signing key was packaged. It is debug-signed for physical-device testing. A production release and automatic synchronization are still pending.

Local preparation verified on October 31, 2026: 11 SQLite durability/security tests, React/API regressions, Android encryption/URL checks, offline UI restarts, online browser checks, four final phone/tablet viewports, PostgreSQL API regressions, and an Android SQLCipher debug compile passed. The fresh PostgreSQL backup contains 15 tables, 444 records, 12 orders and 22 referenced photos; a test restore matches all values and financial totals. These counts are a dated snapshot, not a reason to reject legitimate subsequent sales.

`render.yaml` passes the current official JSON Schema. Render CLI 2.34.0 is installed under ignored `database/backups/deployment-tools/render-cli`. Account/workspace validation still requires sign-in:

```powershell
.\database\backups\deployment-tools\render-cli\render.exe login
```

Authorize the CLI in your browser and select your intended workspace. Then the agent can perform workspace-aware Blueprint validation and deploy. Installing the plugin alone does not establish an authenticated CLI/MCP session.

## 1. Accounts and free plans

Connect the Render plugin and the Neon plugin using your own accounts. GitHub access to `pljsvntng/Snack-Time-POS` is connected. Neon CLI 8.15.1 is installed; its current profile is not signed in. If using the CLI, run `neon login` yourself and finish browser sign-in. The agent must not start unattended browser authentication.

The existing **Neon Free** project uses PostgreSQL **18** in Ohio (`aws-us-east-2`); Render is placed in Ohio to keep backend/database calls local to the region. For any future fresh migration, use a new empty database. Keep default scale-to-zero. Do not select Launch, Scale, paid storage, or a paid organization. Never overwrite an existing database.

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

Use the owner-only commands in [ADMIN-ACCESS.md](ADMIN-ACCESS.md). Check with `npm --prefix backend run admin:status -- --target cloud`. Choose a new administrator password only by explicitly running `admin:reset -- --target cloud --username admin` in a private terminal; input is hidden and PostgreSQL receives a salted bcrypt hash. Existing accounts/passwords are not automatically changed. Do not recreate plaintext login configuration files or print hashes.

Run `node backend/scripts/prepare-render-env.js` only for a fresh deployment environment. It creates ignored `backend/.env.render`, retains the existing offline RSA signing key, checks its public key against the Android bundle, and generates a random JWT secret. It refuses to overwrite an existing file. Use Render's private environment settings; never publish the file or rotate the offline signing key casually. Previously installed devices pin its public key.

## 4. Render Free web service

Review/publish the prepared code to a deployment branch on your GitHub repository. Exclude `.env` files, private PEM keys, backups, SDKs, databases and APK/build output. The supplied `render.yaml` defines **one Free Node web service**, without paid disks, paid databases or background workers. Neon provides PostgreSQL separately; do not create Render Postgres (its Free database expires).

Create a Blueprint from the deployment branch, or a Web Service with these settings:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Region | Ohio (matching Neon) |
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

Phase 6 implements durable, authenticated and idempotent SQLite delivery through Express to Neon. See [SYNCHRONIZATION.md](SYNCHRONIZATION.md) for the additive migration and backups, API endpoints, inventory reconciliation, executed tests and Android acceptance procedure.

## Free-plan operating limits

Render Free can spin down after 15 minutes idle and has an ephemeral filesystem. Neon Free scales to zero and currently includes 1 GB/project, 100 CU-hours/project and 5 GB/project public transfer. Both have quotas; first online authorization may wait for cold starts. Stay on Free, monitor usage, avoid adding payment methods/automatic upgrades, and stop before accepting any paid plan. Offline cash operations do not require either service to be awake.

Official references: [Render Free](https://render.com/docs/free), [Render Blueprint](https://render.com/docs/blueprint-spec), [Neon plans](https://neon.com/docs/introduction/plans), [Neon pooling](https://neon.com/docs/connect/connection-pooling), [pg TLS](https://node-postgres.com/features/ssl).
