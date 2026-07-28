# W1 – Runtime-Receipt-Reconciliation

## Status

`PENDING_LAB_AND_PRODUCT_APPROVAL`

This is an additive compatibility wave for the canonical product target only.
It is not applied anywhere yet.

| Field | Value |
| --- | --- |
| Target | Supabase `syhaigjhsbpjmtnggqka` (`CANONICAL_PRODUCT_SYSTEM`) |
| Migration | `20260728124147_foundation_w1_runtime_receipt_columns.sql` |
| Candidate source SHA | `abecbaf669bf9b14c461a7084e4d492df02a64ea` — locally committed after the non-bypassed pre-commit gate; do not apply remotely |
| Approval ID | `UNASSIGNED — product mutation not approved` |
| Canonical runner | `supabase migration up` against the approved target only |
| Explicitly forbidden runner | `supabase db push` |

## Reason and scope

The product runtime was independently observed failing with PostgreSQL `42703`
for all three fields below. The current code-to-product contract now has exactly
these three mismatches; legacy-only `inquiries.converted_*`, `qs`, and
`lager_artikel` declarations were removed as `DROP_AS_FALSE_TRUTH`, not turned
into a new product schema.

| Consumer / evidence | Relation | Required structure | W1 decision |
| --- | --- | --- | --- |
| process transition receipt | `public.events` | nullable `client_event_id uuid` | add |
| PIN/help audit receipt | `public.audit_log` | nullable `tenant_id text` | add |
| PIN/help retry receipt | `public.audit_log` | nullable `client_request_id uuid` | add |

Expected catalog diff, and nothing else:

1. three nullable columns above;
2. unique B-tree partial index `events_tenant_client_event_uidx` on `(tenant_id, client_event_id)` where both are non-null;
3. unique B-tree partial index `audit_log_tenant_request_action_uidx` on `(tenant_id, client_request_id, action)` where both request columns are non-null.

W1 does **not** alter rows, RLS, policies, grants, roles, storage, views,
functions, business values, or delete anything.

## Preconditions and invariants

Before execution, the runner must prove all of the following from the target
catalog and data:

- `public.events` and `public.audit_log` exist;
- the three columns are absent or exactly the declared types;
- `public.audit_log.action` is `text NOT NULL`;
- no duplicate non-null `(tenant_id, client_event_id)` values exist in `events`;
- no duplicate non-null `(tenant_id, client_request_id, action)` values exist
  in `audit_log`;
- an existing object with either index name either satisfies the complete index
  contract or aborts the whole transaction;
- lock timeout is five seconds and statement timeout is two minutes.

The partial predicates intentionally allow historical null values. They impose
idempotency only on a caller that supplies both a tenant and a stable request
identifier. A null identifier must never be treated as a receipt.

## Migration semantics

The migration runs one transaction. It validates index class, schema, target
table, uniqueness, readiness, liveness, key count/order, expression-free
definition, and partial predicate both before and after `CREATE INDEX IF NOT
EXISTS`. A collision, incompatible type, duplicate, lock timeout, or invalid
index aborts the full transaction.

The process command path remains fail-closed until a later receipt/retry proof:
it carries `clientEventId`, but it may not be reopened merely because W1 exists.
The PIN/help audit writer is likewise still gated. W1 is schema compatibility,
not a claim that either product feature is live.

## Required isolated-lab proof

The laboratory is `TEST_INSTRUMENT_ONLY`; it must not receive production rows.

1. Record migration hash, product snapshot fingerprint, ledger and index catalog before execution.
2. Run the canonical migration runner once, preserving the same migration file.
3. Read back ledger, all three column types/nullability, both index definitions,
   duplicate invariants and snapshot fingerprint.
4. Repeat the exact runner to prove idempotency.
5. Exercise negative cases in an isolated pre-state: wrong existing named object,
   incompatible type, duplicate receipt values, and lock timeout.
6. Prove that an aborted case leaves no partial W1 change.
7. Record the candidate SHA, all hashes and runner output in the evidence index.

Current local lab attempt is blocked because the local Supabase runner cannot
connect to a local Postgres instance. This is not a reason to use a second
transport or product SQL console. The safe recovery is a provisioned isolated
lab or an authorized canonical runner execution after this manifest is complete.

## Forward fix and post-approval readback

If W1 fails, do not edit an applied migration. Preserve the failure receipt,
investigate the exact precondition, and create a new additive forward migration
only after review. Never use rollback-by-delete for this wave.

Only after a single explicit product approval may the canonical runner target
`syhaigjhsbpjmtnggqka`. Immediately afterwards read and compare:

- migration ledger;
- schema fingerprint and three column definitions;
- full index catalog contracts;
- duplicate invariants;
- runtime receipt behavior, reload, retry and tenant-negative cases.

Any difference from the expected catalog diff stops the rollout.
