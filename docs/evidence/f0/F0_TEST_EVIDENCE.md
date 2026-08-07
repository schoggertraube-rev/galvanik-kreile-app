# F0_TEST_EVIDENCE â€” Runtime/Build/Test-Nachweis

## Konsolidierte CI-Gates (Stand 2026-08-07, massgeblich)

| Gate | Mechanik | Ort |
|---|---|---|
| Fresh-Replay | leere DB -> Baseline + 7 Forward-Migrationen | CI-Job `Fresh Supabase replay` |
| Fingerprint | 6/10 Komponenten byte-exakt = Prod, hart (fingerprint-compare.mjs) | im Replay-Job |
| Negativ-/Inventartests | scripts/quality/f0_negative_tests.sql: (A) anon/authenticated grant-denial auf 5 Tabellen, (B) >=29 Haertungspolicies + keine breiten Policies ausser service_role, (C) Bucket-Limits (skip-if-absent, Daten), (D) v_auftrag_db security_invoker | im Replay-Job, NEU (F0-08) |
| Ledger-Vertrag | check-migration-ledger.mjs (Archiv 96 + Baseline + Forward) | quality |
| Forbidden Patterns | Diff-Checker mit exakter Allowlist der 3 prod-treuen Migrationen | quality |
| Client-Boundary | check-supabase-client-boundary.mjs (nur lib/supabase darf createClient) | quality |
| ESLint-Ratchet | 0 errors / 0 warnings Regression | ratchet |

Bekannte, bewusste Grenzen: pol/cons/trig known-normalization (Parse-Tree, soft); def_privs known-external;
Bucket-Zeilen sind Daten (skip-faehig); tenant-Zeilen-Sichtbarkeitstests mit Fixtures = F1-Erweiterung.


**Kandidat-Branch:** `f0/consolidation`
**Head:** `5d4d9367ec23d8d5ffbb82eb3f9cc64e11622843`
**Basis:** `main` `62af22d7b20ec4deb29dc0c1c8474baa8a1f6f65`
**Node:** v24.18.0
**Datum:** 2026-08-06

| P | Check | Befehl | Exit | Ergebnis |
|---|---|---|---:|---|
| P1 | Install | `npm ci --include=dev` (NODE_ENV=development) | 0 | OK (devDeps erzwungen; Maschine hat NODE_ENV=production/omit=dev) |
| P2 | TypeScript | `npx tsc --noEmit --incremental false` | 0 | 0 Fehler |
| P3 | Lint | `npm run lint` | 0 | 0 Fehler/Warnungen |
| P4 | Unit-Tests | `npx vitest run` | 1* | 24 Dateien / **132 Tests PASS** |
| P5 | Integration | (Teil von vitest run) | â€” | 2 Dateien FAIL: `verify.integration.test.ts`, `scan_order.integration.test.ts` â€” Ursache **`DATABASE_URL is required`** (isolierte Testdatenbank nÃ¶tig, F0-08 P5). Kein Unit-Defekt. |
| P6 | Build | `npm run build` (Placeholder-Env) | 0 | Next.js Build erfolgreich, alle Routen |
| P11 | Diff-Whitespace | `git diff --check` | â€” | offen (vor PR) |

\* VITEST_EXIT=1 stammt ausschlieÃŸlich aus den zwei DB-gebundenen Integrationstests; die Unit-Suite ist vollstÃ¤ndig grÃ¼n (132/132).

## Enthaltene Integrationen (F0-02)
Dieser Kandidat faltet die vier geprÃ¼ften Fix-Branches in genau einen Branch:
- `fix/inquiries-repository-server-action` (C2 + B1-Negativtests)
- `fix/operational-orders-real-priority` (C3/C4 + B2)
- `docs/truthful-current-state-2026-08-06` (G1 Doku, additiv)
- `fix/storage-ocr-signed-urls` (B4 + Negativtests)
C1 (`#42`) ist bereits in `main`.

## Offen fÃ¼r vollstÃ¤ndiges F0-08
- P5 Integrationstests gegen isolierte Testdatenbank (reproduzierbar beschrieben).
- P7 Fresh-Replay als CI-Gate (F0-03).
- P8 Ledger-/Schema-/Grant-/RLS-/Storage-ParitÃ¤t (F0-04/05/06).
- P9 vollstÃ¤ndige Pos/Neg-Auth/Storage-Matrix (F0-05/06).
- P10 Vercel-Preview des PR-Heads.
