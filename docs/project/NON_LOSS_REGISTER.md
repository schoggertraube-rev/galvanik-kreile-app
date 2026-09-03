# NON_LOSS_REGISTER

> **Ausfuehrungsautoritaet 2026-08-13:** Aktuell steuert ausschliesslich
> `missions/F1_ORDER_TO_CASH_PILOT_001.yml` die Reihenfolge M0 -> F1-R0 -> F1.2 bis F1.6.
> Aeltere Zeilen mit `ACTIVE`, offene PR-Listen und Worktree-Angaben unten sind bewahrte Historie
> oder Produkt-Backlog; sie starten weder eine Parallelmission noch ueberschreiben sie `main`.
> Der Produktumfang bleibt geschuetzt und wird seriell ueber reale Vertikalschnitte geliefert.

> **Nachtrag 2026-08-27 (Frontend-Lane):** Neben der Order-to-Cash-Lane ist
> `missions/FRONTEND_IMPLEMENTATION_001.yml` eine zweite autorisierte Paket-Lane. Es gibt damit zwei
> autorisierte Paket-Lanes, nicht zwei aktive Implementierungen: aktiv ist ausschliesslich die
> Parallelplanung. Disjunktheit der Implementierung ohne Pfad-, Migrations- oder
> Datenwahrheitsueberlappung ist erforderlich, aber noch nicht belegt; ist die Trennung nicht
> beweisbar, wird sequenziell gearbeitet. Es gilt
> `single_active_code_writer_across_frontend_and_f1 = true`: insgesamt genau EIN aktiver Code-Writer,
> nicht je Teilphase einer; Frontend- und F1-Writer laufen nie parallel, read-only Reviewer und
> Inventare duerfen parallel laufen. Die dort geschuetzten Zieloberflaechen, Routenentscheidungen und
> die Baeder-Disposition stehen unten im Abschnitt "Frontend-Zieloberflaechen, Routen und
> Disposition". Ratifiziertes Zielbild heisst nicht geliefert.

> **Nachtrag 2026-08-27 (Owner-Autonomie-Mandat):** Owner-Provenienz
> `KREILE_AUTONOMIE_MANDAT_2026-08-27.md`, SHA-256
> `C244EC1C5F1FF1493420F4DCC44FEFCD8F0E76CEAEFD16853BE2A4E4C539364A`, 4904 Bytes. Die Datei liegt
> ausserhalb des Repositories, ist ausschliesslich Herkunft, wird nicht veraendert oder kopiert und
> ersetzt keinen Gatebeweis. Sie ist `PROVENANCE_OF_ACTIVE_OWNER_AUTHORITY`, `valid_from`
> 2026-08-27, `valid_until` `NEXT_REAL_JOINT_OWNER_ORCHESTRATOR_DECISION`, weiterhin gueltig und
> nicht revoziert; ihr Teil 3 war der Abschluss derselben Uebergabe. Sie ratifiziert F1.4
> vollstaendig, ratifiziert das Frontend als Parallelpaket samt getrennter Statusachsen, setzt die
> globale Ein-Writer-Regel und erteilt eine stehende Merge-Autoritaet:
> `authority_status: STANDING_GRANTED`, `additional_owner_merge_approval_required: false`,
> `owner_ux_pass_blocks_merge: false`. Davon getrennt steht die Paketreife
> (`eligibility_status: NOT_MATURED`), die am exakten SHA gruene mergeblockierende Gates, keine
> offenen P0/P1, vollstaendig ratifizierten Scope sowie Review, CI und E2E `PASS` verlangt. Die
> Autoritaet ist also erteilt; das konkrete Paket ist heute noch nicht merge-eligible. Manuelle
> Production-Promotion und manueller Deploy bleiben `FORBIDDEN`; ein bereits bestehendes
> automatisches Vercel-Deployment als Folge eines spaeter autorisierten `main`-Merges wird nicht
> manuell ausgeloest, sondern danach nur beobachtet und belegt.

