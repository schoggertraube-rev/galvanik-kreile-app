# Codex Security Fix Report

- Scan ID: `8eed69b5-89fa-4a0c-a8bb-f60a30006bca`
- Scan snapshot: `codex-security-snapshot/v1:sha256:02ab32f0a32fed7a13137a4970f2c9fd1917d6b20653ba9c09117ec852fb4fb8`
- Remediation branch: `codex/foundation-security-remediation-20260715`
- Base revision: `6e1d1831be823b7655130f0f46ba964d45c4b8dc`

## Status semantics

- `FIXED_LOCAL`: the affected source path and regression boundary are locally remediated and do not require a remote schema/provider change for that control to execute.
- `FIXED_LOCAL_ROLLOUT_REQUIRED`: the source path and prepared database/provider contract are locally remediated, but live effectiveness additionally requires an explicitly approved migration, secret, Edge Function or provider rollout.
- No row below claims a production deploy, remote RLS change or live provider validation.

## Verification summary

- Full Vitest: 99 files / 403 tests passed; 2 files / 3 explicitly integration-gated tests skipped.
- TypeScript: `npx tsc --noEmit` passed.
- Production build: Next.js 16.2.6 Webpack build passed; 86/86 static pages generated.
- ESLint ratchet: passed at the reviewed ceiling of 265 historical errors and 193 warnings; new file/rule/severity debt is rejected.
- Dependency audit: high-severity gate passed after compatible lockfile updates; two moderate Next-internal PostCSS advisories remain documented.
- Independent read-only review: no confirmed P0; two P1 and two P2 addenda were fixed, tested and confirmed closed.

## Finding remediation ledger

