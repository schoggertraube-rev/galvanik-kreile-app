# F0_TEST_EVIDENCE — Runtime/Build/Test-Nachweis

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
| P5 | Integration | (Teil von vitest run) | — | 2 Dateien FAIL: `verify.integration.test.ts`, `scan_order.integration.test.ts` — Ursache **`DATABASE_URL is required`** (isolierte Testdatenbank nötig, F0-08 P5). Kein Unit-Defekt. |
| P6 | Build | `npm run build` (Placeholder-Env) | 0 | Next.js Build erfolgreich, alle Routen |
| P11 | Diff-Whitespace | `git diff --check` | — | offen (vor PR) |

\* VITEST_EXIT=1 stammt ausschließlich aus den zwei DB-gebundenen Integrationstests; die Unit-Suite ist vollständig grün (132/132).

## Enthaltene Integrationen (F0-02)
Dieser Kandidat faltet die vier geprüften Fix-Branches in genau einen Branch:
- `fix/inquiries-repository-server-action` (C2 + B1-Negativtests)
- `fix/operational-orders-real-priority` (C3/C4 + B2)
- `docs/truthful-current-state-2026-08-06` (G1 Doku, additiv)
- `fix/storage-ocr-signed-urls` (B4 + Negativtests)
C1 (`#42`) ist bereits in `main`.

## Offen für vollständiges F0-08
- P5 Integrationstests gegen isolierte Testdatenbank (reproduzierbar beschrieben).
- P7 Fresh-Replay als CI-Gate (F0-03).
- P8 Ledger-/Schema-/Grant-/RLS-/Storage-Parität (F0-04/05/06).
- P9 vollständige Pos/Neg-Auth/Storage-Matrix (F0-05/06).
- P10 Vercel-Preview des PR-Heads.
