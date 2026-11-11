# Snack Time UI redesign

Implemented in the existing React application on November 11, 2026.

The latest UI-only pass is documented in [UI-POLISH.md](UI-POLISH.md). It adds shared horizontal navigation, a four-column desktop menu, an approximately 68/32 menu/order split and the Process Transaction presentation. It preserves the existing Dine-In/Takeout implementation and introduces no further backend or database changes. The sections below describe the earlier implementation stages.

## Cashier and admin follow-up

The follow-up adds functional Dine-In and Takeout ordering across the existing application. The original UI-only audit below remains useful; the backend and storage changes in this section supersede its original scope statement.

- Cashiers now have branded desktop top navigation, their identity/logout controls, larger menu photography, and a distinct order workspace. Admins retain their management sidebar. The follow-up palette is Snack Red `#D62828`, Deep Red `#A61B1B`, Brown `#8B5E3C`, Cream `#FFF8F0`, White, Gold `#F4B400`, Charcoal `#2D2A26` and Muted Gray `#78716C`.
- New orders default to Takeout. Dine-In exposes optional seating; both types allow an optional customer name and notes. Switching types preserves products and discounts, clears seating when leaving Dine-In, and adds no charges.
- `POST /api/orders` accepts `orderType`, `customerName`, `seatingReference` and `orderNotes`. Canonical responses use `order_type`, `customer_name`, `seating_reference` and `order_notes`. Snake-case request fields are also accepted. Text lengths and values are validated on both online and offline paths. Takeout never persists seating data.
- Details participate in checkout fingerprints and draft persistence. A changed service type or note cannot silently replay a completed checkout identifier as a different sale. Existing callers/receipts without details remain unspecified for compatibility.
- Receipts show the type, provided customer/seating and notes. Saved historical receipts retain their original amounts and identity.
- History filters query real records by type (including unspecified), date range, cashier for admins, status and payment. Cashiers remain restricted to their own transactions on the server and offline.
- The admin dashboard reports today's counts and revenue for both types, percentage of all completed orders and a separate legacy group. Voided transactions are excluded. Daily revenue totals and service-type totals/shares come from one aggregate query. Revenue charts can show 7 days, 30 days or 6 months; existing items-sold, average-order and best-seller information remains available.

### Migration and existing data

`database/order-details.postgresql.sql` adds four nullable columns and validates supported service types and seating ownership. It never changes old order values or assumes past transactions were Takeout. Startup's existing `ensureSyncSchema` migration transaction runs it under the existing advisory lock.

The migration was applied to the existing **local** PostgreSQL database. A before/after digest verified that all 12 original order records were preserved. The migration was also tested repeatedly in disposable databases. No Neon/Render production deployment or remote database migration was performed in this task; the new backend and its migration must accompany the frontend on deployment.

Offline SQLite already stores immutable receipt/draft/outbox JSON. The new metadata is stored there without a destructive local schema upgrade. Server synchronization verifies agreement between the saved checkout request and receipt, then commits those details with the original amounts and stock movements. Existing immutable queue entries are never rewritten.

### Additional files in this follow-up

| Files | Change |
| --- | --- |
| `database/order-details.postgresql.sql` | Additive, repeatable order metadata migration |
| `backend/utils/orderDetails.js` | Canonical metadata validation |
| `backend/utils/syncSchema.js` | Integrates migration with existing startup transaction |
| `backend/controllers/orderController.js` | Validated checkout, retry fingerprint and real history filters |
| `backend/controllers/syncController.js` | Persists synchronized order details |
| `backend/utils/offlineSaleValidation.js` | Validates metadata consistency and canonical receipt fields |
| `backend/controllers/reportController.js` | Completed-sales service analytics, product count and trend ranges |
| `backend/utils/dates.js` | Supports precise end-of-day history filters |
| `backend/scripts/migrate-neon.js` | Importing read-only helpers no longer loads cloud environment into the caller |
| `backend/tests/cloud-config.test.js` | Guards migration-helper environment isolation |
| `backend/tests/order-types.test.js` | New isolated PostgreSQL/SQLite/API integration coverage |
| `frontend/src/utils/orderDetails.js` | Defaults, labels and matching offline validation |
| `frontend/src/components/OrderDetailsFields.jsx` | Accessible service selector, customer, seating and notes |
| `frontend/src/components/OrderTypeBreakdown.jsx` | Real service count/revenue/share analytics |
| `frontend/src/context/CartContext.jsx` | Metadata state, user isolation, request IDs and durable drafts |
| `frontend/src/offline/store.js` | Immutable receipt/queue metadata, retries and offline history filters |
| `frontend/src/pages/POS.jsx` | Sends selected metadata through the existing checkout path |
| `frontend/src/components/CartPanel.jsx` | Service/customer controls and unit prices |
| `frontend/src/components/PaymentModal.jsx` | Service/customer confirmation and accurate queued-sale messaging |
| `frontend/src/components/ReceiptView.jsx` | Service type, customer, seating and notes |
| `frontend/src/pages/Transactions.jsx` | Real filters, custom dates and service badges |
| `frontend/src/pages/Dashboard.jsx` | Management layout, service analytics and chart range selector |
| `frontend/src/layouts/AppLayout.jsx` | Separate cashier top navigation and identity |
| `frontend/src/index.css`, `frontend/src/components/Brand.jsx`, `frontend/index.html`, `frontend/public/brand/*.svg` | Updated theme, responsive treatment and consistent brand assets |
| `frontend/tests/redesign-browser.cjs` | Both online order types, switching, receipts, filters, analytics and cashier layout checks; disposable native-flow runner |
| `frontend/tests/offline-browser.cjs` | Draft metadata restored through an actual Android-flow UI restart |
| `frontend/tests/browser-smoke.cjs`, `frontend/tests/responsive-smoke.cjs` | Uses labeled period selector after adding more history filters |
| `frontend/package.json` | Adds isolated offline UI acceptance command; no dependency additions |

