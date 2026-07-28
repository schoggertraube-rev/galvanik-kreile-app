# W3-ROLE-MATRIX-001 — Least-Privilege Policy Draft

Status: `POLICY_DRAFT_BASELINE_ONLY — NO_REMOTE_MUTATION`

This document incorporates the approved role baseline dated 2026-07-28. It is
not an RLS policy, grant, migration, view change, deployment, or activation.
Its bound containment-code commit is
`6cbc21f86ce776966983a5e4b33a6984a60ed5a6`; any code change after that commit
requires a new binding and re-run of this draft's tests. The current W3
discovery snapshot is `contracts/product-security-snapshot.v1.json` and
`contracts/product-security-acl-snapshot.v1.json`; neither was mutated.

## Canonical identity and assignment contract — currently missing

| Required proof | Current local evidence | W3 decision |
| --- | --- | --- |
| identity | `app_users.id`, `app_users.tenant_id`, `app_users.active`; server resolver in `src/lib/server/authorization.ts` | retain as discovery evidence only |
| multiple explicit roles | `app_users.role` and session each carry one role | **missing**; no implicit inheritance and no new table is proposed here |
| tenant | `app_users.tenant_id`, `orders.tenant_id`, `items.tenant_id` in `src/db/schema.ts` | every later predicate must compare server-derived actor and object tenant |
| work-item assignment | `items` has `order_id` and `current_station_id`, but no canonical assignee relation | **missing**; workshop mutations cannot be released |
| operational evidence | `events` has tenant/order/item/user/event fields | append-only and actor/tenant proof remain future W3 work |

Consequently the local draft in `src/lib/auth/w3RoleMatrixDraft.ts` is tested
but intentionally not connected to runtime authorization.

## Role matrix

| Role | Allowed only after the missing contract is implemented | Explicitly denied |
| --- | --- | --- |
| `anon` | nothing | every relation, RPC, bucket and screen action |
| `werkstatt` | own explicitly assigned work-item: start, pause, complete, actual progress | any unassigned item, customer/contact/price/history/export/role/process administration |
| `buero` | customer, order, manual goods receipt, handoff | finance, price, invoice, tax, payment, export and role/process administration |
| `meister` | QA, blocker decision, priority change | implicit `buero`/`admin` rights, finance and exports |
| `admin` | explicit role, tenant-process and integration configuration | customer, operational, financial and export superuser access |
| `readonly`, `developer`, finance, marketing, consent, export, communication, telemetry, photo/OCR/AI | nothing until an owner and checked contract exist | every capability |

A user with several explicit future roles receives the union of individually
checked grants only; every check still needs actor, tenant, object and action.
The local test `src/lib/auth/__tests__/w3RoleMatrixDraft.test.ts` proves that
admin does not become operational/financial, an unassigned workshop item is
denied, and all unowned specialties remain denied.

## ACL baseline and field protection

| Object class | Catalog evidence | Draft decision |
| --- | --- | --- |
| 26 RLS-disabled relations and `v_auftrag_db` | all broad privileges for `anon`, `authenticated`, `service_role` in `contracts/product-security-acl-snapshot.v1.json` | `DENY_UNTIL_PER_OBJECT_W3_CONTRACT` |
| existing broad policies, including `orders`, `items`, finance and import objects | individual policy inventory in `docs/foundation/W3_AUTH_RLS_DISCOVERY_MANIFEST.md` | no remote change; keep app surfaces fail-closed |
| public executable functions `fn_compute_warnings`, `fn_is_production_order`, `fn_verteile_energiekosten`, `search_global` | ACL snapshot | deny product exposure until actor/tenant/evidence contract |
| ten `SECURITY DEFINER` functions | ACL snapshot; `service_role` only | private-server-only pending owner and negative tests |
| buckets `belege`, `buchhaltung-belege`, `item-photos`, `scans` | security snapshot | no browser path / upload activation |

Protected fields: prices, invoices, payment/tax, contact address/email/phone,
customer notes, audit logs and operational events are never made visible by a
client-side condition. Future policy tests must assert each field's negative
role and foreign-tenant cases at the query boundary.

## Required future ACL receipt, per object

For every table, view, function and bucket operation `SELECT | INSERT | UPDATE
| DELETE`, record: relation, fields, actor roles, server-derived tenant source,
object/assignment predicate, allowed action, UI/API consumer, positive receipt,
anon denial, wrong-role denial, cross-tenant denial and unassigned-item denial.
The existing two JSON snapshots are the complete current catalog input; no
missing tenant chain may be guessed or repaired with a generic policy.

## Additive migration and rollback draft

`supabase/migrations/drafts/W3_ROLE_MATRIX_001__POLICY_DRAFT_ONLY.sql` contains
no executable statement. A later separately approved executable successor must
be additive, relation-by-relation, have a preflight hash, use a single
canonical migration runner, and describe rollback or fail-forward before its
first remote execution. There is no rollback action for this draft because it
made no database change.

## Screen contracts before implementation

| Screen | Only contractually permitted content | Missing technical contract |
| --- | --- | --- |
| Heute | own assigned work item, due date, instruction, blocker indication | assignment relation and tenant-filtered query |
| Büro | customer/order/manual receipt/handoff without finance fields | buero role predicate and customer/order tenant proof |
| Meister | QA, blocker and priority decisions | QA evidence and role predicate |
| Admin | roles/process/integration configuration only | multi-role assignment store and audit receipts |

## Charge finding

`Charge` has no canonical data contract in the inspected schema/ACL snapshots.
It must not be implemented, inferred from station chains, or exposed as a
master exception until a separately approved canonical data contract exists.
The hardcoded station sequence remains fail-closed.

## Stop conditions before any W3 execution

Do not execute any W3 migration or policy change until a release receipt binds
the final PR SHA and required snapshot digest, all matrix rows have tests, the
missing multiple-role and work-item-assignment product decisions are supplied,
and explicit remote approval names the exact migration hashes. Remote RLS,
grant, view, storage and data changes remain unauthorized.
