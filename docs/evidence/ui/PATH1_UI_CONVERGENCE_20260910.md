# Path-1 UI convergence — B/C Repair 2 candidate evidence

Status: candidate for independent review; no PASS or merge claim.

## Scope truth

- Stage A is secured at `ed2147cdbe64d8991b146436b212fc69c634469e`.
- `ed51e5c01aeaab43fd8b726d7358a947fa6e4ec1` was only a B/C WIP checkpoint.
- Orders list, overlay and `/orders/[id]` use the same V8 module view.
- Customers list, overlay and `/customers/[id]` use the same V2 module view.
- Search/Stage D is excluded and remains separately secured in draft PR #84.

## Fresh-local real path

`e2e/path1-ui-convergence.real.spec.ts` passed once after a fresh local Supabase reset through migration `20260909180000`. It used the production auth/session, actions, storage and read ports without mocks.

- Identities actually used: `admin`, `readonly`, and an unauthenticated browser context.
- Clearly synthetic fixture: one customer, completed order `A-2026-0001`, operative Galvanik order `A-2026-0002`, and ten supporting intake orders for a non-vacuous list/scroll state. Missing billing address and the completed order's position price were supplied only as isolated test master data. Every accepted business transition used its canonical command/UI path.
- Real positive chain: intake UI → handoff to Galvanik → signed original photo upload and verified readback → finish/freeze → immutable invoice → confirmed full payment → goods out → persisted V8 readback.
- The separate operative-order upload remains visible with actor, timestamp, receipt and event ID and is captured in `bc-order-v8-action-readback-desktop-1914x917.png`; the operative order stays actionable for all three responsive V8 captures.
- Exactly one persisted lifecycle event was read back for each checked transition: `ORDER_STATION_MOVED_V1`, `ORDER_FROZEN_V1`, `INVOICE_CREATED_V1`, `PAYMENT_CONFIRMED_V1`, `ORDER_PICKED_UP_V1`.
- Rights/fail-closed: readonly sees the permitted core card while payment details stay restricted and mutation stays disabled; unauthenticated deep-link redirects to `/start`; empty filter and unknown-order state remain distinct.
- Navigation/context: list → operative order → customer → the same operative order; overlay close pops one level; direct order/customer deep-links fall back to `/orders` or `/customers`; the customer filter and a strictly positive scroll position survive the overlay/backstack cycle exactly.
- Built-app viewports: desktop `1914x917`, tablet `1220x880`, mobile `390x844`; both open cards and the document have no horizontal overflow.

Machine receipt: `docs/evidence/ui/artifacts/path1-ui-convergence/bc-real-browser-receipt.json`

Receipt SHA256: `69e1862888ff9e48a67346af742c2996b0f476f4410070f869902711792d269d`

The receipt contains byte-matching SHA256 values for all ten current screenshots: V8 top, V8 lower action region, and V2 for each viewport plus the persisted operative action readback. Hash mismatch count: `0`.

## Numbered side-by-side observations

Compared with `KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html` and `KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html`:

1. V8 keeps the reference identity hierarchy, customer link, due-state prominence and separate physical/payment lifecycle while rendering only read-port facts.
2. V8 now exposes only existing canonical actions; each success is followed by actor/time/event/receipt readback in the same card.
3. Positions, material, surface, status, notes and verified evidence use real data; unavailable provider-dependent actions are absent rather than simulated.
4. V2 keeps the reference customer/contact hierarchy, shows eleven real active orders plus one completed historical order, derives a real next action, and opens the operative order in the identical V8 card.
5. The lower action region is captured separately at every viewport, so the fixed responsive action area is not hidden by a top-only screenshot.
6. No HTML demo value, fake provider result, second write path, legacy card shell or visible NOT_AVAILABLE surface is used.
7. The executable comparison found no unresolved visual or functional P0/P1 in this writer run; the required independent Exact-SHA review remains pending and authoritative.
