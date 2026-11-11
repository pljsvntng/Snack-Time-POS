# Compact Order Details panel

Implemented November 11, 2026, on top of the existing redesign.

## Changes

- Customer/service controls sit above the product scroller. Notes start collapsed, including when a saved draft contains notes; the existing "added" indicator remains visible.
- The product list uses `flex: 1 1 0`, `min-height: 0` and its own vertical overflow. The header, customer controls, list heading and payment footer do not shrink or scroll with the products. The footer stays in normal layout flow, so it cannot cover the list.
- Discount label and selector share a compact row. All API-provided discount options and existing handlers are retained. Subtotal and discount use closely spaced rows; the total stays red and Process Transaction remains accessible.
- Item totals sit beside product names. Quantity, unit price and Remove share a row. Secondary thumbnails are omitted on touch/tablet layouts to leave space for readable controls; quantity, remove, service and payment controls retain 44px touch heights.
- Short screens use inline customer/seating labels and tighter spacing. Wide phone landscape uses two footer columns. The mobile sheet uses more of the available viewport while retaining safe-area padding.

No backend, database, cart state, price/discount calculation, tax or transaction-processing implementation was changed in this pass.

## Files

- `frontend/src/components/CartPanel.jsx`: separate fixed controls/product scroller/footer; compact item rows and discount field; labeled keyboard-focusable product region.
- `frontend/src/components/OrderDetailsFields.jsx`: notes initially collapsed.
- `frontend/src/workspace.css`: scoped compact panel styles and responsive height adjustments.
- `frontend/tests/redesign-browser.cjs`: `--cart-only` acceptance mode using a six-product cart in a disposable local PostgreSQL database.

## Verification

- `cd frontend; npm run build`: passed after the final CSS cleanup.
- `cd frontend; npm test`: **37 passed, 0 failed**.
- `cd frontend; npm run test:redesign`: passed all **11 viewport sizes**, real Dine-In/cash and Takeout/GCash checkout, receipts, dashboard totals, history filters, dialogs, navigation and cashier permissions. No JavaScript runtime errors; the incorrect-password check returned the expected HTTP 401.
- `cd frontend; node tests/redesign-browser.cjs --cart-only`: passed eight sizes, including 320×568, 360×640, 1024×600 and 852×393. Verified independent product scrolling, fixed footer/customer positions, no panel or horizontal overflow, expanded notes, retained Senior Citizen/PWD and promotional options, quantities, removal and consistent totals. No runtime errors.
- Measured five complete products immediately visible at 1440×900, four at 393×852 and two at 360×640 with Dine-In/customer/seating controls visible. Very short screens show fewer full rows while retaining independent scrolling and the payment footer.
- `cd frontend; npm run test:redesign:offline`: passed storage recovery, saved customer/seating/notes/discount restoration, quantity/cart handling, cash checkout, receipt/history after restart and online → offline → online access with the pending sale retained. No fixture sale was uploaded to the shop database.

Screenshots and layout measurements are in the ignored `database/backups/compact-cart/` folder. Phone, desktop, short-tablet and phone-landscape screenshots were visually reviewed. No physical Android-device test or deployment was performed.
