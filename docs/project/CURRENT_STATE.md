# CURRENT_STATE — Galvanik-Kreile WerkstattCockpit

**Lieferstand 2026-09-10: `main@13240de2a5ca9e9cfae4f8c72552443dac1d7630`.** Diese Datei
beschreibt ausschließlich auf `main` belegte Lieferungen. Aktives Paket, Branch, Base, Kandidatenstatus
und nächstes Gate stehen ausschließlich in `missions/F1_ORDER_TO_CASH_PILOT_001.yml`. Die
ausführlichen F0-Tabellen darunter sind ein datierter historischer Snapshot.

## Auf main belegte Lieferwahrheit

### Sichtbare Produktwahrheit nach D-UI-CORE-001

| Oberfläche/Vertrag | Belegter Stand auf `main` |
|---|---|
| Backend/Fachverträge | `PARTIALLY_REAL` |
| S4 Werkstatt-Innenmodul | `DELIVERED` |
| Gesamte Zieloberfläche | `OWNER_UX_FAIL / NOT_DELIVERED` |
| Orders/Auftragskarte V8 | `NOT_DELIVERED` |
| Customers/Kundenkarte V2 | `NOT_DELIVERED` |
| Rollen-Startseiten Phillip V4/Rolf V8 und Zielnavigation | `NOT_DELIVERED` |
| Production-Sichtstand | `LEGACY_SHELL / NOT_TARGET / NOT_LIVE_CAPABLE_TOTAL_APP` — Production ist kein Beleg für die Zieloberfläche oder eine livefähige Gesamt-App |
| `/start` als reiner unauthentifizierter Login und `/` als einziges Rollen-Home | `NOT_DELIVERED` |
| Zielnavigation gemäß D-UI-CORE-002 | `NOT_DELIVERED`; Alt-Shell und sichtbare Altmodule bestehen noch |
| Orders V8 / Customers V2 als identische Listen-, Detail- und Overlay-Wahrheit | `NOT_DELIVERED` |
| Kalenderroute | `BLOCKING_VISIBLE_LEGACY_PROVIDER_CLAIM`; aktuell sichtbare Google-Calendar-Behauptung, keine akzeptierte Kalender-Capability |

Ein geliefertes Innenmodul oder ein grüner Fachvertrag ist ausdrücklich kein Full-Route-/UX-PASS.
Die nächste Produktpriorität wird ausschließlich in der aktiven Mission gesteuert; diese Datei nimmt
keinen Kandidaten als geliefert vorweg.

