# Snack Time reference login implementation

The login page now follows the supplied reference image. All interface elements are real React controls connected to the existing authentication context and API.

## Integrated re-verification — November 11, 2026

Rechecked the current login together with the POS and management redesign. The full browser run exposed a React 18 development warning for the image's camel-case `fetchPriority` prop. `Login.jsx` now uses the browser's lowercase `fetchpriority` attribute. A separate browser check confirmed that the image retains `high` priority with no console warnings or errors; the production build also passed after this fix.

- Frontend tests: **37 passed, 0 failed**. Backend tests: **62 passed, 0 failed**.
- Full redesign acceptance: **11 viewport sizes passed**, including both order types, real checkout, saved receipts, dashboard totals, history filters, dialogs, navigation and cashier permissions. No JavaScript runtime errors were observed. The deliberately invalid login returned the expected HTTP 401.
- Dedicated login acceptance: **12 viewport sizes passed**, plus administrator/cashier authentication, role redirects, session reload, logout, required fields, keyboard controls, network errors and duplicate-submit prevention.
- Offline browser acceptance: passed secure-storage retry, draft/receipt restoration across SQLite restarts, cash checkout and the exact online → offline → online flow with the pending sale retained.
- Transaction-writing acceptance tests used disposable local PostgreSQL databases. The read-only shop smoke check verified **15 existing orders unchanged**; the offline UI fixture uploaded no sale to PostgreSQL.

Desktop POS and phone dashboard screenshots were visually reviewed. No deployment, APK rebuild or physical Android-device verification was performed.

## Appearance

- Full-height desktop composition: 58% storefront, 42% cream sign-in panel.
- Uses the **second supplied image** as a local storefront asset. The entire login screenshot is not used as a background. The 665 KB original PNG retains the supplied image quality and requires no external image service.
- Storefront fills its panel with `object-fit: cover`, preserving aspect ratio and the recognizable Snack Time sign. A lower dark overlay, golden accent, white welcome heading and tagline match the reference treatment.
- Cream `#FFF9F2` form surface, red `#C62828` sign-in action, deep red wordmark, subtle input borders and restrained shadows. Existing fonts and original SVG brand mark are reused.
- Full-bleed storefront on desktop/laptop; wide banner on portrait tablets/phones so the sign remains visible. Short landscape screens prioritize the form.
- Security icon/footer and Manila-year copyright.

## Authentication preserved

The page still calls `useAuth().login(username, password)`, using the existing `POST /api/auth/login`. Administrator/cashier routing, tokens, session storage, role protections, logout, PostgreSQL integration and Android offline authorization remain unchanged.

The form adds a local in-flight guard against duplicate submission, keeps the disabled/loading state, supports Enter, retains the accessible password visibility toggle, associates error messages with fields, and focuses authentication errors. Desktop username autofocus is retained; mobile does not automatically open the keyboard. Passwords are not stored by the page.

There is no existing Remember Me preference or self-service password-recovery endpoint. Those unsupported controls were omitted, as required by the brief. The existing automatic token/session persistence remains in place.

## Files in this change

| File | Change |
| --- | --- |
| `frontend/src/pages/Login.jsx` | Reference layout, supplied image, real sign-in controls, loading/error/focus handling and local duplicate-submit guard |
| `frontend/src/pages/Login.css` | New login-scoped theme, desktop composition and responsive styles |
| `frontend/src/index.css` | Removes superseded login styles; preserves shared eyebrow, spinner and generic error styles |
| `frontend/public/images/login/snack-time-storefront.png` | Supplied storefront image |
| `frontend/tests/redesign-browser.cjs` | Dedicated `--login-only` acceptance mode and updated sign-in label; test fixture email addresses |
| `frontend/tests/browser-smoke.cjs` | Updated sign-in label |
| `frontend/tests/responsive-smoke.cjs` | Updated sign-in label |
| `frontend/tests/offline-browser.cjs` | Updated sign-in label |
| `LOGIN-REDESIGN.md` | Implementation and verification notes |

Before editing, source hashes were captured for 84 existing non-login files, including auth/cart contexts, API service, routing, role guards, other pages/components, workspace styling, offline modules and backend controllers/routes/validators. They remain byte-for-byte unchanged. Earlier work from the preceding requests was preserved.

## Verification

- `cd frontend; npm run build`: passed.
- `cd frontend; node tests/redesign-browser.cjs --login-only`: passed at 936×527, 1024×768, 1280×800, 1440×900, 1920×1080, 768×1024, 900×1200, 320×640, 360×800, 393×852, 412×915 and 852×393.
- Verified image decoding/cover positioning, desktop 58% image width, cream surface, 44px minimum input targets, visible/reachable actions and no horizontal overflow. Desktop, mobile, tablet and short-landscape screenshots were visually reviewed.
- The login browser run used real Express/PostgreSQL authentication in a disposable local database. It verified required-field blocking, administrator email and cashier username login, incorrect credentials, Enter submission, keyboard access to password visibility, error focus, simulated transport failure, loading/disabled state, repeated-submit prevention, session after reload, cashier route protection and logout. No JavaScript runtime errors were observed. Expected failed requests were deliberately triggered for error testing.
- `cd frontend; npm test`: **37 passed, 0 failed**, including existing storage, offline recovery, money/stock and receipt tests.
- `cd frontend; npm run test:redesign:offline`: passed. Verified the existing Android-flow online sign-in, offline authorization, secure-storage retry, mode controls, restored cart/receipt after SQLite restart, and return to online administrator access. The test uses a disposable database and does not upload its local sale to the shop database.
- There is no configured lint script in the frontend package.
- Preservation hash check: 84/84 unchanged. `git diff --check`: passed.

Screenshots and test results are in the ignored `database/backups/login-redesign/` folder. No new packages were installed. No production deployment or physical Android-device test was performed.
