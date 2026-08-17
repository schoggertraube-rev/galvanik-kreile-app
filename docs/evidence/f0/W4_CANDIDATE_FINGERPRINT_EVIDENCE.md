# W4 Candidate Fingerprint Evidence

Stand: 2026-08-12

## Status

| Gate | Status |
|---|---|
| `W4_LOCAL` | `PASS_LOCAL`; `F0_W4_REVIEW_READY` |
| `OVERALL_F0` | `BLOCKED_EXTERNAL_PERMISSION` |
| Static contract and checker | `PASS` |
| Local PostgreSQL 17 DB/Storage/runtime execution | `PASS_LOCAL` |
| Committed local capture hashes | `CAPTURED_LOCAL` |
| Frozen nine-migration cutoff vs committed Production hard fingerprint | `PASS_LOCAL`; `FINGERPRINT_HARD_FAILS=0`, 7 exact components |
| Exact 9-to-13 full-catalog delta | `PASS_LOCAL`; exactly 312 ADD, no CHANGE/REMOVE |
| Exact-11 W3 integration | `PASS_LOCAL`; 19/19 tests |
| Full-13 W4 evidence hybrid integration | `PASS_LOCAL`; 14/14 tests |
| Second full-13 replay determinism and strict check | `PASS_LOCAL` |
| Independent Step-5 receipt review | `PASS` |
| GitHub CI workflow | `NOT_RUN` |
| Full build and full repository unit suite | `PASS_LOCAL`; build PASS, 87/87 files and 551/551 tests |
| Live-current Production parity | `BLOCKED_EXTERNAL_PERMISSION` |
| Current full-catalog Production parity | `BLOCKED_EXTERNAL_PERMISSION/BOOTSTRAP_DECISION` |
| Remote migration | `NOT_RUN` |
| Production, RLS, policy, grant, default-ACL or bucket mutation | `NOT_RUN` |

The local candidate contract is captured and reproducible. `PASS_LOCAL` is
limited to the named local gates and does not close current full-catalog
Production parity, Remote/Production, CI or Production-RLS. The local
`postgres` role has `rolbypassrls`; this replay is
catalog, migration, integration, and local Storage-runtime evidence, never
Production-RLS proof.

## Frozen sources

| Source | Required SHA-256 |
|---|---|
| `docs/evidence/f0/PROD_FINGERPRINT_REFERENCE.txt` | `7d3a6d679e8e32e064297901d43fe2eacfe2a7681e408a76206a85ef6c2e4fcb` |
| `scripts/schema-parity-catalog.sql` | `175b8ca9f8b964532ef8ad6a5cff710fcea833874ceb5f7b1f7cf358f5a1357d` |
| `docs/evidence/f0/hardening/f0_schema_fingerprint.sql` | `814c888d0d9b25fdc7fdd066eddc9c34887e07fe839bc2702e6250e3a004f315` |
| `scripts/schema-parity-inventory.json` | `060de7673beef3d9eaa73289dc04159e262137e23bb437354dccffd363696d4b` |

`scripts/schema-parity-inventory.json` is hash-verified historical evidence
captured on 2026-08-06. Its 3,839-object inventory is not a current replay or
Production-parity reference. Establishing a new current full-catalog baseline
requires separate Production read permission and an explicit bootstrap
decision; this atom neither infers nor creates that baseline.

## Initial local runtime stop

The initial local preflight found no Docker Desktop Linux engine pipe. Docker
Desktop was started locally in a hidden window and the single existing stack
was reused; no second stack or remote service was started. The first cutoff
reset then completed, but capture stopped because Windows `psql` rendered the
PostgreSQL version with headers and a footer when the connection URL preceded
the formatting arguments. The checker was corrected to place deterministic
`-X -q -A -t -P pager=off -P footer=off` arguments before the loopback URL.

The first authorized local run stopped at the historical-inventory comparison,
before any candidate reset or contract materialization. The exact result was
`3812` captured objects versus `3839` historical objects. Category counts were:

| Category | Local cutoff replay | Historical 2026-08-06 inventory |
|---|---:|---:|
| column | 1309 | 1312 |
| constraint | 252 | 253 |
| default_privilege | 74 | 72 |
| extension | 5 | 5 |
| function | 21 | 21 |
| function_grant | 41 | 50 |
| index | 177 | 178 |
| policy | 67 | 71 |
| relation | 111 | 113 |
| relation_grant | 1727 | 1736 |
| storage_bucket | 4 | 4 |
| trigger | 7 | 7 |
| view | 17 | 17 |

