<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Galvanik-Kreile — finaler serieller Buildplan bis Go-live

**Stand:** 28.09.2026  
**Status:** `FINAL_AFTER_ONE_OPUS_REDTEAM__OWNER_EXECUTION_AMENDMENT_2026-09-28`  
**Projekt:** `GALVANIK_KREILE_WERKSTATTCockpit`  
**Redteam:** Claude Opus, genau eine Runde, Urteil `REDTEAM_FAIL`; sämtliche technisch und prozessual behebbaren P0/P1/P2 sind in dieser einmaligen Revision disponiert.  
**Grenze:** Dieser Plan ergänzt die app-nahe Projektsteuerung. Er ersetzt keine Sicherheitsgrenze und ist keine Production-, Echtdaten-, Provider-, Remote-Migrations- oder pauschale Mergefreigabe.

### Ausführungsnachtrag des Owners vom 28.09.2026

Dieser Nachtrag ändert keine Produktfunktion und löst keine zweite Redteam-Runde aus. Er bindet die vom Owner im aktuellen Auftrag vorgegebene Ausführungsreihenfolge:

1. GitHub wird nicht mehr bis zum 03.10. abgewartet. Authentifizierung, SSH-Remote, GitHub-API, Pull Requests und Actions sind am 28.09.2026 real erreichbar; der Mergezug beginnt deshalb sofort, sobald der jeweilige Exact-SHA alle Gates erfüllt.
2. Vor jeder neuen Produktarbeit werden alle aufgelaufenen Kandidaten #84 und #113–#115 vollständig disponiert. Verwertbarer, noch nicht auf `main` enthaltener Inhalt wird in kleinen frischen Paketen auf aktuellem `main` integriert; unbrauchbare oder supersedierte Teile werden mit Archivref, Inhaltsledger und Begründung geschlossen. Kein großer Altbranch wird direkt übernommen.
3. `OG-KR-06` ist für diesen Buildplan entschieden: Das Repo-Entscheidungsregister ist die operative Produktentscheidungsquelle; die externe `00_BIBEL` ist ratifizierbare Owner-Eingabe und wird vor einer Registeränderung synchronisiert. Der Nachteil bleibt der zusätzliche kleine Sync-Schritt.
4. Die Owner-Anweisung delegiert Planung, Paketbildung und Umsetzung von Kreile an den aktuellen Hauptchat. Der tatsächlich ausführende Merge-Akteur wird im Paketreceipt namentlich beziehungsweise per Sitzungskennung gebunden; Exact-SHA-, Required-Check- und Sicherheitsgates werden dadurch nicht gelockert.
5. Ein Merge nach `main` löst laut belegtem Projektstand automatisch ein Vercel-Production-Deployment aus. Deshalb ist die technische Mergefreigabe **nicht** automatisch eine Productionfreigabe: Vor dem ersten tatsächlichen Merge muss entweder die automatische Production-Folge ausdrücklich freigegeben oder ein autorisierter, belegter Weg ohne Production-Auslösung hergestellt sein. Bis dahin werden die Pakete vollständig mergebereit gemacht.
6. Solange Required Checks extern nicht starten oder die nicht freigegebene
   Production-Folge einen Main-Merge sperrt, darf genau ein Paket zur Zeit auf
   dem zuletzt vollständig lokal geprüften und separat Claude-reviewten
   Kandidaten aufbauen. Jeder Stand erhält einen exakten Parent-SHA, sauberen
   Remote-Freeze und eigenen Receipt und bleibt `QUEUED_CANDIDATE`, nicht
   `MAIN_DELIVERED`. Nach Wegfall der Grenze werden alle Kandidaten
   ausschließlich in Parent-Reihenfolge mit frischen Required Checks,
   Exact-SHA-Ratifikation und Post-Merge-Nachweis integriert; kein Sammelmerge.
7. Alle neun alten Automationen bleiben deaktiviert. Erst nach mindestens zwei
   belegten aufeinanderfolgenden Paketübergaben je betroffenem Projekt ist
   genau eine ressourcenschonende stündliche Lesekontrolle zulässig. Sie darf
   keinen Writer, Review, Test oder Merge starten und misst Fortschritt über
   PID/Runner, Outputzeit, Exitstatus, SHA-/Dateidelta und nächsten Nachweis,
   niemals nur über CPU. Diese aktuelle ausdrückliche Owner-Anweisung ändert
   keine Produktfunktion, eröffnet keine zweite Redteamrunde und lockert kein
   Review-, Sicherheits-, Merge- oder Production-Gate.

## 1. Gebundener Ausgangsstand

```text
PROJECT=GALVANIK_KREILE_WERKSTATTCockpit
WORKSPACE_MODE=CANONICAL_DESKTOP_ONLY
ROOT=C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app
PROJECT_RULES=C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app\AGENTS.md
CURRENT_BRANCH=claude/kr-b2-auftrag-zeitpunkte
CURRENT_HEAD=71dbc8151b30a3aa964d5cd4ea3562b1f1c03647
ORIGIN_MAIN=21a23567d51e4805f065ce9ae8c59bdc5faf9fa9
WORKTREE=CLEAN
ACTIVE_MISSION=missions/F1_ORDER_TO_CASH_PILOT_001.yml
MISSION_RECORDED_BRANCH=path1/a2-phillip-recovery-20260919
MISSION_RECORDED_PACKAGE=PATH1_UI_CONVERGENCE
DATA_MODE=SYNTHETIC_ONLY
LIVE_STATUS=NO_GO
```

Belegte Wahrheit:

- Das echte App-Repository ist ausschließlich `02_app`. Das äußere Git-Repository `C:\Antygravityprojekte` ist nicht das Kreile-Produktrepository.
- Innerhalb `02_app` ist die nächstgelegene `02_app/AGENTS.md` die operative Repo-Regel. Die äußere `galvanik_kreile/AGENTS.md` ist eine externe Sitzungssteuerung und enthält stale Aussagen; sie wird vor Produktarbeit korrigiert. Ein Konflikt wird nicht über bloße Dateinähe still entschieden.
- `origin/main` enthält F1.1 bis F1.5 und das Werkstatt-Innenmodul. F1.6 ist nicht gestartet.
- Die kanonische Zieloberfläche bleibt `NOT_DELIVERED`: Shell/Rollen-Startseiten/Navigation, Orders V8 und Customers V2 sind nicht als Gesamtoberfläche abgenommen. Bestehende sichtbare Alt-UI ist keine Lieferbasis.
- `CURRENT_STATE.md` nennt noch `main@13240de` vom 10.09.; die Mission nennt noch das alte A2-Paket. Beide sind stale gegenüber `origin/main@21a23567` und den offenen Kandidaten.
- `missions/MISSION_TEMPLATE.yml` wurde als stale Pfad bereits ratifiziert entfernt. Der veraltete Verweis wird gestrichen; es wird keine neue Vorlage erfunden.
- D-GOV-001 verlangt je Wahrheitsart genau eine Autorität. Vor dem ersten Registerdiff muss der belegte Konflikt „Repo-Master“ gegen „00_BIBEL-Master zuerst“ einmal ownerseitig aufgelöst werden (`OG-KR-06`).
- Designsystem V1.1 ist extern freigegeben: `_DESIGN_VERBINDLICH\designsystem_v1_1`, 55/55 Prüfsummen bestanden. Es ist noch nicht als Token-/Komponentenwahrheit im Repository gebunden.
- Offene Draft-PRs am 28.09.2026: #113 altes Mock-Copy-UI-Paket; #114 B1 P0-Storno gegen `main`; #115 B2 Termintreue auf #114 gestapelt. #84 ist geschlossen und ungemergt; sein verwertbarer Suchkern wird trotzdem im Altbestandsledger vollständig gegen aktuelles `main` geprüft.
- B2 V1/V2 ist keine Ownerfrage: V1 und V2 sind gültige aktive Warenausgangsverträge in unterschiedlichen Fällen. Der Readvertrag akzeptiert genau ein valides V1 **oder** V2, schließt rohe V1-Finanzfelder aus und behandelt mehrere gültige Abholereignisse fail-closed.
- Alle neun bekannten zeitgesteuerten Projekt-Automatiken sind deaktiviert. Für Kreile läuft kein identifizierter Writer, Wächter oder Kettenrunner. Der separat gestartete Lerninsel-PL gehört ausschließlich zum anderen Projekt und darf weder Kreile-Pfade noch Kreile-Prozesse verwenden.
- GitHub-Readback am 28.09.2026: `origin/main=21a23567d51e4805f065ce9ae8c59bdc5faf9fa9`; Ruleset `main-protection` aktiv, keine Bypass-Akteure, Pull Request Pflicht, Required Checks `quality`, `agentur-gate` und `Fresh Supabase replay`. `ratchet` läuft in bisherigen PRs, ist aber aktuell nicht Required und wird erst nach belegter, autorisierter Ruleset-Änderung als Required behauptet.

## 2. Dauerhafte Ursache und Gegenmittel

Der Stillstand entstand nicht aus zu wenig Automatik, sondern aus konkurrierenden Wahrheiten, offenen Paketverträgen, gestapelten PRs, nacheinander wechselnden Revieworakeln, wiederholten Writerstarts und stale Missionen. B1 wuchs auf 870 Nettozeilen; B2 auf weitere 3.052 Nettozeilen und zehn Reparaturrunden.

Das Gegenmittel ist verbindlich:

1. eine Repository-Wahrheit je Typ;
2. ein kleines Paket mit geschlossenem Manifest;
3. ein Writer, ein Reviewer, eine Korrektur;
4. kein abhängiger Branch vor Merge des Vorgängers;
5. Required Checks, Exact-SHA-Ratifikation und Hauptlinienbeleg;
6. Mission/`CURRENT_STATE` nach jedem Merge;
7. keine periodische Automatik und kein automatischer Wiederanlauf.

## 3. Nicht verhandelbare Liefermechanik

### 3.1 Zustandsmaschine und Registergates

Normalweg:

`CONTRACT_READY -> PREFLIGHT_PASS -> WRITING -> LOCAL_VERIFIED -> CLAUDE_REVIEWED -> CORRECTED_ONCE_OR_NOT_NEEDED -> DELTA_REVIEWED -> MERGE_READY_PENDING_CI -> CI_VERIFIED -> OWNER_PREVIEWED -> RATIFIED -> MAIN_DELIVERED -> RELEASE_EVIDENCE`

Zulässige Abzweige:

- `BLOCKED -> SPLIT`
- `BLOCKED -> RECONTRACT`
- `BLOCKED -> EXTERNAL_OWNER_GATE`
- `BLOCKED -> ABANDON_AS_SUPERSEDED`

Ein zweiter Writer-Zeitablauf im selben Paket erzwingt `SPLIT`; es gibt keinen dritten Writerstart mit demselben Vertrag. Dieselbe unveränderte Prüfung wird höchstens zweimal ausgeführt.

| Planzustand | Registergate im Paketscope |
|---|---|
| `CONTRACT_READY` | DoD-Spezifikation vor Build freigegeben; `dod_spec_approved_by` gesetzt |
| `LOCAL_VERIFIED` | `FUNCTIONAL_SLICE_PASS`; bei Datenpaketen zusätzlich `DATA_TRUTH_PASS` |
| `CI_VERIFIED` | alle anwendbaren Funktions-/Daten-/Authority-/Securitygates auf Exact-SHA |
| `OWNER_PREVIEWED` | bei sichtbarer UI `UI_REFERENCE_PASS` und `OWNER_UX_PASS`; bei Nicht-UI jeweils `NOT_APPLICABLE_WITH_EVIDENCE` |
| `RATIFIED` | alle für das Paket anwendbaren Gates ohne P0/P1 |
| `MAIN_DELIVERED` | Paketscope `PRODUCT_READY`, Merge- und Post-Merge-Beleg vorhanden |

