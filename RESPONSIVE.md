# Responsive UI verification

The existing Snack Time POS frontend now adapts to phone and tablet screens while retaining its orange/cream branding, typography, product imagery and existing POS workflows.

## Layout behavior

- Below 1200 px, navigation uses a touch-friendly drawer with all existing role-appropriate sections, a close control, Escape dismissal and focus handling. Desktop navigation stays visible.
- Phones below 760 px use a persistent order bar and cart bottom sheet. Short landscape screens below 1200 px also use the sheet, even when their width exceeds the phone breakpoint.
- At 760 px and above with at least 560 px of height, products and the cart appear side by side. Removing the permanent sidebar from intermediate tablet widths provides more room for the cashier.
- Product grids retain two columns on narrow phones and expand on tablets. Long names wrap. Quantity controls are 44 px and main touch controls are at least 48 px high; checkout is 54 px on touch layouts.
- Forms use full-width controls and single columns on phones, with associated labels and numeric payment input. Dialogs scroll within the available viewport; payment/customization actions stay reachable. Safe-area insets and viewport resize behavior accommodate device edges and reduced keyboard space.
- Dashboard cards and chart tooltips fit their container. Wide data tables scroll inside labelled keyboard-accessible regions, with a swipe hint only when a table actually overflows. No table columns or admin actions are removed.
- Existing payment methods, discounts, inventory controls, reports, users, settings and receipt workflows remain available. The database/backend were not changed in this responsive pass.

## Automated checks

Run from the project root:

```powershell
npm --prefix frontend test
npm --prefix frontend run test:browser
npm --prefix frontend run test:responsive
npm --prefix frontend run build
```

The read-only responsive browser suite uses a temporary frontend/API and emulates touch input at these CSS viewport sizes:

| Device case | Width × height | Cart layout |
| --- | --- | --- |
| Small phone | 320 × 640 | Sheet |
| Phone | 360 × 800 | Sheet |
| Large phone | 393 × 852 | Sheet |
| Wide phone | 412 × 915 | Sheet |
| Small tablet | 600 × 960 | Sheet |
| Portrait tablet | 768 × 1024 | Side by side |
| Tall tablet | 800 × 1280 | Side by side |
| Landscape tablet | 1024 × 768 | Side by side |
| Wide tablet | 1280 × 800 | Side by side |
| Landscape phone | 852 × 393 | Sheet |
| Desktop regression | 1440 × 900 | Side by side |

At every size, it checks product columns, navigation, cart visibility, customization, quantity/remove touch targets, discounts, checkout access, payment access, seven administration/history/report screens, product/user forms, settings, and document/content overflow. Additional checks cover a 393 × 400 keyboard-sized viewport, preserving the cart during rotation, payment focus trapping/Escape, and cashier navigation. All non-GET API requests except login are blocked so no production sales or edits are made.

Verification passed: all 11 viewport cases, mobile cashier navigation, rotation/cart preservation, reduced keyboard space, and payment focus handling. All five frontend regression tests, the existing desktop browser workflow, and the production build passed. Post-test database verification confirmed that all 440 original records and financial totals remained unchanged.

Screenshots and machine-readable results are retained privately in `database/backups/responsive-verification/`. The existing full browser workflow test also covers historical receipt/report print rendering and role restrictions. The production build may retain the existing large-bundle advisory.

These are Chrome device-size/touch emulation checks, not tests on physical Android hardware or a real Android keyboard.
