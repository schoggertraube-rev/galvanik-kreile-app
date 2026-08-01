# Non-Loss Register

Stand: 2026-08-01

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
| `QUALITY-RATCHET-001` | Globalen Lintbestand maschinenlesbar festhalten und jede Erhoehung blockieren. | `ACTIVE` | Baseline 484/460; Inline-Disable wirkungslos; Base-Judge und GitHub-Enforcement werden gemeinsam abgenommen. |
| `LINT-DEBT-001` | 484 Fehler und 460 Warnungen in kleinen nichtfachlichen Wellen bis null abbauen. | `READY_AFTER_DEPENDENCY` | Start nach Ratchet; laeuft parallel und blockiert P0-/Auth-/DB-Fixes nicht. |
| `DB-TRUTH-001` | 79 lokale Dateien, 92 Production-Ledger-Eintraege und 1 Integration-Eintrag vorwaertsgerichtet versoehnen. | `BLOCKED` | 13 fehlende Quellen und gebrochener Fresh-Replay; keine Alt-Historie umschreiben. |
| `BRANCH-DISPOSITION-001` | Alte PRs unveraenderlich archivieren, inventarisieren und erst danach schliessen. | `DONE_VERIFIED` | PR 8/15/19/20 einzeln kommentiert und ungemergt geschlossen; Archivrefs, Receipts und Quellbranches erhalten. |
| `WINDOWS-WORKTREE-AUDIT-001` | Externen Windows-Checkout samt bekannter Diagnose- und nicht versionierter Arbeit inventarisieren und verlustfrei sauberstellen. | `UNKNOWN_EXTERNAL` | Nur im betroffenen Checkout ausfuehrbar; kein Reset/Stash/Delete. Erwartete Quelle: `diagnose/auth-session-permissions-2026-06-17@1621702` sowie Capture-/Foto-/Testarbeit. |

## Sicherheits- und Betriebsmissionen

| ID | Ziel | Status | Abhaengigkeit / Nachweis |
|---|---|---|---|
| `P0-AUTH-BYPASS-001` | Gefaelschte/alte Cookies und oeffentlichen Tablet-Testlogin aus Production entfernen. | `DONE_VERIFIED` | PR 23, Vercel Production und negative WebKit-/HTTP-Nachweise. |
| `P0-START-BOUNDARY-001` | Oeffentliche Auftragsausgabe und anonyme Reset-/Seed-Grenzen schliessen. | `DONE_VERIFIED` | PR 24, Production auf `b511318...`. |
| `W1-RUNTIME-RECEIPT-001` | Nullable Receipt-Spalten und partielle Unique-Indizes bereitstellen. | `DONE_VERIFIED` | Production/Integration/Postflight und PR 22; Runtime-Nutzung separat offen. |
| `LIVE-AUTH-001` | Abgelaufene Sitzung schliesst Erfassung, loescht App-Session und fuehrt nach `/start`. | `ACTIVE` | Cookie-/Routengrenzen gehaertet; realer Ablauf mit zuvor gueltiger, dann abgelaufener Sitzung noch vollstaendig zu bestaetigen. |
| `AUTH-IDENTITY-002` | Benutzerwechsel MK -> Admin -> MK ohne alte Rolle, Initialen, Rechte oder Sessionreste. | `ACTIVE` | `PermissionsProvider` friert Identity-Felder weiterhin aus dem ersten Layout-Mount ein. |
| `SEC-PIN-002` | PIN-Hashing-Grundlage, kein Default und zentrale Rollen-/Rotationsregeln. | `CANDIDATE_NO_MERGE` | Lokal `d7d2bd342221e4dbfc08be83f1864230dccd7341`; tree-identischer Remote-Checkpoint `dad42eb83e4dc4617291568631dea23f731febaa` auf `checkpoint/sec-pin-002-no-merge-20260801`; bewusst kein PR/Merge. |
| `SEC-PIN-002B` | Device-/Challenge-Grenze, verteilter Fehlversuchsschutz, Session-Widerruf, Bestandsrotation und finaler Plaintext-Ausschluss. | `BLOCKED` | Security-/Produktvertrag fuer vierstellige Werkstatt-PINs fehlt; baut auf `SEC-PIN-002`-Salvage auf. |
| `RLS-CONTRACT-001` | Rollen-/Tenant-/Grant-/Relationsvertrag und relationenweise Fail-closed-Policies. | `BLOCKED` | Security Advisor: 27 externe Errors, 31 Warnungen, 11 Infos; zuerst Zugriffsmatrix. |
| `OFFLINE-SHELL-001` | Eine Service-Worker-Registrierung; App-Shell offline nutzbar. | `READY_AFTER_DEPENDENCY` | Nach Quality-/Identity-Vertrag. |
| `OFFLINE-48H-001` | 48 Stunden arbeitsfaehig mit einer Outbox, verlustfreier Altqueue-Drainage, Neustart, Konflikt- und Wiederholschutz. | `READY_AFTER_DEPENDENCY` | Benoetigt stabile Shell, Receipt-Writer/Readback sowie Inventar, idempotenten Import, Quarantaene, Nutzeranzeige und Rollback fuer bestehende Browserqueues. |
| `SEC-STORAGE-001` | MIME-, Groessen-, Pfad-, Tenant- und Storage-Limits fuer Fotos/Dokumente. | `READY_AFTER_DEPENDENCY` | Mit Capture-/Storage-Vertrag. |
| `BACKUP-RESTORE-001` | Daten, Dokumente, Fotos, Audit und Wiederherstellung nachweisbar sichern. | `PROTECTED_BACKLOG` | Vor Verkauf/Go-live vollstaendig testen. |

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
| lokaler Truth-Worktree | isolierter Kandidat | nur kanonische Projekt-Dokumente |
| lokaler PIN-Worktree | `CANDIDATE_NO_MERGE` | lokaler SHA `d7d2bd3...` ist als tree-identischer Remote-Checkpoint `dad42eb...` gesichert; nicht mit Truth-/Lint-Arbeit vermischen |
| frueher genannter Windows-Dirty-Checkout | `UNKNOWN_EXTERNAL` | bekannte Hinweise: `diagnose/auth-session-permissions-2026-06-17@1621702`, bessere Offline-/Service-Worker-Arbeit sowie nicht versionierte Capture-/Foto-/Testarbeit; read-only inventarisieren, dann gezielt committen; kein Reset/Stash/Delete |

## Operativer Kern und Erfassung

| ID | Ziel | Status | Abhaengigkeit / Nachweis |
|---|---|---|---|
| `APP-STRUCTURE-001` | Zielgrenzen und Import-/Ownership-Vertrag fuer den realen Vertikalschnitt festlegen. | `READY_AFTER_DEPENDENCY` | Truth-, Quality-, DB- und `AUTH-IDENTITY-002`-Vertrag. |
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