These counts prove only that the two captures are not the same inventory. They
do not prove that all 27 net missing entries are expected, equivalent, safe, or
fully classified. Current full-catalog parity therefore remains
`BLOCKED_EXTERNAL_PERMISSION/BOOTSTRAP_DECISION`.

The approved semantic split removed that false current-parity gate while
retaining the historical inventory SHA. No bootstrap, migration, reference
rewrite, or fifth path was introduced. Later, the first Step-5 command stopped
at PowerShell parse time before CLI/reset execution because a generic byte-array
method call used invalid PowerShell syntax. A subsequent read-only precheck also
stopped before mutation because a known Supabase deprecation warning on stderr
was promoted to `NativeCommandError`. Independent review confirmed both stops
preceded their intended mutations. The final one-time Step-5 continuation used
four separate fail-fast operations and completed successfully.

The exact ordered ledger is pinned in the JSON contract: nine migrations
through `20260810100000`, then W3 `20260811150000`, W4-01
`20260811154732`, W4-03 `20260811184850`, and the Evidence-Read-Vertrag
`20260812103446`. Every migration file is hashed from raw bytes. There are no
duplicate, missing, reordered, or extra versions.

## Exact candidate delta

| Kind | ADD |
|---|---:|
| relation | 9 |
| column | 156 |
| constraint | 40 |
| index | 15 |
| view | 5 |
| trigger | 15 |
| relation grant | 72 |
| **Total** | **312** |

Migration attribution is `2 / 60 / 120 / 130` for W3 / W4-01 / W4-03 /
Evidence-Read-Vertrag. This provenance is derived from the exact 13
source-file hashes plus the frozen 312-key manifest; it is not claimed as a measured intermediate-catalog
capture. The strict local check proved every key ADD-only: absent at the
nine-migration baseline and present exactly once with its committed candidate
payload SHA-256.

