# Phase 7 — Snack Time POS Android APK

Verification date: **1 November 2026, Asia/Manila**. Reuses the existing React/Vite, Express, Neon PostgreSQL, encrypted SQLite and Phase 6 delivery engine. No backend schema migration, password reset, production sale, database reset or paid service was needed for this phase. Physical-device testing was deferred at the owner's request.

## Application and security configuration

| Setting | Value |
|---|---|
| Name / application ID | Snack Time POS / `com.snacktime.pos` |
| Android version | `versionCode 2`, `versionName 1.1.0` |
| Web assets | Production Vite output `dist`, copied into Android assets |
| Backend | `https://snack-time-pos.onrender.com/api` |
| Minimum Android / target / compile SDK | API 24 (Android 7) / 36 / 36 |
| WebView | Updated Android System WebView/Chrome, version 104 or newer |
| Permissions | INTERNET, ACCESS_NETWORK_STATE and AndroidX's application-private signature permission for non-exported dynamic receivers |
| Storage | Existing app-private SQLCipher database `snack_time_offline`; existing Keystore-protected secret |
| Debugging / logs | WebView debugging disabled; Capacitor logging disabled; release `debuggable false` |
| Backup / transfer | Existing app backup and device-transfer exclusions retained |

The API comes from ignored `frontend/.env.android.local`, using `VITE_API_URL`. The build checks the actual HTTPS PostgreSQL health endpoint and refuses missing, loopback, insecure and example URLs. Database credentials and the server's private signing key remain outside the frontend. Capacitor's internal `https://localhost` origin serves packaged application assets; backend requests use the Render URL. There is no remote `server.url` or Vite development server in the APK.

BrowserRouter and every existing POS route remain in place. Back closes the frontmost dialog or drawer, leaves submitting payments open, and returns through application routes. At the root it saves the offline draft before minimizing. Failed saves keep the app open with an error. Screen rotation retains the Activity/React state through the existing configuration-change policy.

Capacitor's built-in SystemBars support handles native system/keyboard insets with `viewport-fit=contain`; `adjustResize` keeps forms and payment controls above the keyboard. The existing responsive layouts, colors and typography are preserved. Launcher/adaptive/themed icons and the splash screen now reuse the existing orange Lucide Cookie brand mark. The original generated resources remain available in the project.

Android's existing Print buttons open a small native `SnackTimePrint` bridge to `PrintManager` and the current WebView print adapter. Browser printing retains its existing behavior. Android print-service/PDF/printer behavior still requires a device check; no printer or storage permissions were added.

## SQLite startup and update safety

Startup continues to initialize the persistent encrypted database before login. Concurrent calls share one initialization. A failed open closes the connection safely and permits retry; the sign-in screen displays a dedicated recovery message and **Retry secure storage** button. Missing encryption keys fail closed. No recovery path deletes, recreates, imports over, or clears an existing financial database.

The native connection requests the existing schema version 2; the existing atomic SQLite migrations/backfill remain responsible for table upgrades. Database name, app ID and Keystore handling are unchanged. Sales, immutable delivery payloads and deductions remain atomic. Native JWTs are stored in encrypted SQLite, and passwords use the existing one-way local verifier. Browser localStorage is not used for Android financial data or Android tokens.

The version code increased so the APK can update the prior build. Updates must use the same application ID and signing certificate. Use **Install update** or `adb install -r`; keep app data intact. Never uninstall, clear storage or downgrade a device that has pending receipts. The debug signing certificate is for testing and is not a production signing identity. No production keystore or signing password was created or hardcoded.

## Installed toolchain and dependencies

Already installed and reused: Node **24.18.1**, npm **11.16.0**, JDK **21.0.7**, Android SDK Platform **36**, Build-Tools **36.0.0** (35.0.0 is also present), Android Platform-Tools, Gradle Wrapper **8.14.3**, Android Gradle Plugin **8.13.0**.

