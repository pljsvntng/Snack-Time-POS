# Android SQLite offline POS

PostgreSQL on Neon remains the online system of record. The online POS is deployed at https://snack-time-pos.onrender.com on Render Free. Android has a separate encrypted SQLite database for offline cash sales and is configured with the actual HTTPS API. The existing browser POS remains online. No synchronization or local-sale upload is enabled in this phase; automatic synchronization is still the next phase.

## Implemented operations

- Initial online authorization on the Android device, followed by offline sign-in with the previously authorized account.
- Cached categories/products/options/recipes, local search, images where available, discounts and business settings.
- Persistent per-cashier drafts, cash-only checkout, exact monetary calculations, product/ingredient deductions, immutable local receipts and inventory movements.
- Local transaction history, plus up to 100 previously cached server transactions belonging to the signed-in cashier. All local sales are retained without a history limit.
- Reopening after app/process termination requires sign-in again; drafts and committed sales remain in SQLite. Account changes do not expose another cashier's transactions or drafts.

The Android login screen explicitly selects Online POS or Offline cash POS. The app never silently converts a failed server sale into a local sale. An ambiguous online checkout response instructs the cashier to check server transaction history before retrying or starting an offline sale.

## Storage and atomicity

`frontend/src/offline/store.js` contains the application/storage rules. `android-driver.js` uses the Capacitor SQLite plugin with SQLCipher encryption and its Android Keystore-protected encryption secret. No unencrypted browser-storage fallback is used for native financial data.

SQLite foreign keys are enabled. WAL, FULL synchronous durability and a busy timeout are configured. Each checkout uses one database transaction for the order, line snapshots, stock deductions, inventory audit movements and draft removal. An error rolls back every write. Triggers prevent accidental modification/deletion of completed local sales, line snapshots and audit movements.

Currency and fractional ingredient quantities are stored as integer cents/hundredths. Percentage discounts round half up using integer arithmetic; React cart totals follow the same rule. Every attempt uses a saved UUID. The unique request ID and request fingerprint return the existing receipt on an identical retry and reject conflicting reuse. UUID receipt numbers distinguish local receipts from central order numbers. SQL uniqueness and guarded stock updates also protect against simultaneous application processes.

The database resides in Android app-private storage. Its random encryption secret is retained by the native plugin using Android Keystore-protected preferences. Missing keys or encryption failures fail closed; existing databases are not erased or silently recreated. App backup and device-transfer extraction are disabled to prevent copying unusable databases without their device keys. Normal app closure, process termination and device restarts preserve app-private data. Uninstalling the app, clearing its data, losing the device, or storage hardware failure can still destroy unsynchronized records. Do not clear/uninstall an app containing local sales.

Fonts are bundled with the application. Cached photo previews are size-bounded; photos are not duplicated into draft rows. Missing photos fall back to existing product icons, without blocking names, prices, search or checkout.

## Local authorization

After a successful server login, the server signs a seven-day, device-bound RSA authorization grant. The Android bundle pins the public verification key; the private signing key stays on the server. Signed scopes permit POS and the user's own history. Offline navigation intentionally exposes those cashier functions even for a server administrator; online administration remains available after online sign-in.

No plaintext passwords or server bcrypt hashes are exported into SQLite. A local verifier uses PBKDF2-HMAC-SHA256 with 600,000 iterations and a random per-enrollment 256-bit salt. Five failed local attempts trigger a five-minute lockout stored in SQLite. Local sessions remain in memory for at most eight hours and never outlive the grant. A process restart requires password verification; returning after five minutes in the background locks the UI. Online tokens on Android are stored in the encrypted database rather than localStorage.

The app rejects clock rollback and expired/forged/other-device grants. An online rejection revokes the cached local authority while retaining financial records. A successful online authorization can renew the verifier without resetting the catalog, local stock or sales. If full catalog preparation fails, a previously prepared device can renew authorization against its existing data. The app cannot learn remote user revocations while disconnected; the seven-day grant bounds that exposure. Rooted devices, maliciously modified app binaries, deliberate clock tampering, and physical hardware compromise are outside these software-only guarantees.

The server performs a repeatable-read, read-only bootstrap. It exports no password hashes and caches only the user's own server history. Once any local sale exists, reauthorization does not overwrite the catalog/stock snapshot or erase deductions. Local stock is a snapshot, not a reservation on central inventory; other devices can sell the same central stock. Global stock reconciliation is intentionally deferred to the synchronization phase.

## Server signing key

A private key was created locally in ignored `backend/keys/offline-auth-private.pem`. Its public key is in `frontend/src/offline/server-public-key.json`.