### Current verification

- Frontend production build: passed.
- Frontend existing tests: **37 passed, 0 failed**.
- Backend tests including order-type integration: **62 passed, 0 failed**. The earlier four HTTP 401 integration failures were resolved by preventing migration-helper imports from changing the database environment.
- `npm run test:redesign`: passed at ten viewport sizes. Both Dine-In/cash and Takeout/GCash were actually committed in a disposable database; receipts, selection switching, seating cleanup, discounts, dashboard counts/shares and database-backed history filters were verified. Cashier desktop/tablet/phone navigation and unauthorized admin access were checked. No JavaScript runtime errors; the expected incorrect-password test produces one HTTP 401 console message.
- `npm run test:redesign:offline`: passed against a disposable database. Verified secure-storage retry, Android back handling, status/retry disclosures at six sizes, offline Dine-In draft restoration after reopening SQLite, customer/seating/notes/discount persistence, cash-only checkout, saved receipt, and return to online admin access without losing the queued sale. That UI test deliberately does not upload its local sale.
- `backend/tests/order-types.test.js`: separately verified offline saving and **actual synchronization of both order types**, restart durability, exact stock/discount/change values, repeat upload deduplication, invalid metadata rejection, mismatched request/receipt rejection, legacy handling, real combined filters, and voided-sales exclusion.
- Screenshots and receipt PDF: `database/backups/ui-redesign/` (ignored, isolated test fixtures). Native-flow measurements are in the offline browser test's existing artifact folder.

No new dependencies were installed. Native physical hardware and an APK rebuild were not tested. The changes have not been deployed to Render/Neon.

## Repository audit

- Frontend: React 18, Vite 6, React Router, plain CSS, Lucide icons and Recharts. Existing Inter and Plus Jakarta Sans fonts are reused.
- Existing screens: login, dashboard, POS, products, inventory, transaction history, reports, users and settings.
- Existing dialogs: product customization, payment, completed receipt, historical receipt, product editor, ingredient editor, stock adjustment, user editor and destructive confirmation. Management and receipt dialogs now share keyboard focus containment and Escape dismissal.
- Backend: Express and PostgreSQL. Existing API groups are auth, categories, products, inventory, orders, discounts, reports, users, settings and offline synchronization.
- Authentication and protected routes preserve administrator/cashier access. Cashier checkout still uses CartContext, Decimal-based money helpers, shared ingredient/direct-stock checks and the original order API.
- Android retains encrypted SQLite storage, saved drafts, signed offline access, cash-only offline checkout, pending delivery queues, retry controls, reconciliation and native back navigation.

In the original UI-only pass, no backend implementation, database schema, API contract, authentication context, cart context or offline persistence/synchronization implementation was changed. The follow-up above adds the requested order metadata end to end.

## UI changes

- Storefront-inspired Snack Red `#C62828`, Deep Red `#991B1B`, Warm Wood `#795548`, Cream `#FFF9F2`, Golden Yellow `#F4B400`, Food Orange `#F97316`, Charcoal `#292524` and Soft Gray `#78716C`. Shared color, type, spacing, radius and state tokens live in `frontend/src/index.css`.
- Original burger logo, uppercase wordmark and restrained yellow accents. Consistent in the login, sidebar, favicon and receipt; thermal receipts use a monochrome symbol.
- Desktop login uses the supplied real storefront photograph, an editorial brand panel and a focused sign-in form. Mobile adapts to a compact brand header. Password visibility is keyboard accessible.
- Grouped sidebar, contextual header, Manila date display and retained role-aware mobile bottom navigation.
- POS has a dedicated counter heading, horizontally scrollable categories, clear menu count, search reset, stock labels, selected product borders/counts, image fallback, and a separate order panel. Existing quantity, customization, discount and checkout handlers are retained.
- Payment highlights the amount due, selected method, cash shortcuts and change. Stale validation text clears when payment input changes.
- Dashboard adds a register shortcut, clearer metric hierarchy, coordinated charts and useful no-sales states. All metrics still come from the existing dashboard API.
- Products, ingredients and users gain local search over actual API records. Inventory includes actual ingredient/restock counts. Tables, empty states, forms and destructive controls share the new visual system.
- Disabling a user now requires confirmation before invoking the existing update API.
- Settings has a two-column editor and live business/receipt identity preview. It preserves all existing setting keys and save behavior.
- Existing phone cart sheets, short-landscape layouts, touch targets, focus styles, synchronization notices and print styles remain supported. Reduced-motion preferences disable decorative motion.