> **Nachtrag 2026-08-10 (massgeblich fuer Fundament-Stati):** Alle FUNDAMENT-Eintraege dieses
> Registers (u.a. DB-TRUTH-001, LEDGER-CONSOLIDATION-001, RLS-CONTRACT-001, die Fundament-PR-Listen
> #42/#43/#44 sowie die Branch-Disposition) sind durch F0 abgeschlossen bzw. ueberholt:
> Ledger RECONCILED 9/9 (Digest 268ce6c1), Fresh-Replay x2 deterministisch im CI, RLS-CONTRACT
> angewendet und CI-getestet, PRs #42/#43/#44 seit 06.-08.08.2026 geschlossen; einziger offener
> Foundation-PR ist #57. Massgeblich sind docs/project/CURRENT_STATE.md und
> docs/evidence/f0/F0_FINAL_REPORT.md. Die untenstehenden Fundament-Zeilen sind HISTORIE
> (Original-Wortlaut bewusst erhalten, damit die Salvage-Herkunft prueffbar bleibt).
> PRODUKTSCOPE-Eintraege (Ideen, Module, geschuetzte Produktziele) bleiben unveraendert gueltig.

Stand: 2026-08-06

Dieses Register schuetzt bestaetigte Produktziele, verschobene Missionen und verwertbare Alt-Arbeit vor stiller Verwerfung. Ein Eintrag darf nur mit belegter Produktentscheidung entfernt werden.

## Statuswerte

- `ACTIVE`: aktuell in Arbeit oder unmittelbar als Naechstes.
- `READY_AFTER_DEPENDENCY`: fachlich bestaetigt, wartet auf benannte Abhaengigkeit.
- `BLOCKED`: externer, fachlicher oder technischer Blocker ist benannt.
- `CANDIDATE_NO_MERGE`: gepruefter Zwischenstand, dessen Sicherheits-/Produktvertrag noch nicht reicht.
- `PROTECTED_SALVAGE`: keine Lieferwahrheit; verwertbare Quelle bleibt erhalten.
- `DEFERRED_WITH_REASON`: bewusst spaeter, Grund dokumentiert.
- `PROTECTED_BACKLOG`: bestaetigter Produktumfang, noch nicht terminiert.
- `DONE_VERIFIED`: auf Production und im relevanten End-to-End-Weg nachgewiesen.
- `UNKNOWN_EXTERNAL`: aus dem aktuellen Arbeitsbereich nicht belegbar.
- `OWNER_RATIFIED_NOT_IMPLEMENTED`: Zielbild oder Vertrag vom Owner ratifiziert, Umsetzung existiert nicht.
- `PENDING_OWNER_RATIFICATION`: eingereicht, vom Owner noch nicht ratifiziert.
- `REFERENCE_ASSET_RECOVERY_REQUIRED`: verbindliche Referenzdatei fehlt oder ist nicht gebunden; Arbeit daran ist gesperrt.
- `RATIFIED_CONTRACT_DRIFT`: Vertragsinhalt ist vom Owner vollstaendig ratifiziert; Mission, Migration oder Code weichen davon ab. Klasse `FAIL_INTERNAL`, keine offene Ownerentscheidung.
- `PARALLEL_PLANNING_ACTIVE`: als Parallelpaket ratifiziert und geplant; Implementierung nicht begonnen und getrennte Ausfuehrung nicht belegt.
- `OPEN_NOT_GRANTED`: Freigabe ist offen und ausdruecklich nicht erteilt; sie wird nie als erteilt dargestellt.

## Truth-, Quality- und Datenbankmissionen

| ID | Ziel | Status | Abhaengigkeit / Nachweis |
|---|---|---|---|
| `TRUTH-CLEANUP-001` | Eine kanonische Sicht auf `main`, Vercel, Supabase, PRs und Worktrees. | `DONE_VERIFIED` | PR 25; `main`, Vercel und Archive-Receipts gegengeprueft. |
| `QUALITY-RATCHET-001` | Globalen Lintbestand maschinenlesbar festhalten und jede Erhoehung blockieren. | `DONE_VERIFIED` | PR 26; Inline-Disable wirkungslos; geschuetzter Base-Judge besteht und `main-protection` verlangt jetzt `quality` und `ratchet`. |
| `LINT-DEBT-001` | 484 Fehler und 459 Warnungen in kleinen nichtfachlichen Wellen bis null abbauen. | `DONE_VERIFIED` | PR #31; ESLint 0/0 und Ratchet aktiv. |
| `BRANCH-DISPOSITION-001` | Alte PRs unveraenderlich archivieren, inventarisieren und erst danach schliessen. | `DONE_VERIFIED` | PR 8/15/19/20 einzeln kommentiert und ungemergt geschlossen; Archivrefs, Receipts und Quellbranches erhalten. |
| `WINDOWS-WORKTREE-AUDIT-001` | Externen Windows-Checkout samt bekannter Diagnose- und nicht versionierter Arbeit inventarisieren und verlustfrei sauberstellen. | `UNKNOWN_EXTERNAL` | Nur im betroffenen Checkout ausfuehrbar; kein Reset/Stash/Delete. Erwartete Quelle: `diagnose/auth-session-permissions-2026-06-17@1621702` sowie Capture-/Foto-/Testarbeit. |

## Sicherheits- und Betriebsmissionen

| ID | Ziel | Status | Abhaengigkeit / Nachweis |
|---|---|---|---|
| `P0-AUTH-BYPASS-001` | Gefaelschte/alte Cookies und oeffentlichen Tablet-Testlogin aus Production entfernen. | `DONE_VERIFIED` | PR 23, Vercel Production und negative WebKit-/HTTP-Nachweise. |
| `P0-START-BOUNDARY-001` | Oeffentliche Auftragsausgabe und anonyme Reset-/Seed-Grenzen schliessen. | `DONE_VERIFIED` | PR 24, Production auf `b511318...`. |
| `W1-RUNTIME-RECEIPT-001` | Nullable Receipt-Spalten und partielle Unique-Indizes bereitstellen. | `DONE_VERIFIED` | Production/Integration/Postflight und PR 22; Runtime-Nutzung separat offen. |
| `LIVE-AUTH-001` | Abgelaufene Sitzung schliesst Erfassung, loescht App-Session und fuehrt nach `/start`. | `ACTIVE` | Cookie-/Routengrenzen gehaertet; realer Ablauf mit zuvor gueltiger, dann abgelaufener Sitzung noch vollstaendig zu bestaetigen. |
| `AUTH-IDENTITY-002` | Benutzerwechsel MK -> Admin -> MK ohne alte Rolle, Initialen, Rechte oder Sessionreste. | `DONE_VERIFIED` | PR #33; atomarer Auth-State und keine localStorage-Identitaet. |
| `SEC-PIN-002` | PIN-Hashing-Grundlage, kein Default und zentrale Rollen-/Rotationsregeln. | `DONE_VERIFIED` | PR #37 als Grundlage; Recovery-Kandidat entfernt zusaetzlich Klartext-Schreibpfade. |
| `SEC-PIN-002B` | Device-/Challenge-Grenze, serialisierter Fehlversuchsschutz, Session-Widerruf, Bestandsrotation und finaler Plaintext-Ausschluss. | `ACTIVE` | Race, Rotation, Bestandsmigration und Session-Widerruf umgesetzt; Device-Challenge bleibt Produktentscheidung. Production 2026-08-05 auf 6/6 bcrypt migriert und verifiziert. Leaked-Password-Schutz vor Go-live im Dashboard aktivieren. |
| `OFFLINE-SHELL-001` | Eine Service-Worker-Registrierung; App-Shell offline nutzbar. | `READY_AFTER_DEPENDENCY` | Nach Quality-/Identity-Vertrag. |
| `OFFLINE-48H-001` | 48 Stunden arbeitsfaehig mit einer Outbox, verlustfreier Altqueue-Drainage, Neustart, Konflikt- und Wiederholschutz. | `READY_AFTER_DEPENDENCY` | Benoetigt stabile Shell, Receipt-Writer/Readback sowie Inventar, idempotenten Import, Quarantaene, Nutzeranzeige und Rollback fuer bestehende Browserqueues. |
| `SEC-STORAGE-001` | MIME-, Groessen-, Pfad-, Tenant- und Storage-Limits fuer Fotos/Dokumente. | `READY_AFTER_DEPENDENCY` | Mit Capture-/Storage-Vertrag. |
| `BACKUP-RESTORE-001` | Daten, Dokumente, Fotos, Audit und Wiederherstellung nachweisbar sichern. | `PROTECTED_BACKLOG` | Vor Verkauf/Go-live vollstaendig testen. |

## Angewandte Production-Aenderungen und Fundament-Fixes (2026-08-06)

Additiv ergaenzt. Kein Eintrag oben wurde entfernt.

### Angewandte Production-Aenderungen ausserhalb Ledger (`APPLIED_LEDGER_RECONCILED_2026-08-08`)

| Aenderung | Datum | Nachweis | Restarbeit |
|---|---|---|---|
| Data-API-Grant-Entzug (alle Tabellen/Views, `anon`/`authenticated`) | 2026-08-05 | 0 Grants per SQL verifiziert | ledgerfaehig nachziehen |
| Default-Privileges fail-closed (`postgres`) | 2026-08-05 | Migration angewandt | ledgerfaehig nachziehen |
| PIN-Bestand bcrypt cost 12 | 2026-08-05 | 6/6 verifiziert, 0 Legacy | ledgerfaehig nachziehen |
| D1 - Bucket `belege` privat | 2026-08-06 | `storage.buckets.public=false` verifiziert | Signed-URL-Umstellung (`SEC-STORAGE-BELEGE-001`) |
| D2 - EXECUTE-Entzug 9 App-Funktionen von `PUBLIC`/`anon`/`authenticated` | 2026-08-06 | `has_function_privilege` false fuer anon/auth; service_role/postgres behalten | ledgerfaehig nachziehen |
| Loeschung aller Tenant-Geschaeftsdaten | 2026-08-06 | ausdrueckliche Freigabe; alle Kern-/Abhaengigkeitstabellen = 0; 6 `app_users` erhalten | keine |

### Fundament-Fixes als offene PRs (CI gruen, ungemergt)

| PR | ID | Inhalt | Status |
|---|---|---|---|
| `#42` | `OFFLINE-DATALOSS-001` | SyncContext: kein Fake-Sync/Loeschen ohne Serveruebertragung | offen, Review PASS, kein Merge ohne Freigabe |
| `#43` | `INQUIRIES-SERVER-ACTION-001` | `inquiriesRepository` auf Server Action; kein Fake-Success | offen, Review PASS, kein Merge ohne Freigabe |
| `#44` | `TODAY-DATA-CONTRACT-001` | `dueValue`/`risk` server-seitig aus echtem `dueDate`; Mock-Typen raus | offen, Review PASS, kein Merge ohne Freigabe |
| `#41` | Docs/Offline-Containment | kuerzt geschuetzte Anforderungen | **nicht als-is mergen**; durch Doku-Korrektur ersetzt |

### Neue / aktualisierte offene Missionen

| ID | Ziel | Status | Nachweis / Restarbeit |
|---|---|---|---|
| `SEC-STORAGE-BELEGE-001` | `belege`-Anzeige/Download auf serverseitige Signed URLs | `READY` | Bucket ist privat; getPublicUrl darf hier nicht verwendet werden |
| `SUPABASE-ADMIN-DEFAULTPRIV-001` | Default Privileges von `supabase_admin` schliessen | `BLOCKED_EXTERNAL` | nur ueber Dashboard/Owner |
| `SYSTEMATIC-AUDIT-001` | Alle Client-Supabase-/Upload-/Rechnungs-/Reklamationspfade systematisch pruefen | `OPEN` | bisher nur review-benannte Dateien verifiziert |

## Offene PRs und Branch-Disposition

| Quelle | Status | Geschuetzter Wert | Verbot / naechste Aktion |
|---|---|---|---|
| PR `#8`, `fix/auth-identity-002-root`, Head `007b85bec133ea77675b9eb851d398b707ef905d`, PR-Base/Merge-Base `78c761f66f5bff2279ecc5bcfd1dd0a6462ffbba` | `PROTECTED_SALVAGE` | Identity-Switch-/Permissions-Ideen und Tests | Archiv `archive/pr-8-auth-identity-002-007b85b`, 3 Commits/15 Dateien; nicht mergen, Schliessung erst nach Truth-Kommentar |
| PR `#15`, `feature/capture-auth-tenant`, Head `f0090ab33fecac024415752366101add6102eb7f`, historischer PR-Base `02906c400516a765d07ac15455cfa6c668bd495a`, aktueller Merge-Base `27c463421af0aed98c85f173609855d41ff894b2` | `PROTECTED_SALVAGE` | Capture/Auth/Tenant-, Test- und CI-Arbeit aus 48 Commits | Archiv `archive/pr-15-capture-auth-tenant-f0090ab`, 48 Commits/149 Dateien; kein Sammelmerge |
| PR `#19`, `codex/foundation-security-remediation-20260715`, Head `338a13c09228ea1943bd06c40d4abbdea177a1e2`, PR-Base/Merge-Base `6e1d1831be823b7655130f0f46ba964d45c4b8dc` | `PROTECTED_SALVAGE` | Security-, Tenant-, RLS-, Schema- und Testkandidaten | Archiv `archive/pr-19-foundation-security-338a13c`, 11 Commits/692 Dateien; acht `20260713...`-Versionen sind ledger-registriert, Branch-Blobs unverified |
| PR `#20`, `codex/foundation-consolidation-v3-20260728`, Head `2589fdebb198720b168aab359236673e39c911d5`, PR-Base/Merge-Base `6e1d1831be823b7655130f0f46ba964d45c4b8dc` | `PROTECTED_SALVAGE` | Fail-closed-Adapter, Tests und Dispositionsmaterial | Archiv `archive/pr-20-foundation-consolidation-2589fde`, 12 Commits/430 Dateien; nicht mergen |
| geschlossener PR `#21` | `PROTECTED_SALVAGE` | Nachweis, dass die lokale Historie keinen Fresh-Replay besteht | nicht wiedereroeffnen/wholesale uebernehmen; Befund in `DB-TRUTH-001` verwenden |
| uebrige Remote-Branches | `PROTECTED_SALVAGE` | moegliche Einzelideen und historische Nachweise | keine pauschale Loeschung; erst maschinenlesbares Inventar und Einzelentscheidung |

Ein geschlossener PR verliert seinen Branch nicht automatisch. PR-Schliessung beendet nur die falsche Darstellung als aktiver Lieferkandidat.

## Lokale und externe Arbeitsstaende

| Quelle | Status | Regel |
|---|---|---|
| lokaler `main`-Worktree | sauber | exakt `origin/main`; keine Mission direkt darin entwickeln |
| `codex/foundation-gap-fill-001` | isolierter Recovery-Kandidat | Nur die verifizierten Claude-Luecken; kein Merge, Deploy oder Remote-DB-Write ohne Freigabe. |
| lokaler Truth-Worktree | isolierter Kandidat | nur kanonische Projekt-Dokumente |
| PIN-Checkpoint | `CANDIDATE_NO_MERGE` | Tree-identischer Remote-Checkpoint `dad42eb...` zu `d7d2bd3...`; bewusst kein lokaler Worktree und nicht mit Truth-/Lint-Arbeit vermischen |
| frueher genannter Windows-Dirty-Checkout | `UNKNOWN_EXTERNAL` | bekannte Hinweise: `diagnose/auth-session-permissions-2026-06-17@1621702`, bessere Offline-/Service-Worker-Arbeit sowie nicht versionierte Capture-/Foto-/Testarbeit; read-only inventarisieren, dann gezielt committen; kein Reset/Stash/Delete |

## Operativer Kern und Erfassung

| ID | Ziel | Status | Abhaengigkeit / Nachweis |
|---|---|---|---|
| `APP-STRUCTURE-001` | Zielgrenzen und Import-/Ownership-Vertrag fuer den realen Vertikalschnitt festlegen. | `PARTIAL` | PR #36 brachte Ownership-/Importregeln; verbleibender Vertrag folgt nach Foundation-Recovery, ohne Big-Bang-Umsortierung. |
| `OPERATIVE-SLICE-001` | Kunde -> Auftrag -> Behaelter/QR -> Teil -> Arbeitsaktion -> Today -> Receipt -> Readback. | `BLOCKED` | Strukturvertrag, PIN-/Rollen-/RLS-Grenze und W1-Runtime-Writer fehlen. |
| `CAPTURE-ORIGINAL-001` | Eine kanonische Originalerfassung vor OCR und Zuordnung. | `READY_AFTER_DEPENDENCY` | Identitaet und Offline-Shell stabil. |
| `OFFLINE-CAPTURE-001` | Foto/Datei offline sichern, Neustart ueberstehen und genau einmal synchronisieren. | `READY_AFTER_DEPENDENCY` | `CAPTURE-ORIGINAL-001`, `OFFLINE-48H-001`. |
| `APP-0001D-A` | Echte Kamera und Datei-Upload als getrennte, verstaendliche Wege. | `READY_AFTER_DEPENDENCY` | Salvage aus `feature/capture-auth-tenant`. |
| `APP-0001D-B` | OCR, privater Storage, `item_photos`, Signed URLs und Orphan-Cleanup. | `BLOCKED` | Remote-Schema, Migrationsquelle, Drizzle und RLS zuerst abgleichen. |
| `OCR-REVIEW-001` | Konfidenz je Feld; nur unsichere Felder pruefen. | `READY_AFTER_DEPENDENCY` | OCR-Vertrag. |
| `CAPTURE-ASSIGN-001` | Kunde, Auftrag und Teilgruppe sicher vorschlagen/zuordnen. | `READY_AFTER_DEPENDENCY` | Original- und OCR-Vertrag. |
| `LABEL-QR-001` | QR-/Etiketterkennung als schneller Zuordnungsweg. | `READY_AFTER_DEPENDENCY` | Teil des operativen Vertikalschnitts fuer Behaelteridentitaet. |
| `WARENEINGANG-EVENT-001` | Aufnahme erzeugt nachvollziehbares Wareneingangsereignis. | `READY_AFTER_DEPENDENCY` | Zuordnung und Receipt-Vertrag stehen. |
| `FIRST-PRODUCTION-CARD-001` | Erster vollstaendiger Eingang bis sichtbarer Produktionskarte. | `READY_AFTER_DEPENDENCY` | Wareneingangsereignis, Timeline und Today-Read-Model. |
| `FIRST-WARENEINGANG-E2E-001` | Original bis Kunde, Auftrag, Teil, Wareneingangsereignis, Timeline, Produktionskarte und Reload belegen. | `READY_AFTER_DEPENDENCY` | Operativer Slice, Capture-/Storage- und Offline-Vertrag muessen bestanden sein. |
| `AI-PHOTO-001` | Optionale Teile-/Zustandsanalyse mit Quellen, Konfidenz und Review. | `DEFERRED_WITH_REASON` | Erst nach belastbarer Original-, Storage- und Zuordnungsbasis. |
| `APP-PHOTO-002` | Wiederholungs- und Nacharbeitsfotos ohne Duplikat-/Verlustpfad. | `READY_AFTER_DEPENDENCY` | `APP-0001D-B`. |

## Modularitaet und Wiederverwendung

| ID | Ziel | Status | Abhaengigkeit / Nachweis |
|---|---|---|---|
| `MODULAR-CORE-001` | Neue Module ueber Ports/Provider, Typen, Props und Konfiguration entkoppeln. | `ACTIVE` | Gilt fuer jede neue Mission; Ist-Struktur ist noch route-first und stark gekoppelt. |
| `LEDGER-CORE-PREP-001` | Buchhaltungs-/OCR-Inventar, Schnittkanten, Direktzugriffe und spaetere Paketgrenze dokumentieren. | `READY_AFTER_DEPENDENCY` | Nach operativem Kern und stabiler Buchhaltungswahrheit; keine Extraktion. |
| `LEDGER-CORE-EXTRACT-001` | Stabilen Buchhaltungskern einmal kontrolliert herausloesen. | `DEFERRED_WITH_REASON` | Erst nach produktiver Buchhaltung und belegter End-to-End-Nutzung. |
| `SHARED-MODULE-CATALOG-001` | Capture, Suche, Timeline, Offline-Outbox und Analyse anhand realer Vertraege katalogisieren. | `PROTECTED_BACKLOG` | Keine vorschnelle Generalisierung. |

## Geschuetzte Produktroadmap

| Bereich | Geschuetztes Ziel | Status |
|---|---|---|
| Kontroll-Cockpit | Cash, offene Auftraege, Engpaesse, Termine, Verspaetungen und erwartete Einnahmen als handlungsorientierte Chefansicht. | `PROTECTED_BACKLOG` |
| Planbarkeit | Investitions-, Personal-, Fahrzeug- und Liquiditaetsentscheidungen mit Schwellenwerten, Prognosen und Gesamtkosten. | `PROTECTED_BACKLOG` |
| Auftragstimeline | Vollstaendiger Verlauf von Kontakt und Eingang bis Rechnung, Zahlung, Versand, Reklamation und Folgeauftrag. | `PROTECTED_BACKLOG` |
| Buchhaltung | Belege, Rechnungen, Zahlungen, DATEV/CSV/ZIP, UStVA, Audit und Senden-Button mit realen Daten. | `PROTECTED_BACKLOG` |
| Such-Gehirn | Suche ueber Kunden, Auftraege, Teile, Dokumente, Kommunikation und Geld mit Beziehungsart und belegten Quellen. | `PROTECTED_BACKLOG` |
| KI-Entscheidungen | Antworten mit Quellen, Links, Stichworten, Graphiken, Kostenfreigabe und nachvollziehbarer Unsicherheit. | `PROTECTED_BACKLOG` |
| Kundenkarte | Kundenwissen, Beziehungen, Freitext, Quellenqualitaet und optionale Deep-Research-Anreicherung. | `PROTECTED_BACKLOG` |
| Kommunikation | Telefonnotiz, E-Mail, Bilder, Rueckruf, Anfrage und Kundenkontext in einer Arbeitsflaeche. | `PROTECTED_BACKLOG` |
| Marketing | Aktion -> Reichweite -> Klick -> Anfrage -> Auftrag -> Umsatz/Marge mit Attribution und Lernschleife. | `PROTECTED_BACKLOG` |
| Lager/Energie/QS/KVP | Operative Bestaende, Energie, Qualitaet/QS, Reklamationen und Verbesserungen mit realen Daten. Baeder und Badwerte sind nach `D-ARCH-010` ausdruecklich kein Teil dieser Produktroadmap. | `PROTECTED_BACKLOG` |
| Performance | Fluessige Tablet-/Desktop-Nutzung, kein Jank, keine flackernden oder unkontrolliert schliessenden Overlays. | `PROTECTED_BACKLOG` |
| Modularer Kern | Tenant-Begriffe, Vertraege und Konfiguration zentral; keine Tiefimporte oder zweite Wahrheiten. | `PROTECTED_BACKLOG` |

## Frontend-Zieloberflaechen, Routen und Disposition (2026-08-27)

Owner-Provenienz der Lane: `KREILE_UEBERGABE_FRONTEND_UMSETZUNG_V1_2026-08-21.md`, SHA-256
`1CC0BDD969E1E5BB8F437542FCD8208FCDD2DF5B3B7FC8A0B18030AAC21B5C8C`, 4054 Bytes; ratifiziert als
Parallelpaket durch `KREILE_AUTONOMIE_MANDAT_2026-08-27.md`, SHA-256
`C244EC1C5F1FF1493420F4DCC44FEFCD8F0E76CEAEFD16853BE2A4E4C539364A`, 4904 Bytes; beides kanonisiert
in `missions/FRONTEND_IMPLEMENTATION_001.yml`. Die Owner-Dateien sind nur Herkunft, nach
Kanonisierung ist die Mission autoritativ.

Belegter Lane-Status: `PARALLEL_PLANNING_ACTIVE` / `IMPLEMENTATION_NOT_STARTED`; nur Parallelplanung
ist aktiv, die Disjunktheit der Implementierung ist erforderlich, aber nicht belegt. Phase 0 darf im
aktuellen dirty F1-Checkout read-only inventarisieren; `READ_ONLY` ist keine implizite
Repo-Schreibfreigabe. Jede Repo-Evidence- oder Missionsschreibung nach diesem Control-Plane-Abgleich
und jeder UI-Writer verlangt einen von den Projektregeln erlaubten sauberen kurzen Paketbranch vom
live aktuellen `main`, keinen laufenden F1-Writer oder F1-Gate, keinen zweiten aktiven Code-Writer
ueber Frontend und F1 hinweg und eine vorab berechnete exakte Produkt-Allowlist mit Schnittmenge 0
zur aktiven Order-to-Cash-Allowlist. Kein neuer Worktree und kein Clone ohne gesonderte Autoritaet;
ist die Trennung nicht beweisbar, gilt sequenzielle Arbeit: erst F1.4 korrigieren und mergen, danach
der Frontend-Writer.

Basisbindung: Der in der Mission gefuehrte SHA `f1c34b8f36c05912a094eb163950a24a9710df97` ist
ausschliesslich `handoff_snapshot_sha` (`HISTORICAL_HANDOFF_SNAPSHOT_ONLY`) und niemals
Implementierungsbasis. Fail-closed gilt
`implementation_base_sha = BIND_CURRENT_MAIN_AT_WRITER_START`; ohne Bindung an den live aktuellen
`origin/main` startet kein UI-Writer.

Statusachsen der Lane: `FUNCTIONAL_SLICE_PASS` `NOT_STARTED`, `DATA_TRUTH_PASS` `NOT_STARTED`,
`UI_REFERENCE_PASS` `NOT_STARTED`, `OWNER_UX_PASS` `OPEN_NOT_GRANTED` (nicht mergeblockierend),
`PRODUCT_READY` `false`. Screenshotmatrix exakt `390x844`, `768x1024`, `1024x768`, `1366x1024`,
`1440x900`. Die Ratifikation der vier Zielbildnamen ist eigene Metadatenwahrheit und ersetzt weder
gebundene Referenzassets noch `UI_REFERENCE_PASS` oder `OWNER_UX_PASS`.

| ID | Geschuetzter Wert | Status | Regel / naechste Aktion |
|---|---|---|---|
| `FE-SURFACE-ROLF-TAG-V8` | Rolf-Oberflaeche "Der Tag" V8 als einzige Chefflaeche. | `OWNER_RATIFIED_NOT_IMPLEMENTED` | Nur auf `/cockpit`; erst nach dem Phillip-Proofscreen bauen. |
| `FE-SURFACE-PHILLIP-WERKSTATT-V4` | Phillip-Oberflaeche "Werkstatt" V4 als erster Proofscreen. | `OWNER_RATIFIED_NOT_IMPLEMENTED` | Phase 1 der Frontend-Lane; exakt an `/warendurchlauf` als rollenbasierten Werkstatt-Einstieg gebunden, Stationsunterseiten nur darunter, keine neue Dashboardroute; ausschliesslich gegen reale F1.2/F1.3-Ports. Phase 0 liefert den exakten Route-Binding-Output; ohne bestandenes hartes `PHILLIP_ROUTE_BINDING_GATE` darf Phase 1 nicht schreiben. |
| `FE-SURFACE-AUFTRAGSKARTE-MACHART-V8` | Auftragskarte `MACHART_V8`. | `OWNER_RATIFIED_NOT_IMPLEMENTED` | Nach Rolf, gleiches Muster, keine zweite Datenwahrheit. |
| `FE-SURFACE-KUNDENKARTE-MACHART-V2` | Kundenkarte `MACHART_V2`. | `OWNER_RATIFIED_NOT_IMPLEMENTED` | Nach der Auftragskarte, gleiches Muster. |
| `FE-REFERENCE-ASSETS-001` | Die exakten ratifizierten Visual-Referenzdateien aller vier Oberflaechen. | `REFERENCE_ASSET_RECOVERY_REQUIRED` | Phase 0 muss sie wiederfinden, erhalten und per SHA-256 und Bytegroesse binden. Kein UI-Code ohne Bindung; bekannte HTML-Kandidaten werden nicht still zur Autoritaet erklaert; nichts nach Gefuehl gestalten. |
| `FE-ROUTE-DECISION-001` | Routenwahrheit: `/start` nur Login-/Sessiongrenze, `/cockpit` einzige Rolf-Flaeche "Der Tag", `/` spaeter serverseitiger Rollenrouter (admin/Rolf -> `/cockpit`; developer -> `/settings`; `werkstatt`, `meister`, `buero` -> `/warendurchlauf`), `/today` und `/kontrolle` ausschliesslich Kompatibilitaetsaliase auf `/`. | `ACTIVE` | Kein fuenftes Dashboard, Rolle `inhaber` bleibt verboten, kein Alias mit eigener Datenwahrheit. |
| `BAEDER_DISPOSITION_001` | Baeder-Tabellen, -Daten, -Migrationen und -Provenienz als rein technische Salvage. Baeder erscheinen nach `D-ARCH-010` ausschliesslich hier, nie als Produktroadmap oder `PROTECTED_BACKLOG`; keine Baeder-UI, kein spaeteres Baeder-Produktziel. | `PROTECTED_SALVAGE` | Separater Task, nicht Frontend Phase 1, noch nicht erledigt. Akzeptanz: alle sichtbaren `/baeder`-Links und Baeder-Bezeichnungen aus produktiver Navigation entfernt; `/baeder` Redirect nach `/warendurchlauf/galvanik`; `/performance/baeder-material` entfernt oder gleicher Redirect; kein erreichbarer toter oder gemockter Bath-Adapter; Galvanik bleibt exakt ein Step. Keine Remote- oder Datenloeschung. |
| `F1.5-CONTRACT-INTAKE` | F1.5-Bauvertrag `KREILE_F1_5_BAUVERTRAG_ZAHLUNGSEINGANG_WARENAUSGANG_V1_2026-08-21.md`, SHA-256 `5BCD70BFC2BD9D6A6DF06CF48D0D95C4A288DD5C6364BE2783954DDA1196BDE1`, 5592 Bytes. | `PENDING_OWNER_RATIFICATION` | Nur Provenienz und Status. Baustart ausschliesslich nach F1.4-Merge und neuer Owner- plus Orchestrator-Ratifikation/Startfreigabe; kein F1.5-Code. |
| `F1.4-CONTRACT-RECONCILIATION` | Abgleich des vollstaendig ratifizierten F1.4-Inhalts (19 Prozent only, `PAYMENT_TERM_DAYS` 14, `EVOLVE_PUBLIC_INVOICES` additiv, `R-JJJJ-NNNN` lueckenlos, Storno plus Neuausstellung, Stammdaten fail-closed, PDF-Download) mit gebundener Mission, Migration und Kandidat. | `RATIFIED_CONTRACT_DRIFT` | Klasse `FAIL_INTERNAL`; keine offene Ownerentscheidung. Aufloesung durch den zustaendigen F1-Writer, Details in `CURRENT_STATE.md`; keine stille Doku-Anpassung, keine erfundene Datei-Provenienz. Historische Nachweise PR `#68` / Head-Prefix `d61bb966` liegen vor der Korrektur und sind kein Mergebeleg. |

## Nutzer-Twins als Abnahmeregel

- **Rolf:** Desktop primaer; Kontrolle, Geld, Termine, Freigaben und Planbarkeit ohne KPI-Wand.
- **Phillip:** Tablet primaer; Produktion und Zahlen ohne zusaetzliche Buerarbeit.
- **Michael:** stark gefuehrte Aufnahme, Telefon, E-Mail, Eingang und Ausgang; geringe Technikroutine.

Keine Mission gilt als produktreif, wenn der relevante Nutzer-Twin den Kernweg nicht ohne versteckte Entwicklerkenntnisse ausfuehren kann.

## Historie (nicht kanonisch, Stand vor 2026-08-10)

Die folgenden Zeilen standen bis 2026-08-10 mit Status `ACTIVE` in den kanonischen Tabellen oben und
wurden an diesem Datum hierher verschoben, weil sie laut Nachtrag-Header (Dokumentanfang) durch F0
abgeschlossen bzw. ueberholt sind. Wortlaut unveraendert uebernommen (keine Loeschung gemaess
Registerregel); Status hier gilt NICHT als aktuell. Massgeblich fuer den heutigen Stand sind
ausschliesslich `docs/project/CURRENT_STATE.md` und `docs/evidence/f0/F0_FINAL_REPORT.md`.

| ID | Ziel | Status (Stand vor 2026-08-10) | Abhaengigkeit / Nachweis (Stand vor 2026-08-10) |
|---|---|---|---|
| `DB-TRUTH-001` | Production-Ledger und lokale Migrationsquelle versions- und hashgenau versoehnen. | `ACTIVE` | Recovery-Kandidat: Manifest fuer 96 angewandte Versionen, echter CI-Aufruf und zwei klar ausgewiesene neue Migrationen; Fresh-Replay bleibt offen. |
| `RLS-CONTRACT-001` | Rollen-/Tenant-/Grant-/Relationsvertrag und relationenweise Fail-closed-Policies. | `ACTIVE` | 2026-08-05 allen Tabellen/Views die Data-API-Grants entzogen (0 Grants verifiziert). Relationenweise RLS-/Policy-Matrix und tenant_isolation bleiben offen (architektonisch noch nicht sauber). |
| `LEDGER-CONSOLIDATION-001` | `execute_sql`-Aenderungen ledgerfaehig nachziehen; Fresh-Replay herstellen | `ACTIVE` | Voraussetzung fuer Migrationswahrheit |