`WAITING`, `BLOCKED`, Preview, Prozessaktivität, lokaler SHA oder ein Teilgate sind keine Lieferung.

### 3.2 Paketmanifest

Vor jedem Writer existiert genau eine Datei:

`02_app/docs/delivery/packages/<PACKAGE-ID>.yaml`

Pflichtfelder:

- Basis-SHA, Ziel-SHA-Platzhalter, genau ein Zielverhalten und aktives Missionspaket;
- Dossier-/Entscheidungs-IDs und Source-Lock mit Repo-Pfad, Commit und Hash;
- `dod_spec_approved_by` und die anwendbaren Registergates;
- geschlossene Datei-Allowlist, verbotene Pfade, Abhängigkeit und höchstens zwei normale Folgepakete;
- Akzeptanz-ID → ausführbarer Nachweis;
- `new_objects_authority: NONE|DELEGATED_RATIFIED_CONTRACT|OWNER_GATE`;
- `migration_status: NONE|LOCAL_FILE_ONLY|DISPOSABLE_REPLAY_ONLY|REMOTE_AUTHORIZED`;
- Daten-/Tenant-/RLS-/Rollen-/Command-/Receipt-/Readback-/Reload-/Race-/Fehler-/Rollback-Invarianten;
- jede sichtbare Capability in `docs/evidence/f1/F1_R0_CAPABILITY_REGISTRY.json`;
- Pflichtgate `quality:no-fake-production` für jede sichtbare oder providerbezogene Änderung;
- lokales Gateset, Required Checks, Evidenzmodus `LOCAL_OUTAGE` oder `CI_FULL`;
- Ressourcenprofil, erwartete Laufzeit und Aufräumreceipt;
- ein Findings-Ledger für P0/P1/P2 und Split-/Folgeentscheidung.

Mehr als acht Produktdateien oder mehr als 800 handgeschriebene Produktzeilen erzwingen den Split vor dem Writer. Migrationen, Fixtures und Tests werden getrennt ausgewiesen. Ein Datenpaket enthält grundsätzlich höchstens eine neue Migration, einen öffentlichen Port und eine fokussierte Integrationssuite. B2 ist ausdrücklich ein bereits erfolgtes `RECONTRACT` und darf deshalb drei Neubaupakete erhalten; danach ist kein weiterer Split zulässig.

Additive Tabellen/Views innerhalb eines ratifizierten Fachvertrags werden in `KR-00b` an den benannten PL delegiert. Neue Fachobjekte außerhalb eines ratifizierten Vertrags bleiben Owner-Gate.

### 3.3 Genau eine Review- und Korrekturrunde

1. Ein Writer bearbeitet nur das Manifest.
2. Ein davon getrennter Claude-Reviewer prüft einmal den vollständigen Diff und gibt alle P0/P1/P2 gemeinsam aus.
3. Nicht kontrahierte Verbesserungswünsche sind P2/later, kein neuer P1.
4. Es gibt höchstens eine Korrekturrunde.
5. Danach laufen frische Gates auf dem neuen SHA und eine gezielte Delta-Prüfung der benannten Befunde plus Gesamt-Diff-Guards. Das ist keine zweite breite Review.
6. Offene P0/P1 oder Regression führen zu `SPLIT`, `RECONTRACT`, `EXTERNAL_OWNER_GATE` oder `ABANDON_AS_SUPERSEDED`, nie zur zweiten Korrektur.
7. P2 endet als `FIXED`, `DEFERRED_WITH_PACKAGE`, `ACCEPTED_RISK_WITH_OWNER` oder `NOT_APPLICABLE_WITH_EVIDENCE`.

Security-, Privacy-, Steuer-, Pilot- und Go-live-Gates dürfen zusätzliche fachkundige Prüfer haben. Sie sind Fachgateprüfer, keine weiteren Implementierungsreviewer. Diese Trennung und `max_repair_loops_per_gate: 1` werden in die Mission synchronisiert.

### 3.4 Branch-, PR- und Merge-Regel

Der Mergezug startet **ab sofort im ersten funktionsfähigen CI-Fenster**; ein Datum oder bloße GitHub-Erreichbarkeit ist kein PASS. Vor jeder neuen Produktarbeit muss der Altbestand vollständig `MAIN_DELIVERED` oder mit Archivref und Inhaltsledger `ABANDON_AS_SUPERSEDED` sein.

1. Frisches `origin/main`, Root, Branch, Basis, HEAD, sauberer Baum und Manifest-Allowlist belegen.
2. Kein neuer Clone, Worktree oder Ausweichordner. Ein sauberer Paketbranch im bestehenden `02_app`.
3. Kein abhängiger Codebranch vor `MAIN_DELIVERED` seines Vorgängers. `KR-03a`, `KR-03b-1` und `KR-03b-2` sind **Neubauten auf dem jeweils integrierten frischen `main`**, keine Rebases von #115.
4. Lokale Gates, eine Review, gegebenenfalls eine Korrektur, Delta-Prüfung und Required Checks vollständig.
5. Der Merge-Akteur wird in `KR-00b` aus der aktuellen Owner-Delegation konkret gebunden. Ohne Akteursreceipt kein Merge.
6. Das Vier-Arbeitsstunden-SLO beginnt erst mit Exact-SHA-Ratifikation und allen anwendbaren grünen Gates.
7. Danach Merge, Post-Merge-CI, `CURRENT_STATE`/Mission und erst dann das nächste abhängige Paket. Wegen des belegten automatischen Vercel-Production-Folgeschritts gilt zusätzlich der Production-Grenzpunkt aus dem Ausführungsnachtrag.

Vor Schließung eines alten PRs entsteht ein unveränderlicher Archivref `archive/pr-<nr>-<sha>` samt Commit-/Dateiinventar. Remote-Branches werden nicht gelöscht. Migrationen werden additiv vorwärts korrigiert; Revert nur migrationsfrei und mit demselben Gateverfahren.

