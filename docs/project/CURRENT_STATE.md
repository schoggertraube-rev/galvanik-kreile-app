# CURRENT_STATE — Galvanik-Kreile WerkstattCockpit

**Massgeblicher Steuerungsstand: 2026-08-27.** `main` ist die einzige Lieferwahrheit. Der folgende
M1/M2/M3/F1-Block sowie die Abschnitte zu Vertragsdrift, F1.5-Status und Oberflaechenwahrheit sind
aktuell; die ausfuehrlichen F0-Tabellen darunter sind ein datierter historischer Snapshot und keine
aktuelle Paket- oder Branchsteuerung.

## Aktuelle Liefer- und Paketwahrheit

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
| F1.4 Unveraenderliche Rechnung | laut `missions/F1_ORDER_TO_CASH_PILOT_001.yml` `IN_PROGRESS`; Kandidatenarbeit liegt lokal auf Branch `f1/immutable-invoice-m4-20260821` ueber Basis `f1c34b8f36c05912a094eb163950a24a9710df97`. Vertragsinhalt ist vom Owner vollstaendig ratifiziert; offen ist der Implementierungs- und Vertragsabgleich `RATIFIED_CONTRACT_DRIFT` (Klasse `FAIL_INTERNAL`, siehe unten). Kein Merge und keine unabhaengige Abnahme des korrigierten Kandidaten; keine Production |
| Naechstes Paket | F1.5 `PENDING_OWNER_RATIFICATION`; Baustart ausschliesslich nach F1.4-Merge und neuer Owner- plus Orchestrator-Ratifikation/Startfreigabe. Kein F1.5-Code, kein Produktatom ohne eigenen Folgeauftrag |
| Remote/Production in M2 | `main`-Merges loesen ueber die vorhandene Vercel-GitHub-Integration automatisch erfolgreiche Deployments mit Environment `Production` aus; fuer `733c22e5df95fd00987ba45408b9dac70f8638e1` (Deployment `5958527416`) und `c3489e9ad7f75286c23b45577ba5240e600e71f2` (Deployment `5958812163`) belegt; keine manuelle Promotion sowie keine Provider-, RLS-, Remote-DB- oder Datenmutation |
| Remote/Production in M3 | Automatisches Vercel-Git-Deployment `dpl_67UsPkCLodKUS8Fa2Lp7vLhX6Par` fuer exakt `fc551b0732c52a0867cc4b0bbdfe4f8a52ad3550`: `target=production`, `READY`; keine manuelle Promotion sowie keine Provider-, RLS-, Remote-DB- oder Datenmutation |

## Owner-Autoritaet, Vertrags- und Ratifikationsstaende (2026-08-27)

### Owner-Provenienz: Autonomie-Mandat

Owner-Quelle `KREILE_AUTONOMIE_MANDAT_2026-08-27.md`, SHA-256
`C244EC1C5F1FF1493420F4DCC44FEFCD8F0E76CEAEFD16853BE2A4E4C539364A`, 4904 Bytes. Die Datei liegt
ausserhalb des Repositories und ist ausschliesslich Herkunft; sie wird nicht veraendert, nicht
kopiert und ersetzt keinen Gatebeweis. Sie traegt drei Owner-Entscheidungen: die vollstaendige
F1.4-Ratifikation, die Ratifikation des Frontends als Parallelpaket samt getrennter Statusachsen und
eine bedingte stehende Merge-Autoritaet.

### F1.4: vollstaendig ratifiziert, `RATIFIED_CONTRACT_DRIFT` (Klasse `FAIL_INTERNAL`)

Der Owner hat F1.4 vollstaendig ratifiziert: `EVOLVE_PUBLIC_INVOICES` additiv und
rueckwaertskompatibel; Umsatzsteuer ausschliesslich 19 Prozent (1900 Basispunkte); `R-JJJJ-NNNN`
lueckenlos; Korrektur ausschliesslich als Storno plus Neuausstellung; Stammdaten aus der
Tenant-Config fail-closed; `PAYMENT_TERM_DAYS` exakt 14; PDF-Download-Uebergang. Dazu fehlt **keine**
weitere Ownerentscheidung; dies ist ausdruecklich kein `BLOCKED_PRODUCT_DECISION`.

