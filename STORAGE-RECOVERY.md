# Android encrypted-storage startup fix — 1.1.1 (version code 3)

**Status: code patched; physical-device confirmation pending.** ADB showed no connected device. The owner chose automated checks and will test the update on the affected physical phone. The issue is not declared resolved on that phone.

## Root-cause investigation

The reported message comes from the application's own `isDatabaseEncrypted` check in `android-driver.js`. It ran immediately after native `open()`, before the application created any schema. The installed plugin's Android file verifier first opens a separate reader **without a key** and reads the database version; if that succeeds it reports `false`. An untouched/empty database can pass that probe before an encrypted page is committed. Checking an uninitialized file at this point therefore can block first startup despite a keyed SQLCipher connection.

This startup-ordering defect matches the reported failure. The exact file/header state on the affected phone could not be inspected without an ADB connection, so its device-specific diagnosis still needs confirmation. The update includes bounded native diagnostics to distinguish an empty file from missing keys, disabled encryption, unkeyed connections and native API failures.

Inspection confirmed matching Capacitor 8 packages, SQLite plugin 8.1.1, SQLCipher Android 4.17.0, encrypted native configuration, and the same database name, package ID and Keystore-backed `EncryptedSharedPreferences` handling. Plugin mode `secret` means use the protected stored random secret; it is not a hardcoded database password. Biometric authentication remains disabled and is not required for the existing Keystore configuration.

## Fix and preservation guarantees

Startup now:

1. Requires native encryption configuration and validates the bridge's boolean results.
2. Retains an existing secret. It generates a random first-install secret only when no database, WAL or rollback journal exists. Missing-key cases with existing artifacts fail closed; they never replace the key.
3. Opens the existing named connection using encrypted mode and the stored secret.
4. Requires `PRAGMA cipher_status` to return **1** before any initialization write. The installed SQLCipher version supports this check.
5. Creates only the non-sensitive `_snacktime_storage_guard` table if absent. This materializes a first encrypted page; it does not contain or change users, receipts, inventory, tokens, passwords, pending payloads or `user_version`.
6. Closes/checkpoints the handle, then independently requires the plugin's **file encryption verification** to pass.
7. Reopens with the same stored key, reconfirms the keyed handle and reads the schema before returning access to the POS store.

Failures close the connection and retain data. There is no decrypt, rekey, delete, import-overwrite, storage reset, plaintext fallback or bypass of encryption checks. A retry can recover the empty database plus stored key left by the previous failed first launch. Existing encrypted installations retain their original key and financial data; the additional guard table is additive.

Initialization also routes result-returning `journal_mode` and `busy_timeout` PRAGMAs through the query API rather than Android's non-query `execSQL` path. Foreign keys, WAL, FULL durability and timeout settings remain enabled. Existing atomic checkout/schema-upgrade and delivery rules are unchanged.

## Safe diagnostics

The manually registered native `SnackTimeStorageDiagnostics` plugin reads only the fixed app-private database's presence, byte lengths, WAL/journal presence, header classification and Android SDK level. It does not return file bytes, row data, keys, Keystore aliases, authentication tokens or passwords. Its logger accepts only fixed stage and error-code enums and ignores extra input fields. Raw native exception messages are not logged or returned by the new opening routine. General Capacitor logging remains disabled.

Examples of safe stages: `keyed_handle`, `materialize`, `persisted_file`, `ready`. Error codes include `MISSING_KEY`, `HANDLE_UNKEYED`, `FILE_NOT_ENCRYPTED`, `CONFIG_DISABLED`, `MALFORMED_RESULT`, `NATIVE_FAILURE`. A failure displays its stage/code on the secure-storage screen.

If the phone is later connected and authorized, these commands are read-only and do not clear logs or app data:

```powershell
& '.\database\backups\android-sdk\platform-tools\adb.exe' devices -l
& '.\database\backups\android-sdk\platform-tools\adb.exe' logcat -d -s 'SnackTimeStorage:I' '*:S'
```

Open the updated app and press Retry once before collecting its filtered logs. Share the storage code and filtered `SnackTimeStorage` messages rather than a full logcat dump.

## Changed files