### 3.5 Stabiler Rechnerbetrieb

Vor Writer/Reviewer:

```text
AUTOMATIONS_DISABLED=9_OF_9
PROJECT_PROCESSES=NO_STALE_WRITER_NO_STALE_WATCHER
AVAILABLE_RAM_MB=<KR-01_CALIBRATED_MINIMUM>
SHELL_PROBE_SECONDS=<KR-01_CALIBRATED_MAXIMUM>
GIT_STATUS_SECONDS=<KR-01_CALIBRATED_MAXIMUM>
HEAVY_PROFILE=<NONE|DB_ONLY|DB_PLUS_ONE_BROWSER>
```

- Auf diesem Computer läuft höchstens ein Claude-Writer **oder** -Reviewer.
- Nie zwei Schwerprüfungen parallel; DB plus genau ein Browser nur wenn das Manifest es verlangt.
- Projektbezogene DB-/Browser-/Docker-Prozesse werden nach Erfolg und Abbruch kontrolliert beendet; keine Volumes werden gelöscht.
- `KR-01` misst die belastbaren Schwellen. Bis dahin startet keine Schwerlast.
- OE-2609-17 wird nicht aufgehoben. Der parallele Off-Repo-Modulkernbau ist auf diesem Computer lediglich pausiert. Reaktivierung oder Änderung braucht `OG-KR-07` und darf den seriellen Repo-Bau nicht belasten.
- Keine Nachtwache, kein Watchdog, kein automatischer Neustart, kein Browserpark und keine wiederkehrende Statusinventur.

## 4. Vorbereitung und Repository-Wahrheit

| ID | Paket | Verbindlicher Austritt |
|---|---|---|
| `KR-00a` | Prozess-Freeze und sauberer Ausgang | 9/9 Automatiken aus; kein Kreile-Runner; B2 sauber verlassen, lokales `main` auf `origin/main` ausschließlich fast-forwarden; B2-Branch lokal/remote unangetastet; keine destruktive Git-Operation. Der Lerninsel-PL bleibt räumlich und prozessual getrennt. |
| `KR-00b0` | Master-Richtung | Durch den Owner-Nachtrag entschieden: Repo-Register = operative Produktentscheidungsquelle; externe `00_BIBEL` = ratifizierbare Eingabe. Die Entscheidung wird zuerst extern protokolliert und danach bytegleich beziehungsweise mit eindeutigem Source-Lock ins Repo übernommen; die unterlegene Aussage wird additiv supersediert. |
| `KR-00b` | Kanonischer Truth-Sync | Reales `main`, PRs, OE-2609-01…33 und Dossiers nach D-GOV-001 als `RATIFIED`/`MAPPED`/`REFERENCE_ONLY`/`REJECTED`. Äußere `galvanik_kreile/AGENTS.md` korrigieren (stale Dirty-Worktree- und Template-Verweis), als externe Sitzungssteuerung markieren und im Authority-Dokument benennen. Modulkarte: Analyse/Buchhaltung „hinten angestellt“, Analyse-Menüpunkt. Zahlungsziel 14 Tage; alte 30-Tage-Aussage supersediert. Additive Tabellen-/View-Delegation, DoD-Delegation an benannten PL und Merge-Akteur ratifizieren. Für #86/#95/#96/#110–#112 Merge-SHA und Post-Merge-Beleg, sonst `UNKNOWN`. |
| `KR-00c` | Missionsvertrag reparieren | Ein reales aktives Paket/Base; stale A2-Felder historisiert; `MISSION_TEMPLATE.yml`-Verweis entfernt, keine Wiederanlage; eine Korrektur; Fachgateprüfer getrennt vom einen Implementierungsreviewer. |
| `KR-00d` | PR-/Commit-Disposition | Reale PR-Liste frisch enumeriert: offen #113–#115, geschlossen/unmerged #84. #113/#114/#115/#84 je Basis, Head, Diff, Checks, Nutzen, Überschneidung mit aktuellem `main` und Disposition. Archivrefs mindestens `archive/pr-84-9845e91e`, `archive/pr-113-e477e6b2`, `archive/pr-114-0d3bacc6`, `archive/pr-115-71dbc815` plus Inventar. |
| `KR-00e` | Delivery-Vertrag | Manifest-Schema unter `docs/delivery/packages/`, Findings-Ledger, Exact-SHA-Closure-Receipt und Gateabbildung als Governance-Dateien. |
| `KR-00g` | Docs-Import | Dossiers, Plan und offene Punkte nach `docs/module/`/`docs/project/`, jeweils Banner `REFERENCE_ONLY_NON_EXECUTABLE`, Source-Lock und `documentClassifications` in `quality/authoritative-sources.json`; Authority-Gate und Selftest grün. |
| `KR-00f` | Rollende Manifeste | Zunächst nur Governance, B1 und B2a ausführbar. Danach immer genau das nächste abhängige Manifest, kein veraltender Vorrat. |
| `KR-01` | Governance-Merge und Betriebsreceipt | `KR-00b`–`KR-00g` in einem nach Allowlist geteilten Governance-Mergezug; Branch-Protection-Receipt belegt real Required: `quality`, `agentur-gate`, `Fresh Supabase replay`, keine Bypass-Akteure. `ratchet` muss grün laufen und wird entweder autorisiert Required oder ehrlich als nicht Required dokumentiert; keine falsche Schutzbehauptung. Rechnergrenzen messen. Ohne Receipt startet `KR-02` nicht. |

## 5. Erster Mergezug und alte PRs

Ziel des ersten funktionsfähigen Fensters: Sämtliche verwertbare, noch nicht auf `main` enthaltene Arbeit aus #84 und #113–#115 ist über kleine frische Pakete integriert; unbrauchbare oder supersedierte Teile sind verlustfrei archiviert und geschlossen. **Vorher startet keine neue Produktarbeit.**