Offen ist ausschliesslich der Implementierungs- und Vertragsabgleich gegen den heute gebundenen
Stand:

| Punkt | Gebundener Kandidatenstand | Ratifizierter Owner-Stand |
|---|---|---|
| Zahlungsziel | `f1_4_payment_term_rule: TENANT_CONFIG_REQUIRED_FAIL_CLOSED`, DB-Check `BETWEEN 1 AND 365` (`supabase/migrations/20260821152949_f1_4_immutable_invoice_contract.sql`) | `PAYMENT_TERM_DAYS` exakt 14 |
| Umsatzsteuer | Check `IN (700, 1900)` in `company_settings` und im Rechnungsvertrag | ausschliesslich 1900 |

Eine eigene physische F1.4-Bauvertragsdatei liegt nicht im Owner-Ordner; die Provenienz der
Ratifikation ist das Autonomie-Mandat oben. Es wird keine Datei-Provenienz erfunden.
`missions/F1_ORDER_TO_CASH_PILOT_001.yml` bindet weiterhin
`f1_4_contract_sha256 = B1F4E10ECB0C907085D9BE90E859AAFEF1C9798AE5DEEE2E3CE0DD849AD2634A`. Die
Aufloesung gehoert dem zustaendigen F1-Writer (Mission, Migration, Code, Evidence); die
Dokumentation passt nichts still an und behauptet nicht, der ratifizierte Inhalt sei bereits
umgesetzt.

### F1.4: historischer Nachweisstand (vor der ratifizierten Korrektur)

Aus der Owner-Uebergabe belegt und unveraendert bewahrt: PR `#68`, Head-Prefix `d61bb966`,
Real-Gate, CI und Preview historisch `PASS` beziehungsweise `healthy`; der PR ist als Draft offen und
unmerged; keine Production. Diese Nachweise wurden **vor** der neu ratifizierten Korrektur auf
ausschliesslich 19 Prozent und `PAYMENT_TERM_DAYS` exakt 14 erhoben. Sie gelten deshalb nicht als
Mergebeleg fuer den korrigierten Kandidaten. Dieses Dokument behauptet keinen Live-Refresh dieser
Zustaende.

### F1.5 Bestaetigter Zahlungseingang: `PENDING_OWNER_RATIFICATION`

Der F1.5-Bauvertrag liegt als Owner-Quelle
`KREILE_F1_5_BAUVERTRAG_ZAHLUNGSEINGANG_WARENAUSGANG_V1_2026-08-21.md` mit SHA-256
`5BCD70BFC2BD9D6A6DF06CF48D0D95C4A288DD5C6364BE2783954DDA1196BDE1` und 5592 Bytes vor. Er ist
eingereicht, aber nicht ratifiziert. Baustart ausschliesslich nach dem F1.4-Merge und nach einer
neuen Owner- plus Orchestrator-Ratifikation mit ausdruecklicher Startfreigabe. Bisher existieren nur
Provenienz und Status; es gibt keinen F1.5-Code, keine F1.5-Migration und keine F1.5-Evidence.

## Oberflaechenwahrheit und Frontend-Lane (2026-08-27)

- Reale Ist-Wahrheit der Oberflaeche ist ausschliesslich die heute ausgelieferte alte UI: bestehende
  Routen, Komponenten und `src/app/globals.css`. Sie bleibt bis zum belegten Ersatz die einzige
  Nutzeroberflaeche.
- Die vier Zielbildnamen sind ratifiziert und nicht implementiert: Rolf "Der Tag" V8, Phillip
  "Werkstatt" V4, Auftragskarte `MACHART_V8`, Kundenkarte `MACHART_V2`. Owner-Provenienz:
  `KREILE_UEBERGABE_FRONTEND_UMSETZUNG_V1_2026-08-21.md`, SHA-256
  `1CC0BDD969E1E5BB8F437542FCD8208FCDD2DF5B3B7FC8A0B18030AAC21B5C8C`, 4054 Bytes; kanonisiert in
  `missions/FRONTEND_IMPLEMENTATION_001.yml`. Diese Namensratifikation ist eigene Metadatenwahrheit
  und ersetzt weder gebundene Referenzassets noch `UI_REFERENCE_PASS` oder `OWNER_UX_PASS`.
