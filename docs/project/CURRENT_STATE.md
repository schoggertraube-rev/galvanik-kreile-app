# CURRENT_STATE — Galvanik-Kreile WerkstattCockpit

**Lieferstand 2026-10-03: `main@a56b5c8845efb5814a970cf739b7fab82217ce28`.** Diese Datei
beschreibt ausschließlich auf `main` belegte Lieferungen. Aktives Paket, Branch, Base, Kandidatenstatus
und nächstes Gate stehen ausschließlich in `missions/F1_ORDER_TO_CASH_PILOT_001.yml`. Die
ausführlichen F0-Tabellen darunter sind ein datierter historischer Snapshot.

Die Alt-PRs #84, #113, #114 und #115 sowie ihre `archive/pr-*`-Refs sind Kandidaten- und
Verlustschutzquellen, keine auf `main` gelieferte Produktwahrheit. Ihre aktuelle Disposition steht im
NON_LOSS_REGISTER. `ALT_PR_INVENTORY_2026-09-28.json` ist der unveraenderte Stichtags-Snapshot vom
28.09.2026 und keine Live-Statusquelle. Die aktuelle maschinenlesbare Delta-Entscheidung fuer PR #113
steht in `docs/delivery/KR-04_PR113_DISPOSITION_2026-09-29.json`: PR #113 ist ungemergt geschlossen,
Quellbranch und Archivref bleiben erhalten, und kein Produktpfad daraus wurde durch KR-04 geliefert.

Nach dem Governance-Stand `b58efdf546c05750d09f80adfbdd68d12ee9e3e5` wurden die
PR-113-Disposition ueber PR #121, drei geschuetzte CI-Handoffs ueber PR #134,
PR #135 und PR #136 sowie das kleine Produktbereinigungspaket KR-04R ueber
PR #122 geliefert. Der exakt gepruefte KR-04R-Kandidat
`b0b55353143fc50eda7f3833270ff4cfd1402e2f` wurde normal als
`16888ccc1f0c97064af3d1552538c6975440b1fb` integriert; Kandidat und Merge haben
denselben Tree `4ccfbc0f01c7bb92de8e8a198b43a79a0cd543f2`. Post-Merge waren Agentur-Gate
`37105376211`, Quality und Fresh Supabase Replay `37105376179` sowie das
automatische Vercel-Production-Deployment erfolgreich. KR-04R entfernte genau
die nachweislich unreferenzierte Altkomponente `RechnungenClient.tsx`; es gab
keine Remote-Datenbank-, RLS-, Rollen-, Session-, Provider- oder Echtdatenmutation.

PR #137 lieferte danach ausschliesslich die vorab unabhaengig gepruefte
KR-02R-Checker-Vorautorisierung. Kandidat `5e02605d23f4b65bd69e16509fbd9debcd4de7ae`
wurde normal als `a56b5c8845efb5814a970cf739b7fab82217ce28` integriert. Agentur-Gate
`37114643293`, Quality und Fresh Supabase Replay `37114643272` sowie das
automatische Vercel-Production-Deployment waren erfolgreich. Der Nutzer
autorisierte fuer genau diesen selbstblockierenden Alt-Handoff einmalig den
normalen Merge trotz des nicht verpflichtenden Ratchet-Fehlers; kein
Admin-Bypass, manueller Deploy oder Remote-Datenbankeingriff erfolgte.

PR #131 band den vorab geprueften KR-04-Checker fail-closed an den geschuetzten
`pull_request_target`-Pfad; Kandidat `bfc6e5737f9bc0b3e268dff535a8dc1a78053234`
wurde als `47bc0e58990b1bff545111c990a715d4f72f5f37` mit identischem Tree
`7cfd13f319bb4b936ce09de44ab6ca5fa255e5ce` integriert. PR #132 band dessen
Selftest explizit an den Kandidaten-Root; Kandidat
`e3ce9259bde35cbef843ec88628fb1faa53051b7` wurde als
`bc85ccc6b9e84a21947bcc1e648b847ef2d78ac5` mit identischem Tree
`34e45157e821f847bd8f3d98735b3f93a8e53a89` integriert. Die Post-Merge-Runs
`37015030926`/`37015031007` und `37019871795`/`37019872078` sowie beide
Vercel-Commitstatus waren gruen. PR #133 ratifizierte danach den stabilen
Trusted-Git-Graph-Pruefer; Kandidat `db29c6ff6c3724907f3a105763c127739f3da2f5`
wurde als `b58efdf546c05750d09f80adfbdd68d12ee9e3e5` mit identischem Tree
`6b2e49719b785adf8b49e27a105d2beba521fb9c` integriert. Die Post-Merge-Runs
`37036316786`/`37036316848` und der automatische Vercel-Commitstatus waren gruen.
Alle drei Handoffs hatten unabhaengige Reviews ohne offene P0/P1/P2/P3 und
veraenderten keine Produkt-, Datenbank-, Provider- oder Berechtigungswahrheit.