1. `KR-00b0`: Master-Richtung festhalten.
2. `KR-01`: Governance und Required-Checks-Receipt mergen.
3. `KR-04`: #113 nach Archivierung und Inhaltszuordnung schließen; kein Mock-CSS-/Copy-Paket mergen. Jeder belegte reale Restnutzen wird als `KR-04R` auf frischem `main` vor neuer Produktarbeit gebaut, geprüft und integriert.
4. `KR-02`: #114 am exakten Head einmal breit reviewen, höchstens einmal korrigieren, Delta-Prüfung, Full CI/Fresh Replay. Besteht er, exakt mergen; andernfalls einmal `KR-02R` auf frischem `main`, danach #114 superseden.
5. #115 schließen, sobald sein Ledger eingefroren, Archivref gesetzt und jeder gültige Anteil namentlich in `KR-03a`/`KR-03b-1`/`KR-03b-2` übernommen ist. Die Schließung wartet nicht auf deren Lieferung; **neue Produktarbeit wartet aber auf `MAIN_DELIVERED` aller drei Ersatzpakete**.
6. Erst nach `KR-02 MAIN_DELIVERED`: `KR-03a`, danach `KR-03b-1`, danach `KR-03b-2` jeweils auf frischem integriertem `main`.
7. `KR-05`: #84 vollständig gegen das dann aktuelle `main` abgleichen. Bereits supersedierte Inhalte werden pfadweise belegt; jeder noch gültige fehlende Suchanteil wird als kleines frisches Paket auf der inzwischen gelieferten Ziel-Shell integriert und vollständig neu abgenommen.
8. Der Altbestand ist erst geschlossen, wenn `KR-02`, `KR-03a`, `KR-03b-1`, `KR-03b-2`, gegebenenfalls `KR-04R` und gegebenenfalls `KR-05R` entweder `MAIN_DELIVERED` oder mit pfadweisem Beleg `ABANDON_AS_SUPERSEDED` sind.

| ID | Ein Ziel | Verbindlicher Nachweis |
|---|---|---|
| `KR-02` | B1 P0-Storno | Eine additive Guard-Migration, betroffene Integrationsbelege und unvermeidliche CI-Verdrahtung; Fresh Replay, Quality, Ratchet, Agentur-Gate. Verkleinerung der 699-Zeilen-Testdatei ist vorab `P2/later`, kein Korrekturverbrauch. |
| `KR-03a` | Reine Termintreue-Domäne | Bestätigter Termin, Fertig-Instant, genau ein valides V1 oder V2, Storno/Missing; keine DB/Port/Workflow; Unitmatrix V1/V2/invalid/mehrfach/storniert/DST. |
| `KR-03b-1` | Finaler DB-Lesevertrag | Eine neue finale Migration mit zwei gehärteten Views, Tenant/GUC, Finanzfeld-Ausschluss, Europe/Berlin, Fresh Replay; alte ungemergte B2-Migrationen werden nicht übernommen. |
| `KR-03b-2` | Autorisierter Server-Port | Ein Server-Port, Manifestdeklaration und fokussierte Fresh-DB-Suite für Range, Mapping, V1/V2, Mehrfachereignis und RLS; keine neue Migration. |
| `KR-04` | #113 schließen | Echte, noch nicht auf `main` liegende Rechnungsanteile pfadweise identifizieren; Archivref, Kommentar, Schließung, Branch erhalten; Mock-CSS/-Copy ausdrücklich verwerfen. |
| `KR-04R` | #113-Restnutzen | Nur falls `KR-04` einen gültigen fehlenden Anteil belegt: kleines frisches Paket auf aktuellem `main`, gleiche Review-/CI-Kette, vor neuer Produktarbeit `MAIN_DELIVERED`. |
| `KR-05` | #84 Suchabgleich | Geschlossenen Kandidaten gegen aktuelles `main`, Ziel-Shell und aktuellen Suchvertrag pfadweise abgleichen; keine alte Header-/Overlay-Integration übernehmen. |
| `KR-05R` | #84-Restnutzen | Nur falls `KR-05` einen gültigen fehlenden Anteil belegt: kleines frisches Suchpaket mit vollständiger Route und neuer Abnahme, vor neuer Produktarbeit `MAIN_DELIVERED`. |

`due_date` bleibt einzige bestätigte Terminwahrheit. `promised_due_date` ist höchstens read-only Konfliktdiagnose. Europe/Berlin ist entschieden, keine neue Ownerfrage.

## 6. Designfundament und vollständiger Grundappstamm

### Phase A — UI-Wahrheit, Designsystem und Shell

| ID | Ziel | Verbindlicher Nachweis |
|---|---|---|
| `KR-10a` | UI-Wahrheit binden | Registerentscheidung: V1.1 = Token-/Komponentenwahrheit, vier kanonische HTML-Dateien = Seiten-/Flowwahrheit; bei Konflikt gewinnt Seitenreferenz für Layout, V1.1 für Token/Komponente. `00_UI_REFERENZEN_PFADE.md`, `authoritative-sources.json`, `UI_REFERENCE_CONTRACT` und Selftest in einem Diff; Authority-Gate/Selftest grün. |
| `KR-10b` | Designsystem V1.1 importieren | 55/55 Hashes; Ziel standardmäßig `02_app/ui`; Touchzeile ≥48 px; feste Farben tokenisiert. Manifest nennt CSS-/TSX-Import, `tsconfig`-Auswirkung `keine`, `src/app/layout.tsx`-Verdrahtung. `tsc`, `lint:full`, Basis-Module-Gate grün. Pfadabweichung nur `OG-KR-13`. |
| `KR-11` | App-Rahmen/Navigation | Eine Shell, sichtbare Identitäten Rolf/Phillip/Gregor, technische Rollen intern; `/start` Login, `/` Rollen-Home; Backstack und keine tote Route. |
| `KR-12` | Rolf-Startseite | Dringendes oben, Zeitstrahl „Heute & Woche“ darunter, kein Kassieren; reale Ports oder gesperrter Zustand. |
| `KR-13` | Phillip-Startseite | Werkstattfokus, Zeitstrahl, Abwesenheiten/Bündelung, bestehende Gates, keine Geldsicht. |
| `KR-14` | Gregor-Startseite | Erst nach `OG-KR-08`; reale System-/Rechte-/Provider-/Jobfakten, kein künstliches Dashboard. |
| `KR-15` | Shell-/Home-Gate | Capability Registry, No-Fake-Production, alle Navigationen, negative URLs, drei Viewports, Tastatur/Touch, sieben Zustände; `OG-KR-11` Delegation und `OG-KR-12` Geräte-Freeze geschlossen. |

