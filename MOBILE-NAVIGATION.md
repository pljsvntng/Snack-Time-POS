# Mobile bottom navigation

This document records version 1.1.4. For the current presentation APK 1.1.5 and its separate demo database, see [PRESENTATION-DEMO.md](PRESENTATION-DEMO.md). The artifact size/checksum below describe the historical 1.1.4 build.

Updated November 8, 2026, Asia/Manila. Debug APK **1.1.4**, version code **6**.

## Behavior

Below the existing 1200px desktop breakpoint, fixed bottom tabs replace the mobile sidebar. Administrators see **Home, POS, Products, History, More**. Cashiers see **POS, History, More**. Home uses `/dashboard`; History uses `/transactions`; other existing routes are unchanged. The currently selected section uses an orange icon highlight and active links expose `aria-current="page"`. More stays highlighted on its secondary routes.

More opens a scrollable, focus-trapped dialog containing authorized Inventory, Reports, Users and Settings links, account information, Log out, and (on Android) Synchronization status. It closes through its 44px close button, backdrop, Escape, native Android back event, or selecting a destination. Focus returns to the trigger. Synchronization status opens and focuses the existing status disclosure; it preserves both retry controls and online sign-in.

At 1200px and above in the web application, the existing desktop sidebar remains. Android tablets keep centered bottom tabs even at wider widths, retaining the full width for products/cart; the existing side-by-side layout applies at sufficient height and width. No package was added; icons reuse Lucide and navigation uses existing React Router links.

The navigation row is 64px high including its top border, with accessible text/icons and an additional bottom safe-area inset when supplied by the browser. Each control exceeds the minimum 44px touch target. The main content reserves the same space. The floating order bar sits 12px above navigation. Cart sheets and payment/customization dialogs remain higher layers; bottom tabs are hidden while those modal layers are open. Existing native SystemBars insets, `viewport-fit=contain`, `adjustResize` and scrollable payment actions are retained. Real gesture navigation, three-button navigation and software keyboards require physical acceptance testing.

The existing CartProvider remains above route screens. Tab changes do not reload the document or clear the cart. Existing role protection stays in place, including offline authorization's cashier scope. No SQLite schema, encryption key, backend, PostgreSQL schema, synchronization engine, authentication policy, pricing or financial calculation was changed.

## Files changed

- `frontend/src/components/MobileNavigation.jsx`: role-aware bottom tabs, More sheet, account/actions and focus handling.
- `frontend/src/layouts/AppLayout.jsx`: reuse existing authorized link lists, preserve desktop sidebar, mount mobile navigation, open sync details.
- `frontend/src/components/SyncIndicator.jsx`: accept a reveal request from More and focus its existing summary.
- `frontend/src/index.css`: mobile navigation, safe-area/content/cart offsets, modal layering, More styling and scrolling; remove the old mobile drawer presentation.
- `frontend/src/android/back.js`: close More before navigating or minimizing; retain checkout protection and draft-save behavior.
- `frontend/android/app/build.gradle`: version 1.1.4 / code 6; application ID and signing configuration unchanged.
- `frontend/tests/responsive-smoke.cjs`: all tabs/routes, role restrictions, More focus/scroll/dismissal, active state, cart retention without reload, safe-area simulation, existing page/form/checkout checks and diagnostics.
- `frontend/tests/offline-browser.cjs`: More/native-back/sync entry, new tabs and existing offline checkout/restart regression.
- `frontend/tests/android-runtime.test.cjs`: regression proving Back closes More before navigation, save or minimize.
- `frontend/tests/offline/vite.config.mjs`: give the native-mocked test server its own dependency cache so concurrent web/native browser checks cannot share optimized modules from different configurations.
- `RESPONSIVE.md`, `ANDROID.md`, `MOBILE-NAVIGATION.md`: current navigation/build documentation.

## Verification