## Logo assets

| Asset | Use |
| --- | --- |
| `frontend/public/brand/snack-time-logo.svg` | Main scalable wordmark |
| `frontend/public/brand/snack-time-icon.svg` | Favicon and compact symbol |
| `frontend/public/brand/snack-time-app-icon.svg` | 512px mobile icon concept; native launcher has not been repackaged |
| `frontend/public/brand/snack-time-receipt.svg` | Monochrome receipt wordmark |
| `frontend/src/components/Brand.jsx` | Shared live application/sidebar/login mark and wordmark |

The burger geometry is original SVG artwork. The supplied storefront image is bundled locally at `frontend/public/images/login/snack-time-store.png`.

## Files changed or added

| Files | Changes |
| --- | --- |
| `frontend/index.html` | Favicon and theme color |
| `frontend/package.json` | Adds `test:redesign`; no dependencies added |
| `frontend/src/index.css` | Shared tokens, branding, login and all screen/component styles |
| `frontend/src/layouts/AppLayout.jsx` | Navigation groups, brand, breadcrumb and date |
| `frontend/src/components/Brand.jsx` | Original shared SVG logo |
| `frontend/src/components/PageHeader.jsx` | New reusable page heading |
| `frontend/src/components/DialogSurface.jsx` | New accessible management/receipt dialog surface |
| `frontend/src/components/CartPanel.jsx` | Order hierarchy and checkout action |
| `frontend/src/components/ProductCard.jsx` | Selected count, category, image fallback and visual feedback |
| `frontend/src/components/PaymentModal.jsx` | Amount hierarchy, method state and validation presentation |
| `frontend/src/components/ReceiptView.jsx` | Monochrome receipt symbol |
| `frontend/src/components/ConfirmDialog.jsx` | Shared keyboard-accessible surface |
| `frontend/src/pages/Login.jsx` | Storefront-based login |
| `frontend/src/pages/Dashboard.jsx` | Overview, shortcut, charts and empty states |
| `frontend/src/pages/POS.jsx` | Counter layout, menu controls and product selection feedback |
| `frontend/src/pages/Products.jsx` | Heading, search, empty state and dialog |
| `frontend/src/pages/Inventory.jsx` | Heading, counts, search, loading/empty states and dialogs |
| `frontend/src/pages/Transactions.jsx` | Heading, labeled filters, empty state and receipt dialog |
| `frontend/src/pages/Reports.jsx` | Heading and labeled report controls |
| `frontend/src/pages/Users.jsx` | Heading, search, loading/empty states, dialog and disable confirmation |
| `frontend/src/pages/Settings.jsx` | Editor layout and live receipt identity preview |
| `frontend/public/brand/*.svg` | Four exported logo assets listed above |
| `frontend/public/images/login/snack-time-store.png` | Supplied storefront photograph |
| `frontend/tests/redesign-browser.cjs` | Disposable PostgreSQL + real Express/Playwright UI acceptance |
| `UI-REDESIGN.md` | Audit, implementation, file inventory and validation notes |

Pre-existing untracked `documentation/` content was left untouched.

## Original UI-pass validation (superseded by current results above)

- `cd frontend; npm run build`: passed.
- `cd frontend; npm test`: passed, 37/37 tests, including offline persistence, encrypted storage, restart recovery, stock, money, receipt and Android navigation checks.
- `cd frontend; npm run test:redesign`: passed. Verified real sign-in, incorrect-password feedback, show/hide password, product search/category controls, quantity changes, discount, insufficient-payment rejection, change, database-backed checkout, receipt PDF, cashier permissions and logout. All transaction writes use a disposable local PostgreSQL database that is removed after testing.
- Browser acceptance covers 320×640, 360×800, 393×852, 600×960, 768×1024, 800×1280, 1024×768, 1280×800, 852×393 and 1440×900. Each size checks all eight authenticated routes, login, navigation, management dialog dismissal/focus, reachable actions and no page overflow.
- No JavaScript runtime errors were observed. The recorded browser console contains the expected HTTP 401 from the deliberately incorrect-password test.
- Screenshots and test results are saved under the ignored `database/backups/ui-redesign/` folder. These screenshots use isolated test fixtures, not replacement application data. The login photograph is the supplied real store photo.
- `cd backend; npm test`: 49 passed, 5 failures reported (four integration subtests plus their parent suite). The first failure is HTTP 401 during the existing cloud-photo persistence test; subsequent authenticated integration calls also return 401. These backend tests do not import the frontend, and no backend files were changed for this redesign. The read-only API smoke check and durable synchronization suite passed.
- `git diff --check`: no whitespace errors.

## Original UI-pass limits

The original backend integration authentication failures have now been resolved in the follow-up above. Deployment and physical-device/APK acceptance remain outside the checks performed here. No new dependencies were installed.