## Auf main belegte Lieferwahrheit

### Sichtbare Produktwahrheit nach D-UI-CORE-001/002

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
| Bestehende sichtbare Oberfläche | `FULLY_REJECTED_AS_DELIVERY_BASE`; Alt-Shell, Alt-Navigation, Alt-Startseite, Orders-/Customers-UI und responsive Alt-Navigation sind kein UX-Teilfortschritt und werden nicht als Ziel-UI weiterentwickelt |
| Kanonische Zieloberfläche | `NOT_DELIVERED`; akzeptierbar erst als zusammenhängende Phillip-V4-/Rolf-V8-/Auftragskarte-V8-/Kundenkarte-V2-Oberfläche mit Navigation und Rückwegen auf Desktop, Tablet und Mobile |

Ein geliefertes Innenmodul, ein grüner Fachvertrag oder ein Teil-/Kosmetikpatch der Alt-UI ist ausdrücklich kein Full-Route-/UX-PASS, kein Zielscreen-PASS und keine livefähige Oberfläche.
Die nächste Produktpriorität wird ausschließlich in der aktiven Mission gesteuert; diese Datei nimmt
keinen Kandidaten als geliefert vorweg.

| Wahrheit | Stand |
|---|---|
| KR-02R geschuetzter Checker-Handoff | PR #137, Kandidat `5e02605d23f4b65bd69e16509fbd9debcd4de7ae`, als Merge-Commit `a56b5c8845efb5814a970cf739b7fab82217ce28` integriert; Opus P0/P1/P2/P3 = 0; einmalige dokumentierte Owner-Ausnahme fuer den selbstblockierenden Alt-Handoff; Post-Merge-Gates und automatisches Vercel-Production-Deployment gruen; keine Produkt- oder Remote-Datenmutation |
| KR-04R Produktbereinigung | PR #122, Kandidat `b0b55353143fc50eda7f3833270ff4cfd1402e2f`, als Merge-Commit `16888ccc1f0c97064af3d1552538c6975440b1fb` integriert; Tree `4ccfbc0f01c7bb92de8e8a198b43a79a0cd543f2` bytegleich; P0/P1/P2 = 0; Post-Merge-Gates und automatisches Vercel-Production-Deployment gruen; keine Remote-Datenmutation |
| KR-04 und geschuetzter CI-Handoff | PR #121 als `3fa208858ece10235394800a3a6ff48aae49568b` sowie PR #134, #135 und #136 als `31da55b5fe04db9d3744d842297f904e28fc26a7`, `ffa597937987d7abb7779a9d63303445e1ec92fc` und `53a5d52becc08394780583e4c3756b2d414311a6` integriert; Reviews, Post-Merge-Gates und automatische Deployments gruen; keine Produkt- oder Remote-Datenmutation durch die drei Handoffs |
| KR-01R -> KR-04 geschuetzter CI-Handoff | PR #131, #132 und #133 als Merge-Commits `47bc0e58990b1bff545111c990a715d4f72f5f37`, `bc85ccc6b9e84a21947bcc1e648b847ef2d78ac5` und `b58efdf546c05750d09f80adfbdd68d12ee9e3e5` integriert; Trees jeweils kandidatenidentisch; Reviews und Post-Merge-Gates gruen; keine Produkt- oder Remote-Datenmutation |
| KR-01R Governance-Recontract | PR #120, Kandidat `da8c352d91a694d9c72551a245805386bbf7efdc`, als Merge-Commit `0d5dd46bd8484ba3a5b7a97a762cd148b8bafff9` integriert; Tree bytegleich; Post-Merge-Gates gruen; keine Produkt- oder Remote-Datenmutation; kein manueller Production-Claim |
| KR-01A Governance-Bootstrap | PR #119 als Merge-Commit `fa1a989fa5844305e6a8200832ed43e2fc230751` integriert; Post-Merge-Checks und der fuer diesen Merge autorisierte automatische Vercel-Lauf gruen; keine Produkt- oder Remote-Datenmutation |
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