- Der Owner hat das Frontend mit dem Autonomie-Mandat vom 2026-08-27 (SHA-256
  `C244EC1C5F1FF1493420F4DCC44FEFCD8F0E76CEAEFD16853BE2A4E4C539364A`, 4904 Bytes) als
  Parallelpaket ratifiziert. Es gibt damit zwei autorisierte Paket-Lanes, nicht zwei aktive
  Implementierungen: aktiv ist ausschliesslich die Parallelplanung
  (`PARALLEL_PLANNING_ACTIVE` / `IMPLEMENTATION_NOT_STARTED`). Disjunktheit der Implementierung ist
  erforderlich, aber noch nicht belegt. Es gibt keinen Code, keinen Screenshot-Vergleich, keine
  Rollenmatrix-Abnahme und keine Owner-UX-Ratifikation. Kein Teil dieser Lane ist produktreif; ein
  ratifiziertes Zielbild ist keine Lieferung.
- Globale Ein-Writer-Regel des Mandats: `single_active_code_writer_across_frontend_and_f1 = true`.
  Es gibt insgesamt genau EINEN aktiven Code-Writer, nicht je Teilphase einen; ein Frontend-Writer
  und ein F1-Writer laufen niemals parallel. Read-only Reviewer und Inventare duerfen parallel
  laufen.
- Arbeitskontext der Lane: Phase 0 darf im aktuellen dirty F1-Checkout read-only inventarisieren.
  Der Modus `READ_ONLY` ist keine implizite Repo-Schreibfreigabe; read-only Auditoutputs bleiben von
  spaeteren Evidence-Writes getrennt. Jede Repo-Evidence- oder Missionsschreibung nach diesem
  Control-Plane-Abgleich und jeder UI-Writer verlangt einen von den Projektregeln erlaubten sauberen
  kurzen Paketbranch beziehungsweise -kontext vom live aktuellen `main`, keinen laufenden F1-Writer
  oder F1-Gate und eine vorab berechnete exakte Produkt-Allowlist mit Schnittmenge 0 zur aktiven
  Order-to-Cash-Allowlist. Kein neuer Worktree und kein Clone ohne gesonderte Autoritaet. Ist die
  Trennung nicht beweisbar, wird sequenziell gearbeitet: erst F1.4 korrigieren und mergen, danach
  der Frontend-Writer.
- Basisbindung der Lane: Der in der Mission gefuehrte SHA
  `f1c34b8f36c05912a094eb163950a24a9710df97` ist ausschliesslich `handoff_snapshot_sha`
  (`HISTORICAL_HANDOFF_SNAPSHOT_ONLY`) und niemals Implementierungsbasis. Es gilt fail-closed
  `implementation_base_sha = BIND_CURRENT_MAIN_AT_WRITER_START`: die Basis wird erst beim Writerstart
  an den live aktuellen `origin/main` gebunden und protokolliert; ohne diese Bindung startet kein
  UI-Writer.
- Die exakten ratifizierten Visual-Referenzdateien sind derzeit nicht im Repository gebunden. Bis
  Phase 0 sie wiedergefunden, erhalten und per SHA-256 und Bytegroesse gebunden hat, gilt
  `REFERENCE_ASSET_RECOVERY_REQUIRED`: kein UI-Code, kein Gestalten nach Gefuehl und keine stille
  Aufwertung eines bekannten HTML-Kandidaten zur Autoritaet.
- Bindend dokumentiert, aber noch nicht umgesetzt: `/start` bleibt ausschliesslich Login- und
  Sessiongrenze; `/cockpit` ist die einzige Rolf-Oberflaeche "Der Tag"; `/` wird spaeter
  serverseitiger Rollenrouter (admin/Rolf -> `/cockpit`; developer -> `/settings`; `werkstatt`,
  `meister`, `buero` -> `/warendurchlauf`); `/today` und `/kontrolle` werden ausschliesslich
  Kompatibilitaetsaliase auf `/` ohne eigene Datenwahrheit; kein fuenftes Dashboard; die Rolle
  `inhaber` bleibt verboten.