| Finding ID / slug | Status | Remediation evidence | Verification evidence |
|---|---|---|---|
| `csf_a97bb04fb0ecf77a23e97f7a` / `pin-online-bruteforce` | FIXED_LOCAL_ROLLOUT_REQUIRED | `auth.actions.ts`, `pinLoginAttempts.ts`, `durableRateLimit.ts`; bcrypt cost 12, selector/user-bound atomic budget before bcrypt, uniform failure response; migrations `20260714000200` and `20260715000100` | login/PIN selector, durable-rate-limit and migration contract tests; full suite PASS |
| `csf_b1d2a6f11f8a94d1e06c9598` / `ocr-finance-authorization-bypass` | FIXED_LOCAL_ROLLOUT_REQUIRED | `api/ocr-process/route.ts`, `financeAuthorization.ts`; finance authorization before multipart/provider/storage/DB, server-derived tenant, private storage path; migration `20260715000200` | OCR authorization/storage negative tests, receipt-storage contract test; full suite PASS |
| `csf_02a167d93690021cd51c9aac` / `finance-open-items-action-authorization` | FIXED_LOCAL | `buchhaltung/analysis.actions.ts`; action-local `perm_view_prices`, tenant predicates on invoice/revenue reads | finance authorization and active-finance truth tests; full suite PASS |
| `csf_142bc2e6197356546fe359b4` / `finance-bwa-action-authorization` | FIXED_LOCAL | `buchhaltung/analysis.actions.ts`; finance guard and tenant-scoped BWA inputs | finance authorization and BWA truth coverage; full suite PASS |
| `csf_cc05c0bd33592c96fbf81885` / `finance-expense-action-authorization` | FIXED_LOCAL | `buchhaltung/analysis.actions.ts`; finance guard before receipt/fixed-cost access and tenant-scoped joins | finance authorization and input-contract tests; full suite PASS |
| `csf_de9f17a60dcc92d2b47054cb` / `finance-savings-action-authorization` | FIXED_LOCAL | `buchhaltung/analysis.actions.ts`; finance guard and removal of unused unsafe profile read | finance authorization/truth tests; full suite PASS |
| `csf_ec681dabe6fe65f7de6c224b` / `finance-category-action-authorization` | FIXED_LOCAL | `buchhaltung/analysis.actions.ts`; action-local finance guard before aggregation | finance authorization/truth tests; full suite PASS |
| `csf_2f4f5406fe8c4dea99896e5e` / `mollie-create-authorization` | FIXED_LOCAL | `api/payments/mollie/create/route.ts`; `perm_view_prices` and fixed tenant before JSON, DB and provider calls | negative readonly / positive authorized Mollie route tests; full suite PASS |
| `csf_1d89cf2ab085eb264acdccd7` / `mollie-stale-amount-reuse` | FIXED_LOCAL_ROLLOUT_REQUIRED | canonical DB quote, quote digest/lock, attempt reservation and stale-link handling in Mollie route/Edge code; migration `20260714000100` | payment security contract plus local PostgreSQL quote/attempt validation |
| `csf_8ce59adfa2fe178d5b0bb55e` / `mollie-terminal-state-lock` | FIXED_LOCAL_ROLLOUT_REQUIRED | monotone `completed`/`failed`/`review_required` RPC transitions and idempotent invoice finalization in migration `20260714000100` | payment tests and local PostgreSQL terminal-state validation |
| `csf_37945787789a77458b22ab0d` / `mollie-webhook-provider-amplification` | FIXED_LOCAL_ROLLOUT_REQUIRED | callback-token hash and local intent admission before provider I/O, bounded IDs/body, provider truth recheck | Mollie webhook/security tests; new secret, migration and Edge deploy still required |
| `csf_f47b364e0d25539197d48c5e` / `ai-customer-enrich-unmetered` | FIXED_LOCAL_ROLLOUT_REQUIRED | `aiUsage.ts`, HMAC request identity, reserve/claim/settle before Gemini, bounded input/output/timeout; migration `20260715000300` | AI usage/input/migration tests and local PostgreSQL ledger validation |
| `csf_b34e0b8570e39146fee7a686` / `ai-freetext-unmetered` | FIXED_LOCAL_ROLLOUT_REQUIRED | same durable identity-bound AI ledger and replay protection in proxy/Edge path | AI usage/input tests; remote ledger, secret and Edge deploy required |
| `csf_b1d5c396e25f3bb32633385e` / `ai-inquiry-unmetered` | FIXED_LOCAL_ROLLOUT_REQUIRED | bounded inquiry input and durable quota claim before delegation | AI usage/input tests; remote rollout required |
| `csf_ba6bae2507c35ebb90386223` / `ai-notes-unmetered` | FIXED_LOCAL_ROLLOUT_REQUIRED | bounded notes input, identity-bound claim and monotone settlement | AI usage/input tests; remote rollout required |
| `csf_87b0ea60983486e512eba7e6` / `kpi-insight-unmetered` | FIXED_LOCAL_ROLLOUT_REQUIRED | shared ledger for direct/service calls, KPI allowlist, field/byte/output/time limits | AI usage/input tests; remote rollout required |
| `csf_3b2e96fad00b4e98e0f1c77e` / `item-photo-permission-bypass` | FIXED_LOCAL | `api/erfassung/item-photo-upload/route.ts`; fixed tenant, `perm_op_photos` and item ownership before multipart/storage/provider | item-photo permission negative tests; full suite PASS |
| `csf_666c23bca743bd4a24e95251` / `item-photo-unmetered` | FIXED_LOCAL_ROLLOUT_REQUIRED | quota before allocation, content hash dedupe, private object, durable job and one-time vision claim; migration `20260715000400` | item-photo job/migration tests and local PostgreSQL validation |
| `csf_409f90bcdd445a958f7a975e` / `scan-upload-permission-bypass` | FIXED_LOCAL | `api/erfassung/scan-upload/route.ts`; `perm_data_orders` before multipart and all storage/DB/AI sinks | scan-upload readonly negative test; full suite PASS |
| `csf_c0318dda81e41a30da01cb7d` / `session-revocation-gap` | FIXED_LOCAL | signed session is revalidated against current tenant/user/role/active state in proxy and canonical authorization resolver | app-session, proxy-session-state and auth-helper negative tests; full suite PASS |
| `csf_3dddd52d6f27462d66a2abcd` / `ai-customer-enrich-readonly` | FIXED_LOCAL | `perm_data_customers` before body, quota and provider | readonly zero-delegation tests; full suite PASS |
| `csf_23f9a977a2a0eb5262aaa068` / `ai-freetext-readonly` | FIXED_LOCAL | `perm_data_orders` before body, quota and provider | readonly zero-delegation tests; full suite PASS |
| `csf_f9d0868d71282a863328bbc1` / `ai-inquiry-readonly` | FIXED_LOCAL | `perm_data_orders` before body, quota and provider | readonly zero-delegation tests; full suite PASS |
| `csf_2dfde6226b5bc8e9f220f4eb` / `ai-notes-readonly` | FIXED_LOCAL | `perm_data_orders` before body, quota and provider | readonly zero-delegation tests; full suite PASS |

## Independent review addenda

The post-scan independent review additionally found and closed:

1. tenant-unscoped admin user reads/mutations: all reads and writes now include tenant predicates, compare-and-set role predicates and exact mutation receipts; non-developers cannot manage developer accounts;
2. invented Warendurchlauf trend fallback: replaced with a pure real-data seven-day series, explicit zero, loading and unavailable states;
3. chunked operator-ingress buffering: replaced with an in-stream UTF-8 byte ceiling and cancellation on overflow;
4. weak application-session secret acceptance: minimum 32 UTF-8 bytes enforced at environment and signing-key boundaries.

The same reviewer confirmed all four addenda closed and reported no remaining P1/P2 in the fix delta.

## External rollout boundary

Live closure of `FIXED_LOCAL_ROLLOUT_REQUIRED` rows requires a separately approved rollout: backups and conflict preflight, migrations `20260714000100` through `20260715001700`, least-privileged runtime roles, RLS verification, required high-entropy secrets, Edge/Next deployment, real provider integration tests and rollback evidence. No such remote mutation was performed in this remediation.