| Wahrheit | Stand |
|---|---|
| M1-Integration | PR #61 am eingefrorenen Head `75bdaf8458aef3606ede50b393a0b06fa0fbe9f3` als Merge-Commit `6b4d482bae9f2797bb5171c8cdf4b817cb1b549d` nach `main` integriert |
| F0/W4 | unabhaengig `PASS`; Pruefpaket `d16363dee8e38bf64dbb31ed135a93972d91b6f1`, Produktkandidat `e3138f9286775bf6e79c0b5b1845ff72a0230b62` |
| F1.1 Digitaler Wareneingang | unabhaengig `PASS`; Evidence-SHA `228316b7674d3363a9ab62d97b41500bd1409395` |
| F1-R0 | `PASS`; Gate `0/0/PASS`, unabhaengige Exact-SHA-Abnahme `PASS`, `OPEN_P0_P1_ACCEPTANCE=NONE` |
| M0 Konsolidierung | PR-Integration `PASS`; `02_app` ist wieder der kanonische Checkout auf `main`; Altinhalte wurden vor der Bereinigung verlustfrei extern gesichert |
| F1.2 Werkstattdurchlauf | `PASS`; D-F12-001A (`angenommen -> galvanik`) am eingefrorenen Head `66abf36aec49a7032db97d0b01a36c2044147674` real E2E, CI-gruen und unabhaengig durch Claude und Cowork ohne P0/P1-, Scope- oder False-Pass-Befund abgenommen |
| M2-Integration | PR #63 als Merge-Commit `733c22e5df95fd00987ba45408b9dac70f8638e1` nach `main` integriert; Statuspflege via PR #64 als Merge-Commit `c3489e9ad7f75286c23b45577ba5240e600e71f2`; Paket- und Statusbranch lokal und remote geloescht; `02_app` sauber auf aktuellem `main` |
| F1.3 Leistungsabschluss | `PASS`; `galvanik -> fertig`, echte Mehrarbeit, Freeze, L6-Korrektur und fail-closed Rechnungssperre am Kandidaten `fb19c224e1542afdf1436f5f0fb76995fec3935b`; Real-E2E, CI und unabhaengige Exact-SHA-Abnahme ohne offene P0/P1-, Scope- oder False-Pass-Befunde |
| M3-Integration | PR #66 als GitHub-verifizierter Merge-Commit `fc551b0732c52a0867cc4b0bbdfe4f8a52ad3550` nach `main` integriert; Main-Tree `0a77f85f8268ac721d8f15fc7edce5e2623482c5` bytegleich zum geprueften Kandidaten; `02_app` getrackt sauber auf `main`; der erhaltene Paketbranch ist ohne Writer keine aktive Produktwahrheit |
| F1.5 Order-to-Cash | `complete`; A+B/B2+C+D+D.1+T vollstaendig geliefert. C wurde mit PR #79 als Merge-Commit `b94821ca56634bcf75e8d5ddda130241bb75b9bf`, D mit PR #80 als Merge-Commit `001a7698b9ea4edff881ed56ea110832e9de7a46`, D.1 mit PR #81 als Merge-Commit `bf17e8c5562ca772696176fabf4963ece683b88b` und T am Exact Head `575052b6b47a7fd4b651c20e5a3ac42b2c5676e7` mit PR #82 als Merge-Commit `2a2b24d2fecc65a79bf2ff0efe87c72f79db8f09` integriert. |
| F1.6 Realer Pilot | `NOT_STARTED`; auf `main` fehlen die akzeptierte Path-1-Zieloberfläche, die darauf vollständig neu abgenommene Suche und der reale modulare Kalender. Diese Datei startet weder F1.6 noch S2/S3. |
| Path-1 S4 Werkstatt-Modul | Ausschließlich das Werkstatt-Innenmodul ist geliefert: S0+S1 (PR #75) in `main@160bcf40fc872bea2c8303e074c57a0eb0402c0c` und S4/Phillip V4 mit PR #77 als Merge-Commit `019b1fbaad34e4f10a28298a29858f2fa599eb45` integriert; `/warendurchlauf` ist die bestehende Kompositionswurzel für `src/modules/werkstatt/`. Dies ist kein Beleg für gelieferte Shell, Rollen-Startseiten, Zielnavigation oder Gesamtoberfläche. |
| Remote/Production in M2 | `main`-Merges loesen ueber die vorhandene Vercel-GitHub-Integration automatisch erfolgreiche Deployments mit Environment `Production` aus; fuer `733c22e5df95fd00987ba45408b9dac70f8638e1` (Deployment `5958527416`) und `c3489e9ad7f75286c23b45577ba5240e600e71f2` (Deployment `5958812163`) belegt; keine manuelle Promotion sowie keine Provider-, RLS-, Remote-DB- oder Datenmutation |
| Remote/Production in M3 | Automatisches Vercel-Git-Deployment `dpl_67UsPkCLodKUS8Fa2Lp7vLhX6Par` fuer exakt `fc551b0732c52a0867cc4b0bbdfe4f8a52ad3550`: `target=production`, `READY`; keine manuelle Promotion sowie keine Provider-, RLS-, Remote-DB- oder Datenmutation |

## Historischer F0-Snapshot vom 2026-08-10

Dieser Abschnitt bewahrt den damaligen Befundwortlaut. Aktuelle Abschluss- und Lieferaussagen stehen
ausschliesslich im Block oben; Konsistenz der historischen F0-Angaben prueft weiterhin
`scripts/quality/check-f0-doc-truth.mjs`.

### F0-Fundament (damaliger Repo- und Production-Stand)

| Wahrheit | Stand |
|---|---|
| main | a3d7db762ea4d95867a9edc2ade2850333f75f34 (Basis dieses Pakets); einziger offener Foundation-PR: dieser W1-PR (f0/w1-governance-truth) |
| Production-Deployment | ae47f3de aktiv (Vercel dpl_7vwbgEJrPJhYHf9RcuLWswBr1EbT, READY, target=production) |
| Supabase Prod | syhaigjhsbpjmtnggqka; Ledger 9/9 = aktive Repo-Migrationen (Digest 268ce6c1d87a7d020d68369eac20b2b4) |
| Migrationswahrheit | PASS: Fresh-Replay aus Null, im CI DOPPELT mit identischem Digest (9dc1067b…) |
| Schema-Paritaet | 7 HARTE Fingerprint-Komponenten = Prod (cols/idx/func/rls/grants/func_grants/viewopts); cons/trig/pol known-normalization, def_privs known-external |
| Data API | 0 direkte anon/authenticated-Privileges auf allen public-Tabellen/Views (relationsweiter CI-Test); USAGE auf Schema public besteht (Supabase-Standard, kompensiert) |
| RLS | 29 Haertungspolicies; Tenant-Fixture-Matrix ueber alle 8 tenant_isolation-Tabellen im CI; vollstaendige Kategorisierung aller tenant_id-Tabellen in F0_TENANT_COVERAGE.json mit Live-Abgleich-Gate |
| Views | 17/17 security_invoker (einheitlich `true`, am 10.08. normalisiert; Aufloesung des Audit-Befunds BF-001 s. F0_FINAL_REPORT) |
| Storage | 4 private Buckets, Limits/MIME gesetzt; ECHTE HTTP-Negativmatrix S1–S12 im CI (inkl. Signed-URL expired/manipuliert/fremd) |
| Auth/Session | 6/6 PIN bcrypt; echte Session-Kette V1–V5 im CI (Login-POST, Cookie-Denials, Rollen-Denial); Playwright-Auth-E2E |
| CI-Gates | tsc · lint:full (eigener Step) · Units · DB-Integration · V1–V5 · S1–S12 · Doppel-Replay · Negativ/Inventar (A–H) · Tenant-Coverage · Fingerprint hart · Ledger-Vertrag · Forbidden-Patterns · Client-Boundary · Ratchet · doc-truth · Build · npm-audit-Rohartefakt · diff-check |
| Dependencies | next 16.2.12; npm audit --omit=dev als CI-Artefakt persistiert (Stand: 0 critical / 9 high / 2 moderate / 2 low, alle transitiv; transitiv ≠ automatisch irrelevant — Review-Pflicht bleibt) |
| Externer Blocker | def_privs FOR ROLE supabase_admin (15 von 24 defacl-Eintraegen): BLOCKED_EXTERNAL_PERMISSION, kompensiert + Ticket-Vorlage (F0_PERMISSION_PACKET.md) |
| Advisor offen | pg_trgm in public (WARN); Leaked-Password-Protection deaktiviert (WARN — Betreiberpflicht vor Go-live); 13 rls_enabled_no_policy (INFO, deny-all, kategorisiert) |
| Abschlussstatus | FINAL_STATUS=FAIL_INTERNAL · ZIP_READINESS=RED · RATIFICATION_STATUS=PENDING_EXTERNAL (siehe F0_DEFECT_REGISTER.md, KREILE_F0_UEBERGABE_UND_F1_START.md, F0_FINAL_REPORT.md, F0_HANDOFF.json) |

## Ausdruecklich NICHT Teil des F0-Fundaments (Produkt-/Go-live-Gates, offen)
48h-Offline-Nachweis · Backup-/Restore-DRILL (Rollback ist vorbereitet, nicht getestet) ·
DB-Passwort-Rotation · UI-Gesamtabnahme Desktop/Tablet/Mobile · operativer E2E-Kernweg ·
Capture/OCR-Vollnutzung · Brain/Buchkern/Connectoren · Rate-Limit-Wirkungs-Drill.

## Governance-Vermerk (ehrlich)
Zwei Prod-Eingriffe dieser F0-Phase liefen mit Session-Freigabe des Auftraggebers VOR dem
PR-Merge (Haertung 07.08.; Migration 20260810100000 am 10.08., dabei zunaechst ohne
Ledger-Eintrag — selbst entdeckt und noch am selben Tag regulaer im Ledger nachgefuehrt).
Regelweg bleibt Merge→Apply; alle Eingriffe sind in F0_HANDOFF.json REMOTE_MUTATIONS protokolliert.

## Remote-Branch-Inventar (2026-08-10)
Einziger aktiver Foundation-Branch: `f0/w1-governance-truth` (dieser PR, F0-W1 Governance-Wahrheit-
Korrektur, KEIN Selbstmerge). `f0/befund-fixes` (PR #57) ist gemergt und bereits geloescht — main
enthaelt dessen Inhalt (a3d7db76). Das vollstaendige Inventar aller Remote-Branches mit SHA und
Disposition steht in `F0_BRANCH_INVENTORY.md` (Disposition dort endgueltig erst nach DEC-04 durch
den Repo-Owner). Nachfolgende Liste (historisch, unveraendert aus der Vorfassung stehen gelassen,
Stand vor 2026-08-10; fuer die aktuelle Disposition gilt ausschliesslich F0_BRANCH_INVENTORY.md):
- agent/docs-rls-architecture
- agent/docs-update-and-m3
- agent/m4-sec-pin-002b
- archive/db-truth-main-source-c3b9f20
- archive/db-truth-pr30-source-d6bbfc2
- archive/db-truth-replay-source-5b5aa76
- archive/pr-15-capture-auth-tenant-f0090ab
- archive/pr-19-foundation-security-338a13c
- archive/pr-20-foundation-consolidation-2589fde
- archive/pr-8-auth-identity-002-007b85b
- checkpoint/order-flow-source-stable-2026-06-16
- checkpoint/sec-pin-002-no-merge-20260801
- chore/company-agent-governance
- chore/control-plane-min-ci
- chore/cowork-control-plane
- chore/ledger-d1-d2-migrations
- chore/minimal-mission-runtime
- ci/agentur-gate-to-main
- codex/foundation-consolidation-v3-20260728
- codex/foundation-gap-fill-001
- codex/foundation-migration-reconciliation-20260801
- codex/foundation-replay-inquiries-001
- codex/foundation-security-remediation-20260715
- codex/p0-hotfix-no-pin-payload
- codex/p0-hotfix-no-pin-payload-clean
- codex/w0-api-02f-scan-upload-02
- codex/w1-runtime-receipts-20260801
- docs/plan-sync-001
- docs/truthful-current-state-2026-08-06
- f0/befund-fixes
- f0/consolidation
- feature/appvernetzung-a1-data-truth
- feature/capture-auth-tenant
- feature/gemini-model-router
- feature/integration-capture-r15e
- feature/right-nav-focus
- feature/rls-core-migrations
- feature/rls-r1a-items-timeline-server-bridge
- feature/rls-r2-customers-server-bridge
- feature/rls-r3-baths-server-bridge
- feature/ui-cleanup-after-search-live
- fix/auth-identity-002-root
- fix/auth-session-permissions-2026-06-17
- fix/docs-and-offline-containment
- fix/inquiries-repository-server-action
- fix/live-auth-relogin
- fix/offline-synccontext-dataloss-containment
- fix/operational-orders-real-priority
- fix/orders-auth-after-a1-a2
- fix/storage-ocr-signed-urls
- hotfix/main-build-repair
- main
- r14c/s1-production-orders-view
- r15/scan-upload-security-lazy-init
- repair/f0-migration-ledger-reviewed
- repair/m03-auth-foundation
- review/G-2026-0001-scan-order-persistenz
- test/r5-negativ-20260713

## F1-R0 No-Fake-Production Gate (abgeschlossen, 2026-08-17)

| Pruefpunkt | Ergebnis |
|---|---|
| Branch | f1/digital-wareneingang-20260812 |
| Paket | F1-R0_NO_FAKE_PRODUCTION_GATE |
| REACHABLE_PRODUCTION_MOCKS | 0 |
| UNREGISTERED_VISIBLE_CAPABILITIES | 0 |
| ACTIVE_CAPABILITY_REAL_E2E | PASS (eingefrorener F1.1-Nachweis unveraendert) |
| Unabhaengige R0-Abnahme | PASS am exakten SHA `75bdaf8458aef3606ede50b393a0b06fa0fbe9f3`; keine P0/P1-, Akzeptanz-, Scope- oder False-Pass-Befunde |
| Integration | PR #61, Merge-Commit `6b4d482bae9f2797bb5171c8cdf4b817cb1b549d` |
| Naechstes Paket | F1.2_WERKSTATTDURCHLAUF `NOT_STARTED`; M1 stoppt nach Konsolidierung |

Die historischen F0-Eintraege bleiben als Herkunftsnachweis erhalten, steuern aber nicht den aktiven F1-Lauf.