### Phase B — Kernoberflächen

| ID | Ziel | Verbindlicher Nachweis |
|---|---|---|
| `KR-16` | Orders V8 Liste | Reale Auftragsprojektion, Status, bestätigter Termin, nächste Handlung; keine zweite Karte. |
| `KR-17` | Orders V8 Detail | Lebenszyklus, Teile, Termine, Freeze, Evidenz, Receipt/Readback/Rückweg; G07 bleibt Fremdport. |
| `KR-18` | Customers V2 Liste | Reale Kundenwahrheit, autorisierte Ports, keine Beispieldaten. |
| `KR-19` | Customers V2 Detail | Kontakte, Aufträge/KV, Zielrechnungsfreigabe über kanonischen Command, Dublettenstatus, Backstack. |
| `KR-20` | Geld & Rechnungen | F1.4/F1.5, PDF/Storno/Zahlung/Warenausgang im Designsystem; keine erfundenen Kennzahlen; Zahlungsziel 14 Tage. |
| `KR-21` | Kunde→KV→Auftrag | Vorhandene persistente Verträge, genau ein Auftrag, Idempotenz, Reload/Lost response. |
| `KR-22` | Kernoberflächen-Gate | Listen-/Detail-/Overlay-Wahrheit, Deep-Links, Rollen, Browsermatrix, A11y, Real-DB-Sandbox, Owner-UX und Geräte-Freeze. |

### Phase C — fehlende Grundstamm-Verträge

| ID | Ziel | Verbindlicher Nachweis |
|---|---|---|
| `KR-23a` | Rechte-Fassade | Standardzugriff nach ratifiziertem OE-2609-09, personenspezifische Sperre/Erweiterung, Audit und Serverdurchsetzung. |
| `KR-23b` | Rechteverwaltung UI | Nach `OG-KR-08`; Gregor/Admin, sieben Zustände, Selbstsperr-/Race-/Reload-Fälle. |
| `KR-24a` | Termin-/Abholtermin-Vertrag | `due_date` und separater `pickup_due_date`, versionierter Änderungsgrund, eine Migration/Port. |
| `KR-24b` | Woche/Monat | Nach `OG-KR-08`; Europe/Berlin, reine G04-Darstellung, keine M365-Abhängigkeit. |
| `KR-25a` | Konflikt-/Sperr-Engine | Ratifizierter Grundregelstamm, Zuständigkeit, deterministische Fakten, keine autonome Entscheidung. |
| `KR-25b` | Handlungsbedarf | Nach `OG-KR-11`; derselbe Konfliktport auf Startseiten/Karten, Hauptaktion/Später/Weitere, Konflikte nie eingeklappt. |
| `KR-26a` | Zahlungsstandard/Zielrechnung | Abholung bar/Karte, sonst Vorkasse; Zielrechnung nur nach Kundenfreigabe; Server-/DB-Gates, kein Provider. |
| `KR-26b` | Zahlungs-/Warenausgangs-UI | Nach `OG-KR-08`; V1/V2, Bestätigung, Receipt/Readback, Terminal „In Aufbau“. |
| `KR-27` | ZUGFeRD | Erst `OG-KR-09`; festes Profil/Version, Validator, PDF/XML-Bindung, Korrektur/Storno. |
| `KR-28` | Ausgangsrechnungs-Export | Erst `OG-KR-08`/`OG-KR-09`; ratifiziertes CSV/DATEV-Format, Rollen, Vollständigkeit/Reconciliation. |
| `KR-29` | Grundappstamm-Abnahme | Rechte, Konflikte, Termine, Zahlung, ZUGFeRD, Export, Route-/Token-/Stub-Kill-Liste, Browser/A11y/Security/Privacy/Performance/Fach-UAT ohne P0/P1. |

## 7. Search, M365-Kalender und F1.6

| ID | Ziel | Verbindlicher Nachweis |
|---|---|---|
| `KR-30a` | Neutraler Suchvertrag | Anfrage/Ergebnistyp/Quelle/Rang/Zeitstand/Deep-Link; autorisierte öffentliche Read-Ports, keine AI-/Fachwahrheit. |
| `KR-30b` | Lane-0-Suche | Kunden/Aufträge/KV/Rechnungen; Rechte vor Retrieval, kein Leakage, Leer-/Fehler-/Teilzustand. |
| `KR-30c` | Ziel-Shell-Suche | Kopfleiste, Tastatur/Touch/Backstack und Full-Route-Reabnahme; #84 nur Vergleichsquelle. |

Reale M365-Arbeit setzt `OG-KR-01` voraus: Kreile-eigener Tenant, lizenziertes Büropostfach, delegierte Minimalrechte, Consent, Kosten, AVV/Region, Secret-Owner und Rotation.

