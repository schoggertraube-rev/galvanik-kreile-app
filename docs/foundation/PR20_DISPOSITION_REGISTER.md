# PR #20 — Containment Disposition Register

Status: `LOCAL_CONTAINMENT_CANDIDATE`. No source file was deleted, no remote
migration/RLS/grant/view was changed, and no product deployment was made.

## Reversible containment rule

Every listed legacy surface keeps its file path and exported symbol so existing
imports still resolve. It is replaced only by an explicit `NOT_CONFIGURED` UI
or adapter until a named data, tenant, role, evidence and recovery contract is
approved. Restoration is not a boolean flip: restore one path only after its
consumer/import search, contract, tests and release receipt have passed.

For each entry the import check is the exact command
`rg -n "<export-or-file-name>" src`; callers either remain type-compatible
through `createFoundationUnavailableComponent` or, for Next pages, render an
explicit prop-less `FoundationUnavailable` page. The before-state remains in
Git history; no deletion or irreversible data operation occurred.

## Quality #34 and the six former forbidden patterns

| Former finding | Replacement | Negative evidence |
| --- | --- | --- |
| raw `pinHash` text scan produced false positives | TypeScript AST boundary check only flags real client props and server payload returns | `src/lib/auth/__tests__/pinClientBoundary.test.ts`; CLI self-test proves type/fixture non-findings |
| direct hash to client prop | semantic JSX client-module check | self-test violation must fail |
| server-action return containing hash | semantic server-payload check | self-test violation must fail |
| photo upload/Base64 fallback | import-free `PhotoServiceNotConfiguredError` adapter | `src/lib/services/__tests__/photoService.test.ts` |
| private-bucket public URL | photo adapter contains no upload or `getPublicUrl` path | `scripts/verify-foundation-boundaries.ts` |
| tracking random/local persistence/transport | import-free no-op unavailable adapter, no event write | `src/lib/tracking/__tests__/tracking.test.ts`; boundary verifier |

The gate is now `scripts/quality/check-forbidden-patterns.mjs`: it passed for
the current changed-file range and has no suppression or broad allowlist.

## Lint-debt disposition

The repository-wide lint backlog was resolved without `eslint-disable`, an
ignore entry, a rule downgrade, or a broad allowlist. The cleanup is constrained
by three reviewable helpers under `scripts/quality/`:

- `remove-unused-imports.mjs` removes only ESLint-reported import bindings and
  retains a value module as a side-effect import when it was the final binding;
- `remove-unused-bindings.mjs` preserves public call signatures and initializer
  evaluation while making unused compatibility bindings explicit;
- `bind-unavailable-inputs.mjs` turns fail-closed adapter inputs into ephemeral
  rejected-input arguments. `foundationUnavailableAction` and
  `foundationUnavailableResponse` inspect only the argument count, never store,
  log, transmit, or expose an input value.

This also removed five invented finance-history chart series. The affected
analysis actions now return an empty series where history is not available,
rather than a zero-valued fabricated trend.

## Capability and adapter dispositions

| Consumer group / preserved paths | Replacement | Why unavailable | Restore proof |
| --- | --- | --- | --- |
| all gated server actions via `src/lib/server/foundationGate.ts` | typed per-capability default-deny allowlist | one global switch could revive unrelated legacy paths | capability-specific action, tenant, role, receipt and negative test |
| `src/lib/services/photoService.ts`, `src/lib/ocr/KlippaProvider.ts`, `src/lib/ai/geminiClient.ts` | throwing import-free/provider-unavailable adapters | photo/OCR/AI owner, consent, storage and cost contract absent | private bucket/path, consent, tenant and provider test receipts |
| `src/lib/tracking/tracking.ts`, `src/hooks/useOfflineManager.ts`, `src/lib/analytics/useFeatureFlag.tsx` | non-persisting unavailable adapters | telemetry/offline/client overrides lack an approved contract | consent/retention/retry/conflict contract and server-side capability check |
| `src/lib/offline/idbSync.ts` | import-free `OfflineSyncNotConfiguredError` adapter | historic IndexedDB/localStorage mutation queue lacked tenant, receipt and conflict proof | W1 receipt, W3 authorization, conflict and recovery proof |
| `src/lib/marketing/adapters/InstagramAdapter.ts`, `init_marketing_db.js`, `seed_channels.js`, `seed_segments.js` | explicit non-executing/failed adapters | marketing owner, consent and tenant chain absent | consent, provider secret, actor and delivery receipt proof |
| `create_migrate.js`, `enrich.js`, `rewrite.js`, `run_audit.js`, `test-routes.js`, `verify.js` | non-writing historical wrappers | scripts could alter schema/source or write external reports outside a reviewed path | scoped, reviewed scripts with checked output location |
| `src/lib/analyse/insights.ts`, `src/lib/analyse/routes.ts`, analysis widgets | `NOT_CONFIGURED` observation instead of an inferred business claim | finance/metric evidence and ownership not proved | formula, scope, evidence and role contract |

