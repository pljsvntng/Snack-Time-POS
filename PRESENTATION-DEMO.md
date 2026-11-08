# Snack Time POS presentation demo

The presentation uses the separate **snacktime-pos-demo** Neon Free project and the existing **snack-time-pos** Render Free service. The original Neon project, local PostgreSQL database and original Android SQLite file are preserved. Historical test transactions were not imported. The demo starts from the existing catalog/recipes/discounts plus explicitly generated presentation sales.

## Accounts and secure setup

- Administrator: `admin`, active. The presentation account initially uses the owner's existing administrator passphrase, stored as a new bcrypt hash in the new database.
- Cashier: `juan`, active. A unique password is protected in the Windows DPAPI demo vault. Set a passphrase you know using the hidden local command below before presenting.

```powershell
npm --prefix backend run demo:password -- --username juan
# Optional: choose a new passphrase for the demo administrator only.
npm --prefix backend run demo:password -- --username admin
npm --prefix backend run admin:status -- --target demo
```

The password command requires a real local terminal, explicit username confirmation and a unique passphrase of at least 15 characters. It never echoes or logs the password. It changes only the selected demo account; original accounts are separate. Sign in online again after changing a password to renew its offline authorization.

Connection files and both credential vaults are ignored by Git. No database URL, private key, password or token belongs in chat, frontend code or the APK.

## Android installation and data isolation

Install the **1.1.5 (code 7)** debug APK as an update. Application ID and debug signing identity are unchanged. Do not uninstall or clear storage.

The presentation APK creates a separate encrypted SQLite file, `snack_time_offline_demo_bitter_salad_90425468SQLite.db`. It reuses the existing Keystore-protected encryption secret and retains every original `snack_time_offlineSQLite.db` file/WAL/receipt. Original receipts are not shown in the demo's fresh profile and are not uploaded into the new database. A matching future original-profile build can reopen the retained original data; do not downgrade or clear storage to switch datasets.

Database-bound online tokens and offline grants reject credentials/sale proofs issued for another database. The build also checks that its actual Render HTTPS API reports the expected demo identity before packaging. No localhost backend or placeholder is used in the APK. Capacitor's internal packaged-asset origin is unchanged.

## Presentation checklist

1. Open the existing Render HTTPS web address and sign in as `admin`; check Products, Inventory, Reports and Users. Set the cashier password with the hidden command or administrator Users screen.
2. Install the new APK as an update, then sign in online on the phone once to prepare its separate demo catalog and authorization.
3. Renew online authorization the day before the presentation. The retained security policy allows seven-day offline grants/catalogs; backgrounding for over five minutes locks the session and requires sign-in again.
4. Show product options, stock availability, percentage/fixed discounts, cash checkout, receipt/history and online reports. Online GCash/other tenders remain available; offline tender is cash.
5. Enable airplane mode, choose offline POS, sign in, create a clearly identified presentation sale, and reopen its receipt after restarting the app.
6. Reconnect and verify that the pending sale uploads once and stock changes once. Check pending count and history before repeating any sale.
7. Allow time for Render Free's cold start before starting the demonstration. Warm the application shortly beforehand; do not run constant keep-alive traffic.

Physical Android acceptance (installation, actual keyboard/system navigation, native SQLCipher persistence, airplane mode and reconnect) is not certified by browser/Node tests. Follow the checklist on the actual presentation phone.

## Transfer safeguards

Public product photos use a bounded, coalesced server cache. A checksum-matching bundled photo needs only database metadata rather than another BYTEA download. Custom uploads retain authoritative database bytes, and replacements/deletions invalidate cached paths after commit. Stock, financial and authentication results are never cached.

Database verification hashes complete rows inside PostgreSQL and transfers digests, including for image tables; it no longer exports full binary rows simply to hash them on the verification computer. Fingerprint manifests now use format version 2 and should not be compared with version 1 manifests.

Synchronization avoids catalog downloads while a nonempty saved cart will prevent applying that catalog. Catalog refresh resumes after the cart is cleared/checked out. Uploads retain existing batch limits, retries/backoff, single-worker execution and transaction identifiers. Existing transaction history is bounded and reports aggregate in SQL. No infinite request loop was demonstrated.

All ordinary testing should use local fixtures. The demo acceptance checks deliberately use only two browser viewports and small metadata results. Monitor the new project's network transfer before rehearsals and after data-heavy operations. No paid subscription or service is enabled.

## Verification and report

The current test results, database counts/constraints/totals, backup validation, deployment ID, APK checksum and remaining physical checks are recorded privately in `database/backups/presentation-demo/FINAL-REPORT.md`.

Standard APK location:

```text
C:\Users\VT COMPHONERO SERVER\OneDrive\Pictures\Desktop\snack-time-pos\frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

Ignored configuration backups for the original cloud connection, vault and build profile are in `database/backups/presentation-demo/original-config/`. Preserve these with the original database backup. Do not publish them.
