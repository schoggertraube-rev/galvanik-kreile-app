# F0_PR_CONSOLIDATION_MATRIX â€” Disposition der Foundation-Parallelarbeit

**Kandidat:** `f0/consolidation` @ `5d4d936` (Basis `main` `62af22d7`)
**Datum:** 2026-08-06

| PR | Branch | Inhalt | Disposition | BegrÃ¼ndung |
|---|---|---|---|---|
| #42 | fix/offline-synccontext-dataloss-containment | C1 Datenverlust-Stopp | **INTEGRATED (main)** | Auf ausdrÃ¼ckliche Nutzerfreigabe squash-gemergt (`62af22d7`). |
| #43 | fix/inquiries-repository-server-action | C2 + B1-Tests | **INTEGRATED (Kandidat)** | Fail-closed Auth + kein Fake-Success; tsc/lint/unit grÃ¼n. |
| #44 | fix/operational-orders-real-priority | C3/C4 + B2 | **INTEGRATED (Kandidat)** | Echter Datenvertrag Today; Mock-Typen raus. |
| #45 | docs/truthful-current-state-2026-08-06 | G1 Doku (additiv) | **INTEGRATED (Kandidat)** | Wahrheitsgetreu; ersetzt Doku-Teil von #41. |
| #46 | fix/storage-ocr-signed-urls | B4 + Tests | **INTEGRATED (Kandidat)** | Upload-Auth, Signed URLs, Negativtests. |
| #41 | fix/docs-and-offline-containment | Doku + Offline | **SUPERSEDED** | KÃ¼rzt geschÃ¼tzte Anforderungen; Doku-Teil durch #45 ersetzt. Nicht mergen. |
| #40 | codex/foundation-replay-inquiries-001 | Baseline-Ersatz (Draft) | **MATERIAL â†’ F0-03/04** | Baseline-Kandidat; wird gegen bewiesene Baseline evaluiert, nicht blind Ã¼bernommen. |
| #47 | chore/ledger-d1-d2-migrations | D1/D2 als Migrationen | **MATERIAL â†’ F0-03/04** | Idempotente Forward-Migrationen; Teil der Ledger-Reconciliation. |

## Non-Loss
Keine Arbeit verworfen. #40/#47 bleiben als Quellmaterial fÃ¼r F0-03/04 erhalten; #41 bleibt als Historie,
Inhalt additiv in #45 gesichert. Original-PRs bleiben offen, bis der F0-Kandidat freigegeben/gemergt ist.

## Status
Genau **ein** aktiver F0-Kandidat. Verbleibende Foundation-Parallelarbeit betrifft nur die Migrations-/
Ledger-Spur (F0-03/04), die bewusst getrennt und freigabepflichtig behandelt wird.