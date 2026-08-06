# Non-Loss Register

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

## Truth-, Quality- und Datenbankmissionen

| ID | Ziel | Status | Abhaengigkeit / Nachweis |
|---|---|---|---|
| `TRUTH-CLEANUP-001` | Eine kanonische Sicht auf `main`, Vercel, Supabase, PRs und Worktrees. | `DONE_VERIFIED` | PR 25; `main`, Vercel und Archive-Receipts gegengeprueft. |
| `QUALITY-RATCHET-001` | Globalen Lintbestand maschinenlesbar festhalten und jede Erhoehung blockieren. | `DONE_VERIFIED` | PR 26; Inline-Disable wirkungslos; geschuetzter Base-Judge besteht und `main-protection` verlangt jetzt `quality` und `ratchet`. |
| `LINT-DEBT-001` | 484 Fehler und 459 Warnungen in kleinen nichtfachlichen Wellen bis null abbauen. | `DONE_VERIFIED` | PR #31; ESLint 0/0 und Ratchet aktiv. |
| `DB-TRUTH-001` | Production-Ledger und lokale Migrationsquelle versions- und hashgenau versoehnen. | `ACTIVE` | Recovery-Kandidat: Manifest fuer 96 angewandte Versionen, echter CI-Aufruf und zwei klar ausgewiesene neue Migrationen; Fresh-Replay bleibt offen. |
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
| `RLS-CONTRACT-001` | Rollen-/Tenant-/Grant-/Relationsvertrag und relationenweise Fail-closed-Policies. | `ACTIVE` | 2026-08-05 allen Tabellen/Views die Data-API-Grants entzogen (0 Grants verifiziert). Relationenweise RLS-/Policy-Matrix und tenant_isolation bleiben offen (architektonisch noch nicht sauber). |
| `OFFLINE-SHELL-001` | Eine Service-Worker-Registrierung; App-Shell offline nutzbar. | `READY_AFTER_DEPENDENCY` | Nach Quality-/Identity-Vertrag. |
| `OFFLINE-48H-001` | 48 Stunden arbeitsfaehig mit einer Outbox, verlustfreier Altqueue-Drainage, Neustart, Konflikt- und Wiederholschutz. | `READY_AFTER_DEPENDENCY` | Benoetigt stabile Shell, Receipt-Writer/Readback sowie Inventar, idempotenten Import, Quarantaene, Nutzeranzeige und Rollback fuer bestehende Browserqueues. |
| `SEC-STORAGE-001` | MIME-, Groessen-, Pfad-, Tenant- und Storage-Limits fuer Fotos/Dokumente. | `READY_AFTER_DEPENDENCY` | Mit Capture-/Storage-Vertrag. |
| `BACKUP-RESTORE-001` | Daten, Dokumente, Fotos, Audit und Wiederherstellung nachweisbar sichern. | `PROTECTED_BACKLOG` | Vor Verkauf/Go-live vollstaendig testen. |

## Angewandte Production-Aenderungen und Fundament-Fixes (2026-08-06)

Additiv ergaenzt. Kein Eintrag oben wurde entfernt.

### Angewandte Production-Aenderungen ausserhalb Ledger (`APPLIED_NOT_IN_LEDGER`)

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
| `LEDGER-CONSOLIDATION-001` | `execute_sql`-Aenderungen ledgerfaehig nachziehen; Fresh-Replay herstellen | `ACTIVE` | Voraussetzung fuer Migrationswahrheit |
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
| Lager/Baeder/Energie/QS/KVP | Operative Bestaende, Badwerte, Energie, Qualitaet, Reklamationen und Verbesserungen mit realen Daten. | `PROTECTED_BACKLOG` |
| Performance | Fluessige Tablet-/Desktop-Nutzung, kein Jank, keine flackernden oder unkontrolliert schliessenden Overlays. | `PROTECTED_BACKLOG` |
| Modularer Kern | Tenant-Begriffe, Vertraege und Konfiguration zentral; keine Tiefimporte oder zweite Wahrheiten. | `PROTECTED_BACKLOG` |

## Nutzer-Twins als Abnahmeregel

- **Rolf:** Desktop primaer; Kontrolle, Geld, Termine, Freigaben und Planbarkeit ohne KPI-Wand.
- **Philipp:** Tablet primaer; Produktion und Zahlen ohne zusaetzliche Buerarbeit.
- **Michael:** stark gefuehrte Aufnahme, Telefon, E-Mail, Eingang und Ausgang; geringe Technikroutine.

Keine Mission gilt als produktreif, wenn der relevante Nutzer-Twin den Kernweg nicht ohne versteckte Entwicklerkenntnisse ausfuehren kann.
