# F1.5-A · Payment and goods-out contract

## Scope and single truth

This package establishes the additive F1.5 payment contract on the existing
`public.invoices` truth. It adds payment mode, status, amounts, currency,
method, receipt/event correlation and version fields; it does not create a
second payment table. The legacy `public.payments` and `public.zahlung` paths
remain quarantined and are not read or written here.

The accepted modes are `vorkasse`, `abholung` and `rechnung`. Status is
`offen`, `teilbezahlt` or `bezahlt`; amounts are integer euro cents and the
currency is `EUR`. Storage uses the existing ASCII-safe method value
`ueberweisung` alongside `bar` and `karte`.

## Events and gate

`PAYMENT_CONFIRMED_V1` and `ORDER_PICKED_UP_V1` are append-only event
contracts on `public.events`. Their payload shape, canonical values, version,
tenant/order binding and amount/gate invariants are enforced by `NOT VALID`
checks so existing history is not rewritten. Receipt and invoice/version
unique indexes make duplicate confirmation evidence fail closed. Update/delete
triggers use the existing immutable audit trigger.

The goods-out event preserves the fixed location chain literally:
`from_station = fertig` and `station = abgeholt`. Whether the handoff is an
`abholung` or `versand` remains the event payload mode and never creates a
second location state such as `warenausgang`.

For `vorkasse`, goods-out is allowed only after `bezahlt`; `abholung` is paid
at handover; `rechnung` has no payment gate. The view exposes this as the
server-derived `goods_out_allowed` flag. Commands, provider adapters and UI
are deliberately outside package A.

## Read port and authorization sequence

`readPaymentSummary(authorization)` first requires the canonical tenant
`galvanik-kreile`, an active role in `buero|werkstatt|meister|admin`, and the
existing `perm_view_leitstand` capability. It then calls
`withPrivilegedTenantTransaction`, which installs the tenant from the already
resolved authorization snapshot before querying `private.v_payment_summary_v1`.
No client tenant value is accepted. Read results are `OK` with an empty or
validated list, `FORBIDDEN` before a transaction, or data-free `UNAVAILABLE`
for query, ambiguity or integrity failures.

The W4 inventory binding is version `v1`, owner `accounting/F1.5`, consumer
`src/lib/server/paymentSummaryRead.ts`; its fields are the migration-backed
invoice/order identifiers, total/paid/open cent amounts, mode, status,
currency, method, paid timestamp, receipt/event/correlation identifiers,
payment version and the derived `goods_out_allowed` flag.

The private view is `security_invoker=true`, tenant-filtered via
`app.tenant_id`, and granted only to `service_role`; no anonymous or
authenticated grant is added. The migration does not alter exposed-table RLS
policies.

## Verification

The unit contract test covers the filled and empty DTO, role denial before the
transaction, foreign-tenant/integrity/ambiguous/error fail-closed behavior and
the private-view query. The integration contract test creates non-vacuous own
and foreign tenant invoice/event fixtures plus a real empty tenant, asserts
exact row and event counts, verifies tenant isolation, and proves that
`ORDER_PICKED_UP_V1` accepts `abgeholt` while rejecting the obsolete
`warenausgang` value. It uses only a dedicated loopback PostgreSQL 17 database.
The blocking CI lane resets a fresh local Supabase through migration
`20260905100000` before running this test. A local run must be reported
`NOT_RUN/ENV_BLOCKER` when the explicit
`DATABASE_URL`/`F1_5_EXPECTED_DATABASE_URL` environment is unavailable; no
remote database or service-role secret is accepted.

Static commands for this package are:

```text
npx.cmd vitest run src/lib/server/__tests__/paymentSummaryRead.test.ts --maxWorkers=1 --no-file-parallelism
npx.cmd vitest run src/test/f1_5_payment_goods_out_contract.integration.test.ts --maxWorkers=1 --no-file-parallelism
npx.cmd tsc --noEmit --incremental false --pretty false
npm.cmd run lint
git diff --check
```

`supabase` CLI discovery was attempted read-only but no local CLI executable is
available, so the migration file was authored directly and remains subject to
the fresh-DB/CI replay gate. Owner decisions recorded by the mission are
bank reconciliation first, then Mollie; partial payments are allowed and
Skonto remains open/non-blocking. No adapter credentials or provider action is
part of this package.