- `frontend/src/offline/secure-android-open.js`: ordered keyed-handle/page/file verification and safe error codes.
- `frontend/src/offline/android-driver.js`: use that native opening routine; original transaction/data interfaces retained.
- `frontend/src/offline/store.js`: Android-compatible query calls for row-returning PRAGMAs.
- `frontend/android/app/src/main/java/com/snacktime/pos/SnackTimeStorageDiagnosticsPlugin.java`: read-only metadata and allowlisted Logcat diagnostics.
- `frontend/android/app/src/main/java/com/snacktime/pos/MainActivity.java`: register the diagnostic plugin.
- `frontend/android/app/build.gradle`: version 1.1.1/code 3 and a test-only dependency matching the existing SQLCipher library.
- `frontend/tests/secure-android-open.test.cjs`: eight startup/security regression tests.
- `frontend/android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java`: native empty-file reproduction, encrypted reopen and diagnostic-plugin checks for later device execution. Its temporary encryption fixture is uniquely named under app cache; it never deletes or resets the business database.
- `STORAGE-RECOVERY.md`, `ANDROID.md`: diagnosis and acceptance procedure.

## Test evidence and limits

| Check | Result |
|---|---|
| Eight new opening/security/Android-PRAGMA regression cases | PASS — mocked native contracts plus real SQLite for PRAGMA initialization |
| Complete frontend regression suite | PASS — 33 tests |
| Complete backend regression suite | PASS — 42 tests, including Express/PostgreSQL synchronization |
| Offline React checkout, discounts, drafts and receipt/history after two reopenings | PASS — real SQLite with a test-only browser/native bridge |
| Strict rejection of missing keys, unkeyed/malformed handles and failed file checks | PASS — automated cases |
| Previously created empty file reuses existing secret | PASS — automated native-contract model |
| Native empty-file SQLCipher reproduction and startup probe | NOT EXECUTED — requires an Android device |
| Actual phone persistence, checkout, restart and reconnect/upload | NOT TESTED — owner will perform physical acceptance |
| Updated production Android assets, APK and native-test APK compilation | PASS — version 1.1.1 / code 3 |
| Strict Android lint | PASS — no errors; existing nonfatal tool/template notices retained |

The host's Node SQLite tests are not proof that SQLCipher executed on the phone. No emulator result is substituted for the physical-device requirement. No original PostgreSQL/MariaDB records, app data, keys or pending receipts were reset or deleted. Test writes use isolated fixtures; the UI test confirms no offline test sale was uploaded into production.

## Update APK and physical acceptance

The updated debug APK uses the same app ID and signing identity and a higher version code:

```text
C:\Users\VT COMPHONERO SERVER\OneDrive\Pictures\Desktop\snack-time-pos\frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

Build commands remain:

```powershell
npm --prefix frontend run android:prepare
npm --prefix frontend run android:verify
```

The rebuilt APK uses the same debug signing certificate as the prior installation. Build metadata/checksum and the compiled device-test APK are under ignored `database/backups/android-build-artifacts/`. The added instrumentation case required matching test-only SQLCipher and AndroidX SQLite interfaces; both are the versions already used by the production plugin. No production encryption dependency or key format was changed.

1. Transfer the new APK to the affected phone and choose **Update**. Do not uninstall the existing app, clear storage, remove keys or downgrade it. If Android reports a signing mismatch, stop and retain the current installation/data.
2. Open Snack Time POS. Confirm secure initialization reaches the login screen. Close and reopen it at least twice. If the error remains, record the new **Storage code**; do not clear storage.
3. Sign in online with the existing account and complete offline preparation. Check that any previously saved receipts/pending count remain present.
4. Select offline cash POS, disable internet and verify products/search/cart/discounts. For checkout use a genuine production sale or a dedicated QA deployment; do not create/delete artificial production sales.
5. Record its receipt number/amount and pending count, close/reopen the app, sign in offline and verify the same receipt, totals and stock deductions. A phone reboot should retain them as well.
6. Restore internet and wait for the API to become reachable. Verify the pending count changes only after acknowledgment, one central transaction appears, and its original total is unchanged. Retry synchronization and confirm it does not duplicate the sale/deduction.

Report the startup outcome and any safe storage code. **Physical-device success is still required before calling this issue resolved.**

Primary references: the installed SQLite plugin's `Database.open`, `UtilsSQLCipher.getDatabaseState`, and `isDatabaseEncrypted` implementations; [plugin Android source](https://github.com/capacitor-community/sqlite/blob/master/android/src/main/java/com/getcapacitor/community/database/sqlite/CapacitorSQLite.java); [SQLCipher keyed-handle verification](https://www.zetetic.net/sqlcipher/sqlcipher-api/#cipher_status).