- `PHILLIP_WERKSTATT_V4` ist exakt an `/warendurchlauf` als rollenbasierten Werkstatt-Einstieg
  gebunden. Stationsunterseiten liegen ausschliesslich darunter; es entsteht keine neue
  Dashboardroute. Phase 0 liefert dazu den exakten Route-Binding-Output und muss das harte
  `PHILLIP_ROUTE_BINDING_GATE` bestehen, bevor Phase 1 schreiben darf.
- `BAEDER_DISPOSITION_001` ist ein separater Task, nicht Frontend Phase 1, und ist nicht erledigt.
  Akzeptanz: alle sichtbaren `/baeder`-Links und Baeder-Bezeichnungen aus der produktiven Navigation
  entfernt; `/baeder` leitet nach `/warendurchlauf/galvanik` um; `/performance/baeder-material`
  entfernt oder mit identischem Redirect; kein erreichbarer toter oder gemockter Bath-Adapter;
  Galvanik bleibt exakt ein Step. Tabellen, Daten, Migrationen und Provenienz bleiben technische
  `PROTECTED_SALVAGE`; keine Remote- oder Datenloeschung. Baeder sind nach `D-ARCH-010` kein
  Produktziel und keine Roadmapzeile: keine Baeder-UI und kein spaeteres Baeder-Produktziel.
- Statusachsen der Lane (getrennt, kein Gesamt-PASS aus einem Teilgate): `FUNCTIONAL_SLICE_PASS`
  `NOT_STARTED`, `DATA_TRUTH_PASS` `NOT_STARTED`, `UI_REFERENCE_PASS` `NOT_STARTED`, `OWNER_UX_PASS`
  `OPEN_NOT_GRANTED`, `PRODUCT_READY` `false`. `OWNER_UX_PASS` blockiert den Merge nicht und wird nie
  als erteilt dargestellt. Screenshotmatrix exakt `390x844`, `768x1024`, `1024x768`, `1366x1024`,
  `1440x900`.
- Merge-Autoritaet aus dem Autonomie-Mandat, semantisch getrennt: `authority_status:
  STANDING_GRANTED`, `eligibility_status: NOT_MATURED`,
  `additional_owner_merge_approval_required: false`, `valid_from: 2026-08-27`,
  `valid_until: NEXT_REAL_JOINT_OWNER_ORCHESTRATOR_DECISION`, `owner_ux_pass_blocks_merge: false`.
  Das Mandat ist weiterhin gueltig; sein Teil 3 war der Abschluss derselben Uebergabe und keine
  Revokation. Die Autoritaet ist erteilt; das konkrete Paket ist heute noch nicht merge-eligible,
  weil die mergeblockierenden Gates am exakten SHA noch nicht gruen sind, der Scope-Abgleich offen
  ist und Review, CI und E2E noch nicht `PASS` melden. Manuelle Production-Promotion und manueller
  Deploy bleiben `FORBIDDEN`; ein bereits bestehendes automatisches Vercel-Deployment als Folge eines
  spaeter autorisierten `main`-Merges wird nicht manuell ausgeloest, sondern danach nur beobachtet
  und belegt.

## ENTSCHEIDUNGSREGISTER (echte Owner-Grenzen)

Hier stehen ausschliesslich Fragen, die eine echte Ownerentscheidung brauchen und deshalb nicht
autonom entschieden werden. Bereits entschiedene Fragen werden nicht erneut eingetragen; eine
Owner-Grenze stoppt die Arbeit nicht, sondern wird nach
`owner_boundary_handling = queue_and_continue_elsewhere` eingereiht, waehrend anderswo weitergebaut
wird.

| Thema | Empfehlung | Wesentlicher Nachteil | Status |
|---|---|---|---|
| F1.5-Ratifikation und Baustart | Erst nach dem F1.4-Merge ratifizieren und starten. | Kein paralleler F1.5-Bau; die Zahlungseingangs-/Warenausgangsstrecke verzoegert sich um die F1.4-Restarbeit. | `QUEUED_OWNER_BOUNDARY` |

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