Already installed npm packages: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` **8.6.0**; `@capacitor/app` **8.1.2**; `@capacitor/network` **8.0.1**; `@capacitor-community/sqlite` **8.1.1**. React **18.3.1** and Vite **5.4.21** are retained. **No additional npm packages were required.** SystemBars is built into Capacitor; printing uses Android's platform API.

PATH also contains Java 25. The build helper deliberately selects and verifies JDK 21 for the retained Gradle toolchain. Android Studio and an emulator were not found in standard locations, and ADB reported no connected device. The command-line build does not require Android Studio.

## Build commands and artifacts

From the project root:

```powershell
npm --prefix frontend run android:doctor
npm --prefix frontend run android:prepare
npm --prefix frontend run android:verify
```

`android:prepare` builds production Android assets, checks HTTPS readiness and runs Capacitor sync. `android:verify` materializes native sources/assets outside OneDrive, then runs `:app:lintDebug :app:assembleDebug :app:assembleDebugAndroidTest --no-daemon`. It verifies JDK/SDK paths and correctly escapes the Windows drive separator in `local.properties`. Strict lint remains enabled. `android:debug` runs the shorter APK-only build; run prepare first after frontend changes.

Expected standard output, populated after a successful build:

```text
C:\Users\VT COMPHONERO SERVER\OneDrive\Pictures\Desktop\snack-time-pos\frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

An identical copy, metadata, compiled instrumentation APK and lint reports are kept in ignored `database/backups/android-build-artifacts/`. `build.json` contains creation time, SHA-256, toolchain and the external staging directory. Native compilation occurs under `%LOCALAPPDATA%/SnackTimePOS/builds` to avoid OneDrive file-lock/reparse-point problems. Source product images and business databases are not moved or deleted.

Final Gradle/lint/artifact verification: **PASS**. Both debug APK and Android-test APK compiled successfully. Lint reported **0 errors and 15 nonfatal warnings**, primarily retained template resources and newer compatible-tool/dependency notices. The Windows property escaping error was fixed rather than suppressed. Remaining build notices include legacy `flatDir` repositories, an SDK XML-version warning and unstripped SQLCipher symbols. The existing compatible toolchain is retained. The debug certificate matches the previous APK; package/version, ZIP alignment, HTTPS endpoint, encrypted native library, minimal permissions and private/test-material exclusion were inspected.

APK SHA-256 and full build metadata are in ignored `database/backups/android-build-artifacts/build.json`; the APK copies have identical hashes. Unused biometric/fingerprint permissions brought in by the optional SQLite dependency were explicitly removed from the merged manifest. Biometric authorization is not enabled; the existing Keystore-backed encryption secret is unchanged. AndroidX's generated signature-only receiver permission remains because it protects internal receiver registration and grants no camera, location, contacts or external-storage access.

## Executed testing and device boundaries

**42 backend tests and 25 frontend tests passed.** They include existing product/inventory/user/checkout/discount/report behavior, real PostgreSQL transactions, duplicate protection, fault/retry recovery, immutable SQLite receipts, separate-process persistence, schema upgrade/backfill, safe initialization retry, Android back-handler rules and diagnostic redaction. The browser Android-flow test uses real file-backed SQLite and native event mocks; it verified failed startup/retry, online administrator authorization, offline cashier UI, five sizes, back/draft/minimize behavior, cash checkout and two reopenings without uploading a test sale to production. Current frontend layouts passed at **11 screen sizes**, including all administrator screens, phone landscape and tablet side-by-side checkout. Live deployed browser regression checks also passed. Browser test proxy cleanup and error reporting were hardened after a failed test emitted an authorization header; future diagnostics redact bearer values and database URLs.

