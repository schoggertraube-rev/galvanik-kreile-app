# F0_BRANCH_INVENTORY — Remote-Branch-Snapshot (2026-08-10)

Disposition endgueltig erst nach DEC-04 (Repo-Owner).

Quelle: `git ls-remote --heads origin` gegen `schoggertraube-rev/galvanik-kreile-app`, gezogen am
2026-08-10 VOR dem Push von `f0/w1-governance-truth` (dieser Branch/PR erscheint deshalb unten
noch nicht als eigene Zeile in der Rohliste; er ist der Kontext, in dem diese Datei entsteht).

Disposition-Regeln: `main` = CANONICAL; `agent/f0-marble-truth-repair` = DELETED_2026-08-10 (im
Snapshot nicht mehr gelistet — Abwesenheit ist der Beleg; falls sie remote doch wieder auftauchen
sollte: als "bereits geloescht" behandeln, NICHT neu anlegen); `archive/*`, `checkpoint/*` =
KEEP_ARCHIVE; alle anderen = UNKNOWN_PENDING_DEC-04.

| short-SHA | branch | Disposition |
|---|---|---|
| f13f033 | agent/docs-rls-architecture | UNKNOWN_PENDING_DEC-04 |
| 46c0e24 | agent/docs-update-and-m3 | UNKNOWN_PENDING_DEC-04 |
| 418ea53 | agent/m4-sec-pin-002b | UNKNOWN_PENDING_DEC-04 |
| (absent) | agent/f0-marble-truth-repair | DELETED_2026-08-10 (nicht mehr im Snapshot gelistet, bereits geloescht) |
| c3b9f20 | archive/db-truth-main-source-c3b9f20 | KEEP_ARCHIVE |
| d6bbfc2 | archive/db-truth-pr30-source-d6bbfc2 | KEEP_ARCHIVE |
| 5b5aa76 | archive/db-truth-replay-source-5b5aa76 | KEEP_ARCHIVE |
| f0090ab | archive/pr-15-capture-auth-tenant-f0090ab | KEEP_ARCHIVE |
| 338a13c | archive/pr-19-foundation-security-338a13c | KEEP_ARCHIVE |
| 2589fde | archive/pr-20-foundation-consolidation-2589fde | KEEP_ARCHIVE |
| 007b85b | archive/pr-8-auth-identity-002-007b85b | KEEP_ARCHIVE |
| bec424f | checkpoint/order-flow-source-stable-2026-06-16 | KEEP_ARCHIVE |
| dad42eb | checkpoint/sec-pin-002-no-merge-20260801 | KEEP_ARCHIVE |
| 7e2a3e1 | chore/company-agent-governance | UNKNOWN_PENDING_DEC-04 |
| 411a28a | chore/control-plane-min-ci | UNKNOWN_PENDING_DEC-04 |
| b005c6c | chore/cowork-control-plane | UNKNOWN_PENDING_DEC-04 |
| 73b2d5a | chore/ledger-d1-d2-migrations | UNKNOWN_PENDING_DEC-04 |
| f085b75 | chore/minimal-mission-runtime | UNKNOWN_PENDING_DEC-04 |
| 0f3abc8 | ci/agentur-gate-to-main | UNKNOWN_PENDING_DEC-04 |
| 2589fde | codex/foundation-consolidation-v3-20260728 | UNKNOWN_PENDING_DEC-04 |
| b340b7e | codex/foundation-gap-fill-001 | UNKNOWN_PENDING_DEC-04 |
| 5b5aa76 | codex/foundation-migration-reconciliation-20260801 | UNKNOWN_PENDING_DEC-04 |
| 2c597e9 | codex/foundation-replay-inquiries-001 | UNKNOWN_PENDING_DEC-04 |
| 338a13c | codex/foundation-security-remediation-20260715 | UNKNOWN_PENDING_DEC-04 |
| 33f3e7d | codex/p0-hotfix-no-pin-payload | UNKNOWN_PENDING_DEC-04 |
| 4bce02d | codex/p0-hotfix-no-pin-payload-clean | UNKNOWN_PENDING_DEC-04 |
| e1b8b8e | codex/w0-api-02f-scan-upload-02 | UNKNOWN_PENDING_DEC-04 |
| b64daf2 | codex/w1-runtime-receipts-20260801 | UNKNOWN_PENDING_DEC-04 |
| 1b6150e | docs/plan-sync-001 | UNKNOWN_PENDING_DEC-04 |
| 0310694 | docs/truthful-current-state-2026-08-06 | UNKNOWN_PENDING_DEC-04 |
| c1df216 | f0/consolidation | UNKNOWN_PENDING_DEC-04 |
| a4b15b8 | feature/appvernetzung-a1-data-truth | UNKNOWN_PENDING_DEC-04 |
| f0090ab | feature/capture-auth-tenant | UNKNOWN_PENDING_DEC-04 |
| 823a7f9 | feature/gemini-model-router | UNKNOWN_PENDING_DEC-04 |
| 21a871f | feature/integration-capture-r15e | UNKNOWN_PENDING_DEC-04 |
| b7f52b3 | feature/right-nav-focus | UNKNOWN_PENDING_DEC-04 |
| ecb0f49 | feature/rls-core-migrations | UNKNOWN_PENDING_DEC-04 |
| 286cdb6 | feature/rls-r1a-items-timeline-server-bridge | UNKNOWN_PENDING_DEC-04 |
| efc3850 | feature/rls-r2-customers-server-bridge | UNKNOWN_PENDING_DEC-04 |
| 35f8a2d | feature/rls-r3-baths-server-bridge | UNKNOWN_PENDING_DEC-04 |
| 94f68ba | feature/ui-cleanup-after-search-live | UNKNOWN_PENDING_DEC-04 |
| 007b85b | fix/auth-identity-002-root | UNKNOWN_PENDING_DEC-04 |
| 2f9cfcd | fix/auth-session-permissions-2026-06-17 | UNKNOWN_PENDING_DEC-04 |
| 8d8116d | fix/docs-and-offline-containment | UNKNOWN_PENDING_DEC-04 |
| 70630aa | fix/inquiries-repository-server-action | UNKNOWN_PENDING_DEC-04 |
| 9299463 | fix/live-auth-relogin | UNKNOWN_PENDING_DEC-04 |
| bec031f | fix/offline-synccontext-dataloss-containment | UNKNOWN_PENDING_DEC-04 |
| ee60b0b | fix/operational-orders-real-priority | UNKNOWN_PENDING_DEC-04 |
| d7af93f | fix/orders-auth-after-a1-a2 | UNKNOWN_PENDING_DEC-04 |
| 88c8bd2 | fix/storage-ocr-signed-urls | UNKNOWN_PENDING_DEC-04 |
| 5a1b4c9 | hotfix/main-build-repair | UNKNOWN_PENDING_DEC-04 |
| a3d7db7 | main | CANONICAL |
| 259c635 | r14c/s1-production-orders-view | UNKNOWN_PENDING_DEC-04 |
| 4cec680 | r15/scan-upload-security-lazy-init | UNKNOWN_PENDING_DEC-04 |
| 105d1fa | repair/f0-migration-ledger-reviewed | UNKNOWN_PENDING_DEC-04 |
| e9faa4f | repair/m03-auth-foundation | UNKNOWN_PENDING_DEC-04 |
| 2050ac8 | review/G-2026-0001-scan-order-persistenz | UNKNOWN_PENDING_DEC-04 |
| 07f25a5 | test/r5-negativ-20260713 | UNKNOWN_PENDING_DEC-04 |

56 Branches im Snapshot (ohne `main`) + `main` = 57 Zeilen aus `git ls-remote`, plus die separate
Zeile fuer den bestaetigt abwesenden `agent/f0-marble-truth-repair` = 58 Tabellenzeilen gesamt.
Mehrfach auftauchende SHAs (z.B. `2589fde`, `5b5aa76`, `338a13c`, `f0090ab`, `007b85b`) sind
mehrere Branch-Namen auf demselben Commit — kein Widerspruch, sondern Altlast paralleler
Benennung; Einzelentscheidung je Branch bleibt DEC-04 vorbehalten.
