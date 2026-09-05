# F1.5 A+B+B2 · Payment, mode and goods-out contract

## Scope and single truth

The additive F1.5 payment contract keeps payment amounts and status exclusively
on the existing `public.invoices` truth. D-F15-002 adds the current payment mode
to `public.orders` at intake with default `vorkasse` and an independent
`payment_mode_version`. An invoice stores the immutable mode snapshot from its
issuance; the private summary and later goods-out gate use the current order
mode. No second payment table exists. The legacy `public.payments` and
`public.zahlung` paths remain quarantined and are not read or written here.

The accepted modes are `vorkasse`, `abholung` and `rechnung`. Status is
`offen`, `teilbezahlt` or `bezahlt`; amounts are integer euro cents and the
currency is `EUR`. Storage uses the existing ASCII-safe method value
`ueberweisung` alongside `bar` and `karte`.

## Events and gate

`PAYMENT_CONFIRMED_V1`, `PAYMENT_MODE_SET_V1` and `ORDER_PICKED_UP_V1` are
append-only event contracts on `public.events`. Their payload shape, canonical
values, version, tenant/order binding and amount/gate invariants are enforced
by `NOT VALID` checks so existing history is not rewritten. Receipt and
aggregate-version indexes make duplicate evidence fail closed. Update/delete
triggers use the existing immutable audit trigger.

The goods-out event preserves the fixed location chain literally:
`from_station = fertig` and `station = abgeholt`. Whether the handoff is an
`abholung` or `versand` remains the event payload mode and never creates a
second location state such as `warenausgang`.

For `vorkasse`, goods-out is allowed only after `bezahlt`; `abholung` is paid
at handover; `rechnung` has no payment gate. The view derives
`goods_out_allowed` from the current order mode and invoice payment status.
Provider adapters, goods-out commands and UI remain outside A+B+B2.

## Intake, invoice and command contract

`createOrderIntake` relies on the guarded database default and verifies exact
readback of `payment_mode = vorkasse` and `payment_mode_version = 0` before it
returns. Direct inserts with another initial mode or version fail closed.
`setPaymentMode` accepts only `vorkasse|abholung|rechnung`, authorizes exactly
`buero|meister|admin`, locks the tenant-bound order and uses the independent
mode version for optimistic concurrency. The same `clientEventId` and intent
replays the exact receipt; a changed intent conflicts. A direct mode update or
a change after `abgeholt`/`ORDER_PICKED_UP_V1` is rejected without mutation.

`createInvoice` initializes contract version 1 at the real insert: immutable
mode snapshot, status `offen`, paid amount 0, full gross amount open, currency
`EUR`, payment version 0 and empty receipt fields. It validates exact payment
readback while preserving the existing F1.4 snapshot, PDF and lifecycle
receipt. Fresh payment confirmation locks the same order before its invoice,
so invoice issuance, mode changes and payments serialize. Historical
`PAYMENT_CONFIRMED_V1` receipt replay remains independent of later order-mode
changes because the event and invoice retain the issuance snapshot.

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
invoice/order identifiers, total/paid/open cent amounts, current order mode,
mode version, status, currency, method, paid timestamp,
receipt/event/correlation identifiers, payment version and the derived
`goods_out_allowed` flag.

The private view is `security_invoker=true`, tenant-filtered via
`app.tenant_id`, and granted only to `service_role`; no anonymous or
authenticated grant is added. The migration does not alter exposed-table RLS
policies.

## Verification

The unit contracts cover DTO integrity, command input and role gates,
idempotency, intent conflicts, stale versions, state/event readback and
data-free failures. The B2 real-DB test follows the production path
`createOrderIntake -> station transition -> freeze -> createInvoice ->
confirmPayment`, proves partial and full payment immediately on the canonically
created invoice, and never inserts or updates invoice payment fields directly.
It also proves all allowed mode-command roles, tenant isolation, changes before
and after invoice issuance, immutable invoice snapshot versus current order
mode, direct-mutation rejection and the post-goods-out conflict.

The A integration test creates non-vacuous own and foreign tenant
invoice/event fixtures plus a real empty tenant, asserts exact row and event
counts, verifies tenant isolation, and proves that `ORDER_PICKED_UP_V1` accepts
`abgeholt` while rejecting the obsolete `warenausgang` value. The blocking CI
lane resets a fresh local Supabase through migration `20260905201850`, reruns
the F1.4 invoice regression, and then runs A, B and B2 serially as blocking
steps. A local integration run must be reported
`NOT_RUN/ENV_BLOCKER` when the explicit
`DATABASE_URL`/`F1_5_EXPECTED_DATABASE_URL` environment is unavailable; no
remote database or service-role secret is accepted.

Static commands for this package are:

```text
npx.cmd vitest run src/lib/server/__tests__/paymentSummaryRead.test.ts --maxWorkers=1 --no-file-parallelism
npx.cmd vitest run src/lib/server/commands/__tests__/confirmPaymentCommand.test.ts src/lib/server/commands/__tests__/setPaymentModeCommand.test.ts src/app/actions/__tests__/payments.actions.test.ts --maxWorkers=1 --no-file-parallelism
npx.cmd vitest run src/test/f1_5_payment_goods_out_contract.integration.test.ts src/test/f1_5_confirm_payment.integration.test.ts src/test/f1_5_set_payment_mode.integration.test.ts --maxWorkers=1 --no-file-parallelism
npx.cmd tsc --noEmit --incremental false --pretty false
npm.cmd run lint
git diff --check
```

The B2 migration was created with the repository-pinned Supabase CLI 2.111.0;
the fresh-DB/CI replay remains the authoritative runtime gate. Owner decisions
recorded by the mission are bank reconciliation first, then Mollie; partial
payments are allowed and Skonto remains open/non-blocking. No adapter
credentials or provider action is part of this package.