| Requested test | Automated evidence | Physical Android |
|---|---|---|
| 1. React production build | PASS — production Vite build and Android-mode build | N/A |
| 2. Capacitor synchronization | PASS — existing project updated, three package plugins synchronized | N/A |
| 3. Android Gradle build | PASS — strict lint, debug APK and instrumentation APK compilation | N/A |
| 4. Application startup | PASS — browser startup/recovery; native startup test prepared | NOT TESTED |
| 5. Login | PASS — actual administrator HTTPS login/offline authorization; cashier fixture authentication | NOT TESTED |
| 6. Administrator dashboard | PASS — API/UI checks | NOT TESTED |
| 7. Cashier dashboard/POS | PASS — cashier POS/history and role restrictions | NOT TESTED |
| 8. Product management | PASS — isolated API CRUD and browser forms | NOT TESTED |
| 9. Inventory management | PASS — isolated API adjustments/recipes and browser forms | NOT TESTED |
| 10. Offline checkout | PASS — real SQLite engine and React cash checkout | NOT TESTED |
| 11. SQLite persistence | PASS — file/process restarts and upgrade/backfill | NOT TESTED — native SQLCipher probe compiled separately |
| 12. Online synchronization | PASS — Express/PostgreSQL delivery and retry regression suite | NOT TESTED — native connectivity callbacks |
| 13. Duplicate prevention | PASS — concurrent/repeated submissions and lost acknowledgments | NOT TESTED |
| 14. API connectivity | PASS — actual Render HTTPS health/login/catalog | NOT TESTED — phone's network |
| 15. Android navigation | PASS — event-mocked UI and handler tests | NOT TESTED — physical back/gesture |
| 16. Phone layout | PASS — Android-flow phone/landscape browser viewports | NOT TESTED — real keyboard/cutout |
| 17. Tablet layout | PASS — Android-flow tablet browser viewports | NOT TESTED — real tablet |
| 18. Application restart | PASS — separate-process SQLite and two UI reopenings | NOT TESTED — Android process/reboot/update |
| 19. Network disconnection | PASS — browser API aborts and worker failure simulations | NOT TESTED — airplane mode |
| 20. Network reconnection | PASS — worker retry/resume through Express/PostgreSQL | NOT TESTED — Android Network events |

The live cashier account `juan` retains its existing password. The owner's saved test password for that account is stale, so current live cashier permissions are checked with a short-lived owner test session; this is not a claimed fresh password login for that account. No authentication bypass was added to the application. Native printing, native SQLite bindings, actual cold starts on a phone, screen insets and app-update persistence remain hands-on acceptance work.

The generated Android instrumentation test was corrected from the template's wrong package assertion and expanded to check package/permissions, disabled backups/cleartext, startup, plugin availability and the existing encrypted SQLite database. It performs read-only checks and creates no business sales. Compilation is distinct from execution: it has **not run on a device**.

## Installing on an Android phone or tablet

1. Transfer `app-debug.apk` by USB, a private file transfer or another trusted local method.
2. On the device, open it with the file manager. If Android requests it, permit that file manager to install unknown apps, install the update, then turn that permission off again. Do not disable Play Protect or other platform security checks.
3. If an older Snack Time POS is installed, choose **Update**. If Android reports a signing mismatch, stop and retain the existing app/data; use the matching signing key rather than uninstalling.
4. Open Snack Time POS while online and sign in with the existing administrator/cashier password. Allow first authorization/catalog preparation to finish. Render may need time to wake up.
5. Choose **Use offline POS**, sign in with the authorized account, then test in a suitable QA environment: airplane mode, product search/options, discount, cash sale, pending indicator, close/reopen and saved receipt/history. Restore internet and verify one central order, original total and stock movements. Use genuine sales in production; artificial test sales should use an isolated QA deployment.
6. Test back through dialogs, the cart, navigation and root; rotate during an open cart; enter payments with the keyboard visible; inspect status/navigation bars and cutouts; open Android Print/Save as PDF. Keep unsynchronized records intact.

Optional USB installation from the project root:

```powershell
& '.\database\backups\android-sdk\platform-tools\adb.exe' devices -l
& '.\database\backups\android-sdk\platform-tools\adb.exe' install -r '.\frontend\android\app\build\outputs\apk\debug\app-debug.apk'
```

To run the prepared read-only native smoke tests later, install the app first, then:

