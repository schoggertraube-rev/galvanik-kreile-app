# Path-1 UI convergence — candidate evidence

Status: B/C candidate; no independent PASS and no merge claim.

## Scope

- Stage A is secured at `ed2147cdbe64d8991b146436b212fc69c634469e`.
- `ed51e5c01aeaab43fd8b726d7358a947fa6e4ec1` is the B/C WIP checkpoint, not an acceptance result.
- Stage B converges list, overlay and `/orders/[id]` on `OrderCardView` through the public orders facade.
- Stage C converges list, overlay and `/customers/[id]` on `CustomerCardView` through the public customers facade.
- Stage D/Search is intentionally excluded from this candidate and remains secured in draft PR #84.

## Real browser acceptance

The executable proof is `e2e/path1-ui-convergence.real.spec.ts`. It creates a clearly synthetic customer/order through the canonical intake UI against fresh local Supabase, authenticates a real `buero` identity, and reads the result through the production actions and module adapters. The machine-readable receipt is written to `docs/evidence/ui/artifacts/path1-ui-convergence/bc-real-browser-receipt.json`.

Required built-app views: order V8 and customer V2 at 1914×917, 1220×880 and 390×844, including list → order → customer → order and both direct deep links.

## Numbered comparison with the canonical HTML references

1. Identity and contact headers follow the serif headline, navy/gold hierarchy, metadata and close action from the references; only real read-port fields render.
2. Order V8 separates physical lifecycle from invoice/payment threshold and derives urgency and next step from persisted state.
3. Order positions carry quantity, material, surface and persisted extra work. Missing notes, photos or documents use a professional explicit empty state.
4. Customer V2 prioritizes contact context, the next real active order, active orders, notes and history. Unsupported analysis/marketing claims are absent.
5. Both cards use the same responsive card truth for list overlays and direct deep links, with a sticky compact action dock.
6. Buttons without a bound real command are disabled or hidden; no reference demo value or provider placeholder is copied.
7. Desktop, tablet and mobile use the same information hierarchy without horizontal overflow. Screenshot hashes are held in the real-browser receipt.

## Executed result

- Fresh local Supabase reset and all migrations through `20260909180000`: PASS.
- Real browser path: PASS, one serial run, one clearly synthetic order `A-2026-0003`.
- Order flow: canonical intake UI → real handoff to Galvanik → `/orders` → V8 overlay → customer V2 overlay → V8 overlay → `/orders/[id]`.
- Customer flow: `/customers/[id]` renders the same V2 component and opens the same V8 order component.
- Viewports: 1914×917, 1220×880 and 390×844; no document-level horizontal overflow.
- Machine receipt: `docs/evidence/ui/artifacts/path1-ui-convergence/bc-real-browser-receipt.json`, SHA256 `c0f15dc03955130c4463ec1d6d87b4a0b6da7510b1bbfe047929d0c62b83ef45`.
- Six screenshot hashes are embedded in that receipt. Visual writer check against both canonical references found no open P0/P1 deviation; independent review remains mandatory and is not claimed here.
