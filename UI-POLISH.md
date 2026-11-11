# Snack Time cashier and admin visual refresh

This pass implements the latest **UI-only** brief on top of the existing application. It reuses the working Dine-In/Takeout system, APIs, saved data and checkout logic. No new order-type component, endpoint, migration or dependency was introduced.

## Presentation changes

- Compact horizontal desktop navigation for both administrator and cashier roles. The same existing authorized routes are used; mobile/tablet bottom navigation and More remain in place.
- Menu heading and search share a desktop toolbar, reducing the space above the products.
- Desktop products use exactly four columns. The workspace uses approximately 68% for browsing and 32% for the existing order panel.
- Product cards have consistent two-line title space, larger food images, clearer availability labels, peso prices and “Add to cart” affordances. Existing stock validation, product options and modifiers are unchanged.
- The existing Dine-In/Takeout selector is restyled through CSS. Its component, handlers and state were not edited.
- Order details, customer/seating inputs, notes, cart rows, quantities, unit prices, subtotals, discounts and total remain in the existing panel. The existing checkout action is relabeled **Process Transaction**.
- Dashboard metrics use a compact six-column row on wide screens. Existing charts and service analytics retain their original calculations. Shared cards, tables, filters, forms and dialogs use the same visual treatment across all management pages.
- Theme retains `#D62828`, `#A61B1B`, `#8B5E3C`, `#FFF8F0`, white and `#F4B400`; text and borders now use the requested `#292524` and `#E7E5E4`.
- Phone cart sheets, sticky order access, touch targets, keyboard focus, reduced motion and receipt print styling are retained.

No new POS reference screenshot was attached to this brief. The layout follows its written requirements and uses the existing Snack Time logo/store branding.

## Files in this pass

| File | Change |
| --- | --- |
| `frontend/src/layouts/AppLayout.jsx` | Shared horizontal header and existing role-based navigation |
| `frontend/src/pages/POS.jsx` | Compact browse toolbar and heading |
| `frontend/src/components/ProductCard.jsx` | “Add to cart” label and availability badge for untracked items |
| `frontend/src/components/CartPanel.jsx` | Order/total labels and “Process Transaction” label |
| `frontend/src/workspace.css` | New shared visual layer for POS, admin pages, dialogs and responsive behavior |
| `frontend/src/main.jsx` | Loads workspace presentation stylesheet |
| `frontend/src/index.css` | Requested text and border tokens |
| `frontend/tests/redesign-browser.cjs` | Current navigation/action labels, 1920px viewport, explicit four-column and panel-proportion assertions |
| `frontend/tests/browser-smoke.cjs` | Updated checkout label |
| `frontend/tests/responsive-smoke.cjs` | Updated desktop navigation and checkout selectors |
| `frontend/tests/offline-browser.cjs` | Updated checkout label |
| `UI-REDESIGN.md`, `UI-POLISH.md` | Current visual scope and verification notes |

Earlier changes from the preceding requests were preserved. The existing untracked `documentation/` folder was not edited.

## Preservation verification

Before editing, hashes were recorded for 64 existing business/storage/service-selector files: backend controllers, validators and routes; SQL schema/migration files; frontend auth/cart contexts, API service and offline modules; and `OrderDetailsFields.jsx`. Those files remain byte-for-byte unchanged in this pass. The baseline is stored in the ignored `database/backups/ui-polish/` folder.

The browser tests use disposable local PostgreSQL databases. Their transactions are not added to the real shop database. The existing Dine-In/Takeout checkout, metadata, receipt, analytics and synchronization tests are reused.

## Verification

- `cd frontend; npm run build`: passed.
- `cd frontend; npm test`: **37 passed, 0 failed**.
- `cd backend; npm test`: **62 passed, 0 failed**. Existing inventory, prices/discounts, concurrent checkout, receipts, access control, reports and synchronization checks passed. The read-only smoke check left all 13 orders present at that check unchanged.
- `cd frontend; npm run test:redesign`: passed at **11 viewport sizes**, from 320×640 to 1920×1080. Verified actual product loading/search/categories, quantities, discounts, both order types, seating cleanup, committed transactions, receipts, dashboard values, history filters, role access, keyboard dialogs and every existing management route. Desktop assertions confirm exactly four menu columns and a 30–35% order panel. No JavaScript runtime errors were observed. The deliberate incorrect-password test produces the expected HTTP 401 console entry.
- `cd frontend; npm run test:redesign:offline`: passed. Verified existing Android-flow status controls, storage retry, native back handling, restored Dine-In cart/customer/seating/notes/discount after SQLite restart, cash checkout, receipt/history and retained pending synchronization. This UI fixture deliberately leaves its sale local; the backend suite separately verifies actual synchronization for both service types.
- Protected-source hash comparison: **64/64 unchanged**. `git diff --check`: passed.
- Screenshots and receipt PDF: `database/backups/ui-redesign/`. Preservation baseline/results: `database/backups/ui-polish/`. Screenshots use isolated test fixtures, not replacement shop data.

One initial browser run timed out on the login-page load while build/unit checks were also active. The rerun completed with explicit navigation timeouts, followed by the complete passing responsive and offline checks above.

This work has not been deployed, and no native APK or physical-device test was performed.
