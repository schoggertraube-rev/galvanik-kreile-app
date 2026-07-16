# Foundation checkpoint — 2026-07-16

Branch: `codex/foundation-security-remediation-20260715`

This is a resumable implementation checkpoint, not a production-readiness claim. No merge, production deployment, remote migration, RLS change, provider rollout, or deletion was performed.

## Completed and locally verified

- All 24 validated Codex Security findings remain remediated locally; controls that need a remote rollout stay explicitly marked as rollout-dependent in `docs/security/FIX_REPORT_2026-07-16.md`.
- The operational foundation now has tenant/permission boundaries, idempotent receipts, exact route snapshots, state-transition checks, and fail-closed behavior across capture, orders, station completion, wareneingang, galvanik, handover/shipment, KVP, customer finance, calendar/price mutations, OCR, privacy, and system statistics.
- Offline/outbox status no longer claims backend availability or successful synchronization without an adapter receipt.
- Bookkeeping, analysis, marketing, customer, and start views distinguish loading, unavailable, confirmed empty, and confirmed data. Invented fallbacks and active no-op publishing paths covered by this mission were removed or visibly quarantined.
- Preserved product ideas remain protected by `docs/project/NON_LOSS_REGISTER.md`; none was deleted as part of hardening.

## Latest gates

- Unit tests: **111 files / 463 tests passed**.
- TypeScript: **passed** (`tsc --noEmit`).
- ESLint ratchet: **passed**, with no file/rule/severity ceiling increase.
- Focused truth tests after the final lint fixes: **5 files / 26 tests passed**.
- `git diff --check`: **passed**.

The integration suite and production build must be rerun after this checkpoint because the last combined gate was interrupted by a now-fixed lint failure and therefore did not yield independently attributable results.

## Exact continuation order

1. Fix the active `/lager` contract: the server returns `currentStock`, `minStock`, `category`, and `unit`, while the client reads legacy field names and currently turns load failure into an apparently healthy zero-stock result.
2. Add the enforceable anti-shelfware artifacts required by the front/back bridge: capability manifest; `idea/user-twin -> capability -> code/test -> status -> visible|automatic|administrative|later` mapping; full-commit-SHA gate; drift test.
3. Close remaining audited connection gaps in priority order, especially order-to-invoice linkage, communication/status-mail discoverability, and explicitly blocked production-domain objects (`HandlingUnit`, bath participation, split/mixed routes).
4. Rerun integration tests, production build, complete unit suite, TypeScript, lint ratchet, and diff check.
5. Run the independent read-only final review, update the fix report, push the final commit, refresh Draft PR #19, and create a fresh Vercel Preview.

## Honest completion estimate

The original 24-finding security remediation is locally complete. The expanded foundation mission is approximately **90% complete**. It is not yet `PASS`: the inventory white-wall defect, enforceable UI/capability mapping, final full gates, independent review, and refreshed preview remain.