- `npm --prefix frontend test`: **PASS, 34 tests**, including atomic offline checkout, rollback, duplicate prevention, separate-process persistence, secure startup, and Android navigation.
- `npm --prefix frontend run build`: **PASS**, Vite production build.
- `TEST_REMOTE_API=https://snack-time-pos.onrender.com npm --prefix frontend run test:offline-ui`: **PASS**, including six phone/tablet sizes through 1280×800. Actual React UI, native event mocks and temporary file-backed Node SQLite: real initial administrator authorization/catalog, More dismissal through Back, More-to-sync details, synchronization retry/sign-in controls, offline search/cart/discount/cash checkout and receipt/history after two SQLite/application reopenings. No test sale was uploaded to PostgreSQL. This is not Android SQLCipher execution or a physical-device test.
- `TEST_REMOTE_API=https://snack-time-pos.onrender.com npm --prefix frontend run test:responsive`: **PASS, all 11 screen sizes and cashier navigation**. Covers 320×640, 360×800, 393×852, 412×915, 600×960, 768×1024, 800×1280, 1024×768, 1280×800, 852×393 and 1440×900. Every existing navigation destination, active state, More focus/scroll/dismissal, cart retention without reload, forms, checkout and overflow checks passed. Non-GET API requests other than login are blocked. Current cashier navigation uses the existing short-lived owner read-only session fixture, not a fresh cashier password login.
- A synthetic 34px safe-area test and 393×400 resized payment viewport check CSS offsets and action reachability; neither substitutes for Android system/keyboard testing.
- `npm --prefix frontend run android:prepare`: **PASS**, actual Render HTTPS API health check, Android-mode production build and Capacitor asset/plugin synchronization.
- `npm --prefix frontend run android:verify`: **PASS**, `lintDebug`, `assembleDebug`, `assembleDebugAndroidTest`; **0 lint errors, 17 warnings**. Instrumentation APK compiled; not executed on hardware.
- APK inspection: **PASS**, same application ID and signing certificate as the prior debug APK, SQLCipher libraries and encrypted-storage configuration retained, actual Render API and new bottom navigation packaged, test bridge/database-URL/private-key markers absent. Packaged JS/CSS bytes match the validated staging build. Both distributed APK copies have identical hashes.
- `git diff --check` and changed CommonJS test syntax checks: **PASS**.
- ADB: no connected device. Physical Android UI, native keyboard, gesture/three-button navigation, update persistence and device synchronization: **NOT TESTED**.

The first two responsive attempts timed out at development-server login startup. A fresh server subsequently rendered correctly. A later run exposed a test assertion reading More's active state before the asynchronous route render; the test now waits for the destination and active button. The synthetic safe-area test then caught the navigation border adding one pixel beyond the reserved content height; the control row now subtracts that border so the bar and reserved height match exactly. These failed attempts are not counted as passed checks.

Screenshots, responsive results and APK verification are in ignored `database/backups/bottom-navigation/`. Browser screenshots were reviewed for visible products, compact navigation and checkout clearance. This update has not been deployed to the Render web service.

## APK

Exact Windows location:

```text
C:\Users\VT COMPHONERO SERVER\OneDrive\Pictures\Desktop\snack-time-pos\frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

Identical copy: `database/backups/android-build-artifacts/snack-time-pos-cloud-debug.apk`.

Package: `com.snacktime.pos`. Version: **1.1.4 (6)**. Size: **43,293,376 bytes**.

SHA-256: `bb3ae7c62dc626ee26a9b2e9cd88e04250983ca9810335b321f1666a23246686`.

Install as an update to the existing app. Do not uninstall or clear storage. No database, app data or encryption key was reset.

## Physical acceptance checklist

1. Install the update over the existing APK; confirm saved receipts and pending sales remain.
2. Test each authorized tab, active highlight, More links/account/logout, Back, Escape (if a keyboard is attached), backdrop dismissal and rotation. Ensure cashier accounts cannot access administrator pages.
3. Build a cart, switch to History and back to POS, and verify quantities/options/discount remain. Complete cash checkout and reopen its receipt.
4. Check gesture and three-button navigation, portrait/landscape, search keyboard, payment keyboard, checkout action and scrolling on a phone and tablet. Ensure system controls, tabs and order bar do not overlap.
5. In More, open Synchronization status; check pending count, retry and online sign-in. Keep storage/data warnings visible until resolved and explicitly acknowledged.
6. In airplane mode, perform an authorized test cash sale; restart the app and confirm the receipt remains. Reconnect and verify that the pending sale uploads once using the existing synchronization engine. Use an agreed test sale because this step changes business records.

Debug build only. Physical acceptance is still pending; no claim of physical-device testing is made.