| ID | Ziel | Verbindlicher Nachweis |
|---|---|---|
| `KR-31` | Datenklassen-/Retentionsregister | Zweck, Rechtsgrundlage, Felder, Empfänger, Region, Frist, Löschung/Backup/Auskunft/Legal Hold. |
| `KR-32` | CalendarPort/Secretvertrag | Keine Ressourcenanlage; Minimalrechte, Secret Store, Rotation, Leaktest, Kill-Switch. |
| `KR-33` | Auftragstermin-Outbound | Idempotente Create/Update/Cancel-Projektion, minimale Übersicht/vollständiger Termin, App-Links, Receipt/Retry. |
| `KR-34` | Delta-Inbound | Abwesenheiten/Betriebstermine read-only, Delta/Webhook, Reihenfolge, Tombstone, Lease/Erneuerung. |
| `KR-35` | Reconciliation | Drift/Duplikat/Ablauf/Löschung sichtbar, keine stille Überschreibung, Gregor-Warnung. |
| `KR-36` | Kalenderansicht | Nachschlageweg, drei Viewports/Offline; Kalendervertrag in Authority-Gate und `PROVIDER_CAPABILITY_MATRIX.md` koordiniert auf neuen Zustand heben; Registry/No-Fake-Production grün. |
| `KR-37` | Kalender-Sandboxgate | Autorisierte Dev-Sandbox, synthetische Daten, E2E/Privacy/Security; keine Production. |
| `KR-38` | F1.6-Pilotbereitschaft | `KR-29`, `KR-30c`, `KR-37` auf `main`; Kernweg Eingang→Ausgang, Rollen/Reload/Race/Lost response und Real-DB-Sandbox; höchstens `PROPOSED_PASS`. |

## 8. Module M01 bis M07

OE-2609-17 bleibt gültig. Externe Modulkernarbeit darf nur mit `OG-KR-07` reaktiviert werden und weder diesen Computer noch das Kreile-Repo parallel belasten. Adoption in `02_app` bleibt strikt seriell. Vor jedem Modul klassifiziert ein kleines Repo-Paket das importierte `REFERENCE_ONLY`-Dossier als `KEEP`, `MAP`, `QUARANTINE` oder `EXTERNAL_OWNER_GATE`; Kreile-HostAdapter und genau eine Datenwahrheit sind Pflicht.

| ID | Modul | Eintritt/Austritt |
|---|---|---|
| `KR-40` | M01 Buchhaltung | Manueller Kontostand/laufende Kosten/Gehalts-Summen, Belege/Mahnwesen/E-Rechnung-Empfang; PaymentAdapter nur `OG-KR-02`; Fach-/Steuerabnahme. |
| `KR-41` | M02 Analyse | Termintreue aus `KR-03a`/`KR-03b-1`/`KR-03b-2`, Liquidität aus M01; Formel/Zeitraum/Datenstand/Lücke/Drilldown. |
| `KR-42` | M03 Führung | Ziele, Verantwortliche, Wirkung auf Termintreue/Liquidität, keine autonome Entscheidung. |
| `KR-43` | M04 Kalender | `KR-32`–`KR-37` als eine Modulgrenze, keine zweite Implementierung. |
| `KR-44` | M05 Kommunikation | Büropostfach, Eingang/Versand, Routing/Bounce/Retry/Reconciliation/Dokument-Port. |
| `KR-45` | M06 OCR | Azure-DI-Sandbox, Uploadhärtung, private Originale, Vorschlag plus Mensch, Retention/Kosten. |
| `KR-46` | M07 KI-Suche | Nach Search/OCR; RLS vor Retrieval, strukturierte Fakten, erneuerbarer Index, Injection-/Leakage-Eval. |
| `KR-47` | Modul-Gesamtabnahme | M01–M07 seriell auf `main`; jede aktive Providernaht `PROD_VERIFIED` oder vor Live deaktiviert; keine P0/P1. |

## 9. Querschnitt, Rehearsal, Pilot und Live

| ID | Ziel | Verbindlicher Austritt |
|---|---|---|
| `KR-50` | Dubletten/Telefonnotiz | Erklärbare Warnung, menschliche Entscheidung, Audit/Retention, keine stille Zusammenführung. |
| `KR-51` | Aufbewahrung | Fristen, Vorschläge statt Löschung, Adminfreigabe, Outlook-Anonymisierung, Legal Hold; `OG-KR-03`. |
| `KR-52` | Hintergrundjobs | ADR ratifiziert OP-37 (Supabase Cron/Outbox + Vercel-Eingang), entscheidet nicht neu; Receipts/Retry/Dead-letter/Monitoring; Kosten `OG-KR-04`. |
| `KR-53` | Offline/Resilienz | 48-h-Verhalten, Konflikt/Replay, kein Erfolg ohne Serverreceipt. |
| `KR-54` | Race-Härtung | Auftragsnummern, Idempotenz, Versionierung, Lost response aller Kerncommands. |
| `KR-55` | Hygiene | Alt-Routen, zweite Suche, Stubs, Mock-CSS, tote Warnpfade und alte Tokens erst nach Zielmigration entfernen; Negativtests. |
| `KR-56` | Security/Privacy | Tenant/RLS/IDOR/CSRF/Session/Secrets/Logs/Uploads/Dependencies; zusätzlich Leaked-Password-Protection, DB-Passwortrotation, `supabase_admin` Default Privileges, `pg_trgm`-WARN und alle RLS-Tabellen ohne Policy namentlich schließen; Dashboardanteile `OG-KR-10`. |
| `KR-60` | Verantwortlichkeiten | Product Owner, Fach-, Technik-, Datenschutz-, Security-, Steuer- und Incident-Verantwortliche benannt. |
| `KR-61` | Migrationsrehearsal | Lokal und autorisierte leere Wegwerfumgebung; Fresh Replay/Wiederholung/Forward-Fix, nie erster Lauf auf Production. |
| `KR-62` | Staging | Isoliertes Kreile-Staging, Auth/MFA/Rollen/Adapter, synthetische Daten; keine Production. |
| `KR-63` | Backup/Restore | RPO/RTO beschlossen, Backup real in getrennte Umgebung wiederhergestellt. |
| `KR-64` | Altdatenplan | Quelle/Eigentümer/Mapping/Bereinigung/Dublette/Stichprobe/Reconciliation/Quarantäne/Rückfall. |
| `KR-65` | Monitoring/Incident/Support | Health, Queue-/Providerablauf, Redaction, Alarm/Kill-Switch, Meldung/Support/Offboarding/Rotation getestet. |
| `KR-66` | Gesamtabnahme | Kernweg/Module E2E, ZUGFeRD-Profil, Offline, Restore, Security/Privacy/Steuer/Fach-UAT, drei Profile/Viewports, keine P0/P1; Production `NOT_YET_AUTHORIZED`. |
| `KR-70` | F1.6 Pilot | Erste mögliche Echtdaten-/Productionstufe; ausdrücklicher Owner-/Kreile-/Datenschutz-/Technik-Gate, Minimaldaten, tägliche Reconciliation, Abbruch/Rückfall. `LIVE_STATUS=NO_GO`. |
| `KR-71` | Formale Go-live-Freigabe | Exakter Release-SHA; alle Verantwortlichen, Verträge, Kosten, Provider und `OG-KR-10` erfüllt. |
| `KR-72` | Cutover | Kreile-eigene Production, URL/DNS, reale DB, Migration, Secrets, Datenübernahme, Rollback/Hypercare; keine Preview-Promotion. |
| `KR-73` | Betriebsübergabe | Restore-, Zugriff-, RLS-, Provider-, Dependency-, Performance-, Kosten- und Incidentprüfungen mit Eigentümern. Keine Bau-Automatiken. |