```powershell
& '.\database\backups\android-sdk\platform-tools\adb.exe' install -r '.\database\backups\android-build-artifacts\app-debug-androidTest.apk'
& '.\database\backups\android-sdk\platform-tools\adb.exe' shell am instrument -w com.snacktime.pos.test/androidx.test.runner.AndroidJUnitRunner
```

Only authorize USB debugging on a trusted computer. The tests open the app's sign-in screen and inspect encryption; they do not authorize a cashier or process a sale.

## Windows 10 setup if Android Studio is wanted

1. Download the Windows installer from [Android Studio](https://developer.android.com/studio/install). Use Otter 2025.2.1 or newer for Capacitor 8 and follow the standard setup wizard. Android Studio is optional for this already-working command-line build.
2. In SDK Manager, ensure Android SDK Platform 36, Build-Tools 36.0.0, Platform-Tools and current Command-line Tools are installed. Retain the existing SDK path or update ignored `frontend/android/local.properties` to the new path. Windows drive colons must be escaped, for example `sdk.dir=C\:/Android/Sdk`.
3. In Gradle settings select JDK 21. This workspace already has `C:\Program Files\Java\jdk-21`. If JDK 21 is missing elsewhere, install a current JDK 21 LTS and set `JAVA_HOME` to it. A separate global Gradle installation is unnecessary because the Wrapper is included.
4. Open the existing `frontend/android` directory or run `npm --prefix frontend run android:open`.
5. For an emulator, use Device Manager to install an API 24+ image with a current WebView and enable supported hardware virtualization. No emulator or Android Studio installation was performed automatically. Alternatively enable Developer options/USB debugging on a test phone and authorize this computer.

## Modified and created files

- `.gitignore`: exclude private signing keystores.
- `frontend/capacitor.config.json`, `index.html`: secure logging/WebView policy, contained system insets and offline WebView error page.
- `frontend/android/app/build.gradle`, `app/src/main/AndroidManifest.xml`, `java/com/snacktime/pos/MainActivity.java`: update version, release debugging policy, keyboard mode, splash/edge handling and native print registration.
- `frontend/android/app/src/main/java/com/snacktime/pos/SnackTimePrintPlugin.java`: Android print bridge.
- Native resources: `values/styles.xml`, `values/snacktime_colors.xml`, `drawable/snacktime_cookie.xml`, `drawable/snacktime_brand.xml`, launcher variants in `mipmap-anydpi`, `mipmap-anydpi-v26`, `mipmap-anydpi-v33`.
- `frontend/public/webview-error.html`: bundled recovery instructions for an outdated WebView.
- `frontend/scripts/android-toolchain.cjs`, `compile-android-windows.cjs`, package scripts: toolchain checks, strict build/lint/test compilation, standard APK output and artifact reports.
- `frontend/src/android/NativeNavigation.jsx`, `back.js`, `App.jsx`: native back/print integration.
- `frontend/src/offline/open-store.js`, `runtime.js`, `android-driver.js`; `context/AuthContext.jsx`, `pages/Login.jsx`: initialization coalescing, connection reuse/cleanup and safe retry UI.
- `frontend/src/services/api.js`, `src/index.css`: bounded API waits and recovery/status styling.
- `frontend/tests/android-runtime.test.cjs`, `tests/offline-browser.cjs`, `tests/offline/app-browser.mjs`, `tests/offline/vite.config.mjs`, `tests/responsive-smoke.cjs`, `tests/browser-smoke.cjs`, `tests/safe-error.cjs`, `tests/safe-error.test.cjs`, native instrumentation test: recovery/navigation/browser/native smoke coverage and redacted diagnostics.
- `ANDROID.md`: this report. SDK paths, built APKs, private configuration and test artifacts remain ignored.

No Phase 8 work is included. References: [Capacitor Android](https://capacitorjs.com/docs/android), [Capacitor 8 toolchain](https://capacitorjs.com/docs/updating/8-0), [SystemBars insets](https://capacitorjs.com/docs/apis/system-bars), [App back handling](https://capacitorjs.com/docs/apis/app), [Android printing](https://developer.android.com/training/printing/html-docs).