```powershell
npm --prefix backend run offline:keys
```

This command retains an existing private key and exports its public key for Android builds. Do not commit the private key. Keep it stable and backed up. Changing the signing key requires rebuilding/reauthorizing devices. On Render the private PEM must be a persistent secret environment value (`OFFLINE_AUTH_PRIVATE_KEY`), not a key generated on its ephemeral filesystem. The public key compiled into Android must correspond to that same private key.

## Android build and first authorization

The Capacitor Android project is in `frontend/android`. App assets are bundled locally; no remote `server.url` is configured. Native online requests require a real HTTPS API address, with no loopback/default/placeholder URL in a production APK.

Render Free plus Neon Free have been deployed and verified. The ignored `frontend/.env.android.local` uses:

```text
VITE_API_URL=https://snack-time-pos.onrender.com/api
```

Then:

```powershell
npm --prefix frontend run android:prepare
npm --prefix frontend run android:open
```

The preparation command validates the endpoint and its live PostgreSQL health response, builds the Android-specific assets, and syncs native plugins. It refuses missing/HTTP/loopback/reserved example or test addresses. See `DEPLOYMENT.md` for account and migration steps. Set up JDK 21 and an Android SDK with API 36. For native compilation:

```powershell
cd frontend/android
./gradlew.bat :app:assembleDebug --no-daemon
```

On this Windows workspace inside OneDrive, use `npm --prefix frontend run android:debug` after `android:prepare`. It materializes the native project, assets and native plugin sources under `%LOCALAPPDATA%/SnackTimePOS/builds` before invoking Gradle, avoiding OneDrive reparse-point/file-lock failures. It does not delete or rewrite the source images. The tested debug APK is copied to ignored `database/backups/android-build-artifacts/snack-time-pos-cloud-debug.apk`, with its checksum in `build.json`. It uses the actual Render API and is for physical-device acceptance testing; synchronization and release signing are still pending.

A local Android SDK was installed under the ignored `database/backups/android-sdk` build-tools folder, with its path in ignored `frontend/android/local.properties`. The native Android project and SQLCipher plugin compiled successfully into a debug APK. Android assets now use the verified actual Render API. A release signing workflow and physical Android acceptance tests remain required before production distribution. No physical Android device was used to test SQLCipher/Keystore or power cycling.

## Verification

```powershell
npm --prefix frontend test
npm --prefix frontend run test:offline
npm --prefix frontend run test:offline-ui
npm --prefix frontend run test:browser
npm --prefix backend test
npm --prefix frontend run build
```

The offline storage tests use actual SQLite files with the exact production storage/checkout/authentication logic. The Node SQLite adapter is test-only and unencrypted; it does not substitute for testing Android SQLCipher itself. Tests create fake financial data in temporary files and remove them afterward.

Tests demonstrate:

1. A checkout committed in one application process remains available, with identical receipt/options/discount/change, in a separately launched process.
2. Termination during the transaction leaves no partial sale or deduction and preserves the draft; a later retry succeeds once.
3. A lost commit reply can be retried using the durable ID without another sale or deduction.
4. Injected write failure rolls back all financial and stock writes.
5. Forged, expired, wrong-device and previously unauthorized logins are rejected; lockout survives restart.
6. Cash-only validation, prices, required choices, immutable receipts, stock exhaustion, and repeated-ID conflicts are enforced.
7. Another cashier cannot see the sale; original receipt settings survive subsequent authorization/catalog changes.
8. Renewing authorization changes the verifier without resetting stock or deleting local sales.
9. Two separate processes cannot sell the same last product.

The offline UI test uses a test-only HTTP bridge to real SQLite in place of the native plugin. It uses the real server-signed grant, real React screens and local engine. It authorizes online, disables server access, restores a draft after SQLite/application restart, completes a cash sale, restarts again and opens the saved receipt/history. It confirms that the sale was not uploaded to PostgreSQL. This bridge/configuration lives only under `frontend/tests` and is not packaged into normal application builds.

The existing online browser/POS/API tests also pass. Physical Android SQLCipher/Keystore, real-device reboot, printer hardware, production hosting and automatic synchronization still require their respective deployment/device checks.

Primary implementation references: [Capacitor SQLite encryption](https://github.com/capacitor-community/sqlite/blob/master/docs/DatabaseEncryption.md), [native transaction API](https://github.com/capacitor-community/sqlite/blob/master/docs/SQLiteTransaction.md), [Android build requirements](https://capacitorjs.com/docs/getting-started/environment-setup).
