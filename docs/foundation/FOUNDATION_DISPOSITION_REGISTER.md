# Foundation Disposition Register

## Status

`NO_GO — REPAIR_CONTINUES`

This register governs consolidation in the existing `02_app` repair candidate.
It does not authorize a remote mutation, deployment, push, merge, reset or
deletion. A **QUARANTINE** decision preserves the file and public import shape
while removing its executable or user-visible claim until the stated proof is
complete.

| Decision | Meaning |
| --- | --- |
| `KEEP` | Retain a proven, scoped path. |
| `MERGE` | Consolidate duplicate paths only into the named canonical contract. |
| `QUARANTINE` | Keep source provenance/import compatibility, but fail closed. |
| `DELETE_AFTER_PROOF` | No deletion now; requires replacement, readback and rollback evidence. |

## Current decisions

| Scope | Decision | Evidence and condition |
| --- | --- | --- |
| `src/app/actions/orders.actions.ts` (`getOrdersDb`, `getOrderCountDb`) and `src/app/actions/customers.actions.ts` list paths | `KEEP` | These are the only retained operational list paths; both are session-, permission- and tenant-scoped. Database RLS proof remains a W3 precondition. |
| `src/lib/orders/processContract.ts` and `transitionOrderProcess` | `QUARANTINE` | Canonical chain is retained, but execution stays closed until W1 receipt migration, retry proof and W3 authorization proof. |
| `supabase/migrations/20260728124147_foundation_w1_runtime_receipt_columns.sql` | `KEEP` | Additive W1 candidate only; requires isolated-lab proof and one explicit product approval. |
| `src/app/buchhaltung/**`, `src/app/marketing/**`, `src/app/performance/**`, `src/features/analyse/**` | `QUARANTINE` | Finance, marketing, performance and analysis require unresolved relation, view, evidence, consent and RLS contracts; see `W3_AUTH_RLS_DISCOVERY_MANIFEST.md`. |
| `src/app/warendurchlauf/**`, legacy station actions and QR/PDF workflows | `QUARANTINE` | No completed process receipt or print/storage contract is proven. |
| Capture/OCR/upload actions and components | `QUARANTINE` | No verified storage path, actor/tenant rule, OCR result receipt or retry evidence. |
| `src/app/actions/aiSearch.ts`, `erfassung.actions.ts`, `inquiries.actions.ts`, `items.actions.ts`, `phoneNotes.actions.ts`, `price-lines.actions.ts`, `search.actions.ts`, `tracking.actions.ts`, `vorlage.actions.ts` | `QUARANTINE` | Each action is currently behind the globally false foundation gate; historic bodies contain unscoped, mock, browser-transport or untyped legacy behavior. Retain only typed unavailable adapters until an individual contract exists. |
| Legacy cockpit, customer-card, order-cost and order-photo server adapters | `QUARANTINE` | Their callers are not a release path and their data/receipt contracts are not proved. Preserve action names with explicit unavailable results rather than legacy reads or writes. |
| `src/app/actions/developerAnalytics.actions.ts` and Cockpit `getWhatIfKontext` | `QUARANTINE` | Historic bodies returned invented telemetry, device shares, friction signals, recommendations and a default station rate. They must fail closed until governed telemetry, metric provenance and decision-model contracts exist. |
| `src/app/kontrolle/KontrolleDashboardClient.tsx` | `QUARANTINE` | Old component rendered hard-coded QS counts and demo warnings; import-compatible unavailable boundary is retained. |
| `src/app/kvp/KvpClient.tsx` | `QUARANTINE` | Old component mixed local browser storage with demo measures; import-compatible unavailable boundary is retained. |
| `src/components/offline/OfflineSyncBadge.tsx`, `src/lib/offline/SyncContext.tsx` | `QUARANTINE` | Browser online state cannot prove synchronization; queue mutation/recovery remains unavailable. |
| `src/lib/repositories/bathsRepository.ts`, `src/lib/repositories/bathMeasurementsRepository.ts` | `QUARANTINE` | Historic code combined mock data, hard-coded assumptions and unverified measurement storage. Public type boundaries remain, operations reject. |
| `src/lib/server/operationalOrders.ts` private `*LegacyUnsafe` functions | `QUARANTINE` | They are private, unreferenced and gated; their historical implementation is retained only as provenance and must not be re-enabled directly. |
| Historic source/contracts that are not executable or target-proven | `DELETE_AFTER_PROOF` | No source file is deleted. Removal may occur only after a canonical replacement, product readback, regression proof and explicit review. |

## Rule for further consolidation

Before replacing or removing any further executable legacy body, append its
path, exact decision, active caller check and activation proof to this register.
No `DELETE_AFTER_PROOF` entry may be deleted in the current mission.