The captured contract contains 72 relation-grant records: exactly nine new relations times the eight
effective PostgreSQL 17 owner privileges `DELETE`, `INSERT`, `MAINTAIN`,
`REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, and `UPDATE`. Grantee and grantor
are `postgres`; `grantable` is false. The capture also proved that these
effective owner records do not change the explicit `c.relacl`-based `grants`
fingerprint.

Forbidden deltas are `CHANGE`, `REMOVE`, function, policy, default ACL, bucket,
and non-owner grant. The changed fingerprint components are exactly `cols`,
`idx`, `cons`, `trig`, `rls`, and `viewopts`. `func`, `pol`, `grants`,
`func_grants`, and `def_privs` remained byte-identical.

## Executed deterministic local order

Catalog rows use strict canonical JSON, UTF-8 bytewise key order, base64, and
decimal byte-length frames. Columns cover type, nullability, default,
identity, generated expression and collation; constraints cover type,
validation and definition; indexes cover validity, readiness, live state,
key vector, uniqueness, primary state and definition; triggers cover enable state and definition;
views cover the exact `pg_get_viewdef(oid, true)` string and relation options;
relations cover kind and RLS flags; ACL payloads cover grantor and grantability.

The single DB worker executed:

1. verify the four frozen sources and Supabase CLI `2.111.0`;
2. start one local stack and assert PostgreSQL major 17;
3. reset without seed to the exact nine-migration Production cutoff, capture
   ledger/catalog/fingerprint, and run the existing hard Production fingerprint
   comparator; the historical 3,839-object inventory is not used as a current
   replay/parity gate;
4. reset without seed to all 13 migrations, capture, deterministically
   materialize the committed contract, and run the strict checker plus its
   mutation-free selftest;
5. run the unchanged exact-11-ledger W3 predecessor test at its cutoff, restore
   all 13 migrations, and run the W4 evidence hybrid integration against the real
   loopback Storage/API runtime;
6. reset all 13 migrations a second time and require byte-identical catalog,
   fingerprint and ledger captures, then run the strict checker against the
   unchanged committed contract.

The W3 integration passed 19/19 tests and the extended W4 integration passed
14/14 tests. The complete unit suite passed 87/87 files and 551/551 tests; the
production build passed with local redacted runtime variables. GitHub CI and
Remote/Production gates were not run.

The selftest rejects missing, unexpected, duplicate, reordered, removed and
changed objects; same-name view drift; payload mismatch; non-owner/grantable
grants; changed unchanged-components; incomplete fingerprints; ledger and
source drift; pending capture; incomplete arguments; remote database URLs; and
non-PostgreSQL-17 capture.

## External boundary

No remote or Production database was queried or changed by this local atom.
No deployment, push, merge, remote migration, remote RLS/policy/grant/default-ACL
mutation, remote bucket mutation, or Remote/Production data mutation or deletion
occurred. The CI contract intentionally resets and mutates only its disposable
local database and local test fixtures. Live-current Production parity remains
`BLOCKED_EXTERNAL_PERMISSION` until separately authorized live evidence exists.

## Capture receipt fields

| Receipt | Value |
|---|---|
| Supabase CLI | pinned installed binary, `2.111.0` |
| baseline catalog SHA-256 | `a928c98f1e4470f734ae1e9686c6c98bcf03fc5876ba44e038a20ab14095f84b` |
| candidate catalog SHA-256 | `25b91a7408d022ccbe92b7b26f9f50954dd56f5a935a08f1f9ca6eb6dd756908` |
| candidate catalog replay 2 | byte-identical; 1,093,433 bytes; SHA-256 `25b91a7408d022ccbe92b7b26f9f50954dd56f5a935a08f1f9ca6eb6dd756908` |
| candidate fingerprint replay 2 | byte-identical; 479 bytes; file SHA-256 `5795e078dae63b17ae616a01aaa4835aca3b3430a777fa9ad80c0131197d1eb1` |
| candidate ledger replay 2 | byte-identical; 1,873 bytes; file SHA-256 `c3bbe08a8b6c631d26704b1f1a2ef347f2dbb9dc98f4fe0df69e71a4d0952c8f` |
| strict candidate check, replay 1 | `PASS`; exactly 312 ADD |
| strict candidate check, replay 2 | `PASS`; exactly 312 ADD |
| contract SHA-256 | `f17e2abbb78144ef87bdc11a0cfdd520b40123c295665e13c7ebf0061597cb53` |

### Baseline fingerprint

| Component | MD5 |
|---|---|
| `cols` | `298ae919741dd003962021f8f1d5fa84` |
| `idx` | `0e3988277b7e1c7ed57847e92c4515b8` |
| `cons` | `ab2ccc970011f5e19962d3f6b32d3b7f` |
| `trig` | `8de4fbc789ec73827b80daa36b4463d5` |
| `func` | `a6d8df6999952e773e32a1bd944f275e` |
| `pol` | `0ad24fe9d82a4a0671ccb3502b5c322b` |
| `rls` | `7176c1c699aa26fb0c23276c53341087` |
| `grants` | `01feb57e0cbb387abb9842f7f07c6413` |
| `func_grants` | `2d91f6b46df3bcdaa48daea0f5e37388` |
| `def_privs` | `5b26728e4bd65edd20d38a4afb4997e5` |
| `viewopts` | `037165d741eb34e0177f0c3cb27fb76a` |

### Candidate fingerprint

| Component | MD5 |
|---|---|
| `cols` | `a573359ddf20c0b99868b6daed7dcc91` |
| `idx` | `bb2d8ae4c2a264a05cdcadf1ff5c9a2f` |
| `cons` | `91b6b6af234eb057a1ccb0b5bbb3b550` |
| `trig` | `585fecf6f0604b6ab85f59aea3d8ee4a` |
| `func` | `a6d8df6999952e773e32a1bd944f275e` |
| `pol` | `0ad24fe9d82a4a0671ccb3502b5c322b` |
| `rls` | `264e3d4285532a7503c8c98bab4828c1` |
| `grants` | `01feb57e0cbb387abb9842f7f07c6413` |
| `func_grants` | `2d91f6b46df3bcdaa48daea0f5e37388` |
| `def_privs` | `5b26728e4bd65edd20d38a4afb4997e5` |
| `viewopts` | `2079cebbcdbe9b6d8fcf3b2630e7805e` |

Canonical checker entry after capture:

```text
node scripts/quality/check-w4-candidate-schema.mjs --materialize-contract --baseline-catalog w4-baseline.catalog --candidate-catalog w4-candidate.catalog --baseline-fingerprint w4-baseline-fingerprint.json --candidate-fingerprint w4-candidate-fingerprint.json --ledger w4-candidate-ledger.json --output docs/evidence/f0/W4_CANDIDATE_SCHEMA_CONTRACT.json
node scripts/quality/check-w4-candidate-schema.mjs --check --baseline-catalog w4-baseline.catalog --candidate-catalog w4-candidate.catalog --baseline-fingerprint w4-baseline-fingerprint.json --candidate-fingerprint w4-candidate-fingerprint.json --ledger w4-candidate-ledger.json
```

The materialization command validated the pending manifest and captured inputs,
computed all 312 payload hashes, both catalog hashes and all 22 component
hashes, and changed the status to `CAPTURED_LOCAL`. No pending value was
manually invented. The checker and selftest passed immediately afterward; the
second replay then passed against the unchanged committed contract.
