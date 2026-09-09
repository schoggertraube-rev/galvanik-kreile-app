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

`PAYMENT_CONFIRMED_V1`, `PAYMENT_MODE_SET_V1`, `ORDER_PICKED_UP_V1` and the
additive `ORDER_PICKED_UP_V2` are
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
at handover; `rechnung` has no payment gate. With an issued invoice the view derives
`goods_out_allowed` from the current order mode and invoice payment status.
Without an issued Rechnung invoice, only V2 with `invoiceState: not_issued`
is legal; it contains no payment status or amount.
Provider adapters and UI remain outside A+B+B2+C.

The additive V2 insert guard locks the tenant-bound order and rejects an
`ORDER_PICKED_UP_V2` unless the same Rechnung order/version is already in
`abgeholt` and no active issued invoice existed at or before the event instant.
It rejects `INVOICE_CREATED_V2` unless exactly one earlier intact
`ORDER_PICKED_UP_V2` exists for the same tenant, order and version. Both V2
receipt ports repeat the timestamp-bound historical checks; therefore the
later canonical invoice does not invalidate the earlier invoice-less goods-out
receipt. V1 constraints, events and read ports are unchanged.

## C — atomic goods-out command

`recordGoodsOut({orderId, mode, expectedVersion, clientEventId})` consumes the
current, integrity-checked row from `private.v_payment_summary_v1`; it neither
calculates a second payment truth nor books a payment. The command accepts only
`werkstatt|meister|admin`, derives tenant and actor from the server session and
serializes the order, its one active canonical invoice and linked items in one
tenant-bound transaction.

Only an exact `fertig` order/item state can move to the generic location
`abgeholt`. The transport mode remains independently recorded as
`versand|abholung`. A successful transaction increments the canonical order
version once, moves the order and linked items, appends one
`ORDER_PICKED_UP_V1` event and rereads both event and order before returning
the receipt. Same-client-event retries return that persisted receipt; a changed
intent conflicts before any write.

An active canonical invoice is required for `vorkasse` and `abholung`; both
require the existing `confirmPayment` truth `bezahlt/openAmountCents=0`.
`rechnung` with an issued invoice keeps the V1 receipt and may leave that
invoice `offen`. `rechnung` without an issued invoice produces exactly one
strict `ORDER_PICKED_UP_V2` receipt with `invoiceState: not_issued`, and no
payment fields. The invoice may then be created only through the additive
`INVOICE_CREATED_V2` path bound to that persisted goods-out receipt; its
initial payment truth is subsequently maintained by the unchanged
`confirmPayment` command.

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
The existing `fertig`/`INVOICE_CREATED_V1` path remains unchanged. For an
`abgeholt` Rechnung order, issuance is accepted only when
`private.v_invoice_issue_source_v2` confirms exactly one intact
`ORDER_PICKED_UP_V2` receipt for the current order version; its receipt is
read back through `private.v_invoice_created_receipt_v2`.

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

The blocking A integration test creates non-vacuous own and foreign tenant
invoice/event fixtures plus a real empty tenant, asserts exact row and event
counts, verifies tenant isolation, and proves that `ORDER_PICKED_UP_V1` accepts
`abgeholt` while rejecting the obsolete `warenausgang` value. The blocking CI
lane resets a fresh local Supabase through migration `20260909170000`, including
the additive V2 contract migration at that version, reruns
the F1.4 invoice regression, and then runs A, B and B2 serially as blocking
steps. The same blocking test now also drives real signed sessions through
intake, mode selection, station transition, freeze, invoice, payment and
goods-out. It proves Vorkasse and Abholung before/after payment plus the
invoice-less Rechnung sequence `ORDER_PICKED_UP_V2 -> INVOICE_CREATED_V2 ->
PAYMENT_CONFIRMED_V1`, including replay, changed intent, stale version,
foreign tenant and wrong-role denial. No command, database or receipt is
mocked on this acceptance path. Direct negative inserts additionally prove
that a V2 goods-out after an already issued invoice and an invoice V2 without
the required goods-out V2 are rejected with zero persisted event; both valid
receipt ports remain `integrity_ok=true` after invoice creation and payment. A
local integration run must be reported
`NOT_RUN/ENV_BLOCKER` when the explicit
`DATABASE_URL`/`F1_5_EXPECTED_DATABASE_URL` environment is unavailable; no
remote database or service-role secret is accepted.

The C command unit matrix is `recordGoodsOutCommand.test.ts` (7 tests): exact
input and roles, tenant denial, both transport modes, all three payment modes,
missing/cancelled/foreign invoice outcomes, partial/open payment denial, stale
version, idempotency and changed intent, linked-item integrity, atomic failure
and exact receipt/order readback. The focused local run passed on 2026-09-09.
The local supplemental test `f1_5_goods_out.integration.test.ts` builds the real
A -> B/B2 -> C path using the production intake, lifecycle, freeze, invoice,
payment-mode, payment and goods-out commands. It covers Vorkasse and Abholung
before/after full payment, Rechnung while payment remains open, foreign-tenant
and wrong-role denial, and zero order/event mutation on the negative paths. Its
cookie/session adapter is explicitly synthetic; database, domain commands,
mutations and readbacks are real. It is not a blocking Quality-lane gate. The
integrated `f1_5_payment_goods_out_contract.integration.test.ts` is the only
blocking CI acceptance gate for the A/B/B2/C Real-DB path and uses a real signed
session with request-context readback before each command.

Static commands for this package are:

```text
npx.cmd vitest run src/lib/server/__tests__/paymentSummaryRead.test.ts --maxWorkers=1 --no-file-parallelism
npx.cmd vitest run src/lib/server/commands/__tests__/confirmPaymentCommand.test.ts src/lib/server/commands/__tests__/setPaymentModeCommand.test.ts src/app/actions/__tests__/payments.actions.test.ts --maxWorkers=1 --no-file-parallelism
npx.cmd vitest run src/lib/server/commands/__tests__/recordGoodsOutCommand.test.ts --maxWorkers=1 --no-file-parallelism
npx.cmd vitest run src/test/f1_5_payment_goods_out_contract.integration.test.ts src/test/f1_5_confirm_payment.integration.test.ts src/test/f1_5_set_payment_mode.integration.test.ts src/test/f1_5_goods_out.integration.test.ts --maxWorkers=1 --no-file-parallelism
npx.cmd tsc --noEmit --incremental false --pretty false
npm.cmd run lint
git diff --check
```

The migrations were replayed with the repository-pinned Supabase CLI 2.111.0;
the fresh-DB/CI replay remains the authoritative runtime gate. Owner decisions
recorded by the mission are bank reconciliation first, then Mollie; partial
payments are allowed and Skonto remains open/non-blocking. No adapter
credentials or provider action is part of this package.