## UI quarantine census

| Preserved path group | Consumers/import search | Replacement |
| --- | --- | --- |
| `src/app/buchhaltung/{ausgaben,belege/**,kosten/neu,periodenabschluss,rechnungen/**,zahlung}/**` and `src/app/buchhaltung/components/{RoiKachel,ZahlungKachel}.tsx` | route imports plus `rg -n "BelegeClient|RechnungenClient|KostenForm|PeriodenabschlussClient|RoiKachel|ZahlungKachel" src` | financial UI/page boundary; no price/invoice/payment claim |
| `src/app/marketing/{aktion/**,attribution,einwilligungen,kanaele,segmente/**}/**`, `src/app/marketing/components/StudioView.tsx` | route imports plus `rg -n "StudioView|AktionenPage|AttributionPage|SegmentePage" src` | consent/marketing unavailable boundary |
| `src/app/cockpit/components/{AgingKachel,DbRankingKachel,EngpassKachel,ForecastKachel,FruehwarnungenKachel,TopKundenKachel,WhatIfStudio}.tsx` | cockpit import search by exported component name | evidence-free forecasting/ranking/what-if removed from execution |
| `src/app/warendurchlauf/**` and `src/components/orders/{CostSummaryTable,OrderTile,PriceLinesEditor,StationContextBlock,variants/**}.tsx` | `rg -n "WarendurchlaufCockpitClient|OrderTile|PriceLinesEditor|StationContextBlock" src` | process/price UI unavailable pending W1/W3 proof |
| `src/components/customers/tabs/{CustomerAnalysisTab,CustomerCommunicationTab,CustomerComplaintsTab,CustomerHistorySimilarTab,CustomerInvoicesTab,CustomerItemsProfileTab,CustomerNotesTab,CustomerOrdersTab,CustomerOverviewTab,CustomerPricesTab}.tsx` | tab export search | customer subviews unavailable rather than cross-domain/fake data |
| `src/components/erfassung/{InquiryFlow,ManualFlow,PhoneFlow,ScanFlow,shared}/**` | capture component export search | no OCR/photo/intake assertion without contract |
| `src/components/{analytics,admin,diagnostics,kommunikation,telefonnotiz}/**`, `src/features/analyse/**`, `src/components/layout/GlobalSearchAIResult.tsx` | feature/component export search | analytics, admin policy controls, communication and AI quarantine |
| `src/app/{baeder,lager}/**`, `src/components/ui/{AnalysisChart,AnalysisOverlay}.tsx` | route/component export search | data-driven view unavailable until tenant/evidence contract |

All file-level paths in these groups are the modified paths in `git diff
--name-only origin/main...HEAD`; the pre-commit receipt records the final
machine list and `git diff --stat`. No group is ignored by ESLint or excluded
from the quality gate.

## W1/W3 status

W1 remains an isolated additive migration draft only. W3 is bound to code
commit `6cbc21f86ce776966983a5e4b33a6984a60ed5a6` and uses
`docs/foundation/W3_ROLE_MATRIX_001_POLICY_DRAFT.md`,
`supabase/migrations/drafts/W3_ROLE_MATRIX_001__POLICY_DRAFT_ONLY.sql`, and
`src/lib/auth/w3RoleMatrixDraft.ts`. These are non-executing preparation
artifacts; they do not change roles, RLS, grants, views, storage or data.

## Known release blockers

1. The Next production build did not complete locally: both default and
   Webpack attempts remained at Next's `type-checking` stage after child work
   had stopped; `.next/BUILD_ID` was not emitted. The standalone TypeScript
   check is green, but this is not a substitute for a completed Next build.
2. Fresh GitHub CI for this lint-debt commit, browser/role smoke and the W1
   laboratory migration evidence remain required. Local `npm run lint` now has
   zero errors and zero warnings; no lint rule was weakened and no quarantine
   path was ignored.
3. Browser/role smoke, W1 laboratory migration, remote CI and final PR-SHA
   binding remain outstanding; no PASS release claim is permitted before them.
