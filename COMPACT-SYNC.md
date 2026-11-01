# Compact Android synchronization bar

Implemented November 1, 2026. Android version 1.1.2 (version code 4).

## Behavior

The Android register now starts with a collapsed, 52px synchronization bar immediately below the POS header. It shows connection status, pending sales (or Synced), a retry control, and a disclosure arrow. Tablets also show the register mode inline. The existing orange, cream, and white theme is retained.

Tapping the summary or arrow opens scrollable details with connection and register status, pending sales, last successful upload, stock snapshot time, the latest error, retry, online sign-in, and the existing offline-mode action. Keyboard Enter/Space also work. Retry remains directly accessible while collapsed; both retry controls disable during an active synchronization attempt. All bar and detail buttons have a minimum 44px touch target. Reduced-motion preferences are respected.

Ordinary synchronization issues display an attention icon and an accessible attention label; their details remain available in the disclosure. Potential storage, encryption, persistence, or data-loss warnings remain visible outside the disclosure. During the mounted POS session, these warnings stay visible after a later status update clears the underlying error. An active warning cannot be dismissed; a retained warning requires explicit acknowledgement. No timer dismisses warnings. Existing durable synchronization error records are unchanged.

The retry event, connection-status subscription, and online/offline mode actions use the existing authentication and synchronization mechanisms. No changes were made to SQLite, encryption keys, checkout calculations, inventory deductions, the PostgreSQL backend, synchronization protocols, or account permissions.

## Files changed

- `frontend/src/components/SyncIndicator.jsx`: disclosure UI, accessible status announcements, direct retry, detail fields, and retained safety warnings.
- `frontend/src/layouts/AppLayout.jsx`: place the indicator immediately below the header, outside page padding.
- `frontend/src/index.css`: compact responsive layout, touch targets, scrolling details, tablet information, and warning styles.
- `frontend/android/app/build.gradle`: version code 4 / version name 1.1.2 for installing as an update.
- `frontend/tests/offline-browser.cjs`: responsive disclosure and control checks, warning retention, screenshots, product visibility measurements, and existing offline regression flow. Select an actually available product instead of assuming Plain Burger is in stock. Sanitize browser proxy errors.

## Verification

`npm --prefix frontend test`: 33 tests passed. Includes atomic checkout/rollback, stock deductions, duplicate prevention, password protection, encryption startup checks, and persistence across separate application processes.

`TEST_REMOTE_API=https://snack-time-pos.onrender.com npm --prefix frontend run test:offline-ui`: passed. This runs the actual React UI with a test-only native bridge and a temporary file-backed Node SQLite database. It verifies disclosure with mouse/touch-style clicks and keyboard, both retry event handlers, disabled retry while busy, automatic Online/Offline/pending updates, safety-warning retention and acknowledgement, online reauthorization, offline search/cart/discount/cash checkout, native-back event handling, and receipt/history after closing and reopening SQLite twice. Cloud orders are counted before and after; no local test sale is uploaded to production. It does not execute Android SQLCipher or upload test transactions to the live service.

Measured browser layout (CSS pixels, default text size):

| Viewport | Bar height | Search top, collapsed | Search top, expanded | First product top, collapsed |
| --- | ---: | ---: | ---: | ---: |
| 320 × 640 | 52 | 126 | 382 | 256 |
| 393 × 852 | 52 | 126 | 467 | 256 |
| 852 × 393 | 52 | 118 | 275 | 248 |
| 768 × 1024 | 52 | 126 | 494 | 258 |
| 1024 × 768 | 52 | 130 | 437 | 262 |

The first product is visible without scrolling at each size; no document horizontal overflow was detected. The normal bar may grow when enlarged text requires wrapping. Expanded details have their own bounded vertical scrolling area. Local screenshots and exact measurements are in ignored `database/backups/compact-sync-ui/`.

`TEST_REMOTE_API=https://snack-time-pos.onrender.com npm --prefix frontend run test:responsive`: passed at 11 sizes, from 320 × 640 through 1440 × 900, including phone landscape and portrait/landscape tablets. Checks covered the existing POS/cart, option and payment dialogs, navigation, seven administrator pages, forms, cashier navigation, and horizontal overflow. This broader suite exercises the web layout; the native-bridge suite above exercises the compact synchronization bar. No production writes were made.

`npm --prefix frontend run build`: passed with the existing large-JavaScript-chunk advisory. `npm --prefix frontend run android:prepare`: passed; bundled assets were rebuilt in Android mode against the actual Render HTTPS API and Capacitor synchronized SQLite, App, and Network plugins.

`npm --prefix frontend run android:verify`: passed (`lintDebug`, `assembleDebug`, `assembleDebugAndroidTest`). Lint reported zero errors and 17 warnings about dependencies/tool versions, icons, and unused resources. The native test APK was compiled, not executed on a device. After the final 44px warning-button correction, the same validated native staging project was refreshed with the final Capacitor assets and the three Gradle tasks passed again incrementally (6 executed, 267 up-to-date).

## Final debug APK

Exact location:

```text
C:\Users\VT COMPHONERO SERVER\OneDrive\Pictures\Desktop\snack-time-pos\frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

The identical convenience copy is `database/backups/android-build-artifacts/snack-time-pos-cloud-debug.apk`. Size: 43,521,032 bytes. Package: `com.snacktime.pos`, version code 4, version name 1.1.2.

SHA-256:

```text
9f19611e4a7409a51a9303d2fbf9691bfa1184d619d6fc08c8e568c1068e05da
```

APK signature verification passed and the signing certificate matches the prior debug APK. Static archive checks confirmed the final compact UI and 44px styles, the actual Render HTTPS API, bundled assets, and disabled WebView debugging. No test bridge, PostgreSQL connection URL, private key, or test administrator password marker was found in bundled JavaScript. APK copies and the recorded build checksum match. Detailed local results: `database/backups/compact-sync-ui/apk-verification.json`.

## Physical-phone checks still required

Physical Android UI testing of this redesign has **not** been performed. Browser native events and Node SQLite tests are not a substitute for Android WebView/SQLCipher testing.

1. Install the new APK as an **update** over the existing Snack Time POS app; preserve its app data.
2. Open POS in phone portrait and landscape. Confirm the bar starts collapsed, search is close below the header, and products are visible earlier. Repeat on a tablet if available.
3. Tap the status text and arrow to expand/collapse. Verify all details and actions can be reached, including with larger Android font settings.
4. Switch airplane mode on/off. Confirm Offline/Online updates, pending counts, and retry behavior. A slow Render Free cold start can temporarily show a connection error.
5. Confirm existing receipts remain available. With an authorized test sale, verify cash checkout offline, close/reopen the app, and check the saved receipt before reconnecting. Reconnect and verify the pending sale synchronizes once and appears once in server history. A real test sale changes business totals; use your normal test/refund procedure.
6. Confirm online sign-in remains accessible in expanded details. Do not uninstall or clear storage as part of testing.