## 10. Externe Gates

| Gate | Empfohlene Entscheidung | Wesentlicher Nachteil | Blockiert nur |
|---|---|---|---|
| `OG-KR-01` M365/Azure | Kreile-eigener Tenant/Abo, Büropostfach, Minimalrechte, EU-Verträge/AVV, Admins. | Lizenz-/Cloudkosten. | realer Providerlauf |
| `OG-KR-02` Terminal/Bank | Einen Adapteranbieter nach Vertrag, Gebühren, Sandbox und Datenschutz wählen. | Bindung/Transaktionskosten. | Providerteil M01 |
| `OG-KR-03` Retention | Steuerberater/Datenschutz bestätigen Fristen und Legal Hold. | Werte können sich ändern. | `KR-51`, Pilot/Live |
| `OG-KR-04` Productionkosten | Vercel/Supabase/Azure/M365-Tarife freigeben. | Monatliche Kosten. | Productionaktivierung |
| `OG-KR-05` Pflichtfoto | Konfigurierbare Pflicht je Verfahren statt global. | Werkstattaufwand/Speicher. | betroffene Fertig-UI |
| `OG-KR-06` Master-Richtung | Repo-Register als operativen Master, externe Bibel als ratifizierbare Eingabe. | Zusätzlicher Sync-Commit. | erster Registerdiff |
| `OG-KR-07` Off-Repo-Parallelität | Bis zu ausdrücklicher Reaktivierung pausiert lassen. | Modulvorlauf dauert länger. | nur externer Modulkernvorlauf |
| `OG-KR-08` Design Schritt 2 | Optikvorlagen für Screens ohne V4/V8/V2 freigeben. | zusätzliche Designabnahme. | `KR-14`, `23b`, `24b`, `26b`, `28` |
| `OG-KR-09` ZUGFeRD | Profil/Version plus Steuerfachabnahme festlegen. | Fachprüfung nötig. | `KR-27`, `28`, `66` |
| `OG-KR-10` Supabase Dashboard | Schutz/Rotation/Default Privileges freigeben und belegen. | Betreiberzugriff nötig. | `KR-71` |
| `OG-KR-11` Delegationsmodell | „Zugewiesen an“ mit Verantwortungswechsel/Audit festlegen. | zusätzlicher Commandvertrag. | Delegationsaktionen |
| `OG-KR-12` Geräte-Freeze | Gerätetestmatrix ownerseitig abnehmen und UI einfrieren. | Änderungen danach brauchen neuen Gate. | `KR-15`, `22`, `29` |
| `OG-KR-13` DS-Zielpfad | Nur falls `02_app/ui` trotz Nachweis nicht gatefähig ist, Zielpfad ändern. | Abweichung von OE-2609-03. | `KR-10b` |

## 11. Fortlaufende Übergabe und Erfolgskriterien

- Während Codepaket N in CI/Review ist, darf nur Manifest N+1 präzisiert werden. Abhängiger Code beginnt nach `MAIN_DELIVERED`.
- Ein externer Gate blockiert nur seine Nachfolger; unabhängige autorisierte Arbeit läuft weiter.
- Nach PASS/FAIL genau eine Folgeentscheidung; keine Statusschleife ohne neue Tatsache.
- Fortschritt ist ein verifizierter Kandidat oder belegtes `main`-Delta, nicht Agentlauf, Analyse oder Wiederholung.
- Vor neuer Produktarbeit sind #84 und #113–#115 pfadweise abgeglichen; jeder gültige Rest ist `MAIN_DELIVERED`, jeder übrige Teil mit Archivref und Inhaltsledger supersediert. B2 darf in mehrere serielle CI-Fenster fallen, aber nicht hinter neue Produktarbeit verschoben werden.
- Danach höchstens ein aktiver Code-PR; ratifizierter Kandidat innerhalb des Merge-SLOs.
- Mission, `CURRENT_STATE`, PR und `main` stimmen nach jedem Merge überein.
- Kein externer Dossiertext, Mock, Provider, lokaler Diff, Preview oder synthetischer Test wird als Repo-Wahrheit, Verbindung, Lieferung, Pilot oder Live ausgegeben.
- `LIVE` wird erst durch `KR-71` freigegeben und durch `KR-72` real hergestellt.

## 12. Redteamabschluss

Receipt und vollständige Disposition stehen in `BUILDPLAN_KREILE_OPUS_REDTEAM_2026-09-28.md`. Eine zweite breite Plan-Redteamrunde findet nicht statt. Jede spätere Prüfung ist eine gezielte Delta-Prüfung gegen den dort eingefrorenen Befundsatz oder die einmalige Implementierungsreview eines konkreten Pakets.
