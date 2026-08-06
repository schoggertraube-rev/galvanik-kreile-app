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
- `DONE_MERGED`: PR gemergt und Migrationen applied, aber noch nicht vollstaendig E2E-nachgewiesen.
- `UNKNOWN_EXTERNAL`: aus dem aktuellen Arbeitsbereich nicht belegbar.

## Truth-, Quality- und Datenbankmissionen

| ID | Ziel | Status | Abhaengigkeit / Nachweis |
|---|---|---|---|
| `TRUTH-CLEANUP-001` | Eine kanonische Sicht auf `main`, Vercel, Supabase, PRs und Worktrees. | `DONE_VERIFIED` | PR 25; `main`, Vercel und Archive-Receipts gegengeprueft. |
| `QUALITY-RATCHET-001` | Globalen Lintbestand maschinenlesbar festhalten und jede Erhoehung blockieren. | `DONE_VERIFIED` | PR 26; Inline-Disable wirkungslos; geschuetzter Base-Judge besteht und `main-protection` verlangt jetzt `quality` und `ratchet`. |
| `LINT-DEBT-001` | 484 Fehler und 459 Warnungen in kleinen nichtfachlichen Wellen bis null abbauen. | `DONE_VERIFIED` | PR #31; ESLint 0/0 und Ratchet aktiv. |
| `DB-TRUTH-001` | Production-Ledger und lokale Migrationsquelle versions- und hashgenau versoehnen. | `DONE_VERIFIED` | PR #35; Manifest fuer 96 angewandte Versionen, CI-Aufruf, Ledger-Vertrag. 2 Recovery-Migrationen via execute_sql applied (nicht im Supabase-Ledger; bei Fresh-Replay nachfuehren). |
| `BRANCH-DISPOSITION-001` | Alte PRs unveraenderlich archivieren, inventarisieren und erst danach schliessen. | `DONE_VERIFIED` | PR 8/15/19/20 einzeln kommentiert und ungemergt geschlossen; Archivrefs, Receipts und Quellbranches erhalten. |
| `WINDOWS-WORKTREE-AUDIT-001` | Externen Windows-Checkout samt bekannter Diagnose- und nicht versionierter Arbeit inventarisieren und verlustfrei sauberstellen. | `UNKNOWN_EXTERNAL` | Nur im betroffenen Checkout ausfuehrbar; kein Reset/Stash/Delete. |

## Sicherheits- und Betriebsmissionen

| ID | Ziel | Status | Abhaengigkeit / Nachweis |
|---|---|---|---|
| `P0-AUTH-BYPASS-001` | Gefaelschte/alte Cookies und oeffentlichen Tablet-Testlogin aus Production entfernen. | `DONE_VERIFIED` | PR 23, Vercel Production und negative WebKit-/HTTP-Nachweise. |
| `P0-START-BOUNDARY-001` | Oeffentliche Auftragsausgabe und anonyme Reset-/Seed-Grenzen schliessen. | `DONE_VERIFIED` | PR 24, Production auf `b511318...`. |
| `W1-RUNTIME-RECEIPT-001` | Nullable Receipt-Spalten und partielle Unique-Indizes bereitstellen. | `DONE_VERIFIED` | Production/Integration/Postflight und PR 22; Runtime-Nutzung separat offen. |
| `LIVE-AUTH-001` | Abgelaufene Sitzung schliesst Erfassung, loescht App-Session und fuehrt nach `/start`. | `ACTIVE` | Cookie-/Routengrenzen gehaertet; realer Ablauf noch vollstaendig zu bestaetigen. |
| `AUTH-IDENTITY-002` | Benutzerwechsel MK -> Admin -> MK ohne alte Rolle, Initialen, Rechte oder Sessionreste. | `DONE_VERIFIED` | PR #33; atomarer Auth-State und keine localStorage-Identitaet. |
| `SEC-PIN-002` | PIN-Hashing-Grundlage, kein Default und zentrale Rollen-/Rotationsregeln. | `DONE_VERIFIED` | PR #37; Recovery-Migration applied: 6/6 bcrypt, 0 legacy. |
| `SEC-PIN-002B` | Device-/Challenge-Grenze, serialisierter Fehlversuchsschutz, Session-Widerruf, Bestandsrotation und finaler Plaintext-Ausschluss. | `PARTIAL_IMPROVED` | PR #39 schliesst Race, Rotation, Bestandsmigration und Session-Widerruf. Production jetzt 6/6 bcrypt. Device-Challenge bleibt Produktentscheidung. |
| `RLS-CONTRACT-001` | Rollen-/Tenant-/Grant-/Relationsvertrag und relationenweise Fail-closed-Policies. | `ACTIVE` | ALLE Tabellen + Views: 0 anon/authenticated Grants (verifiziert 2026-08-05). Relationenweise Policy-Matrix offen. supabase_admin Defaults: akzeptiertes Restrisiko (alle Tabellen gehoeren postgres). |
| `OFFLINE-SHELL-001` | Eine Service-Worker-Registrierung; App-Shell offline nutzbar. | `READY_AFTER_DEPENDENCY` | Damage Containment fuer 4 konkurrierende Offline-Systeme done. Konsolidierung nach Quality-/Identity-Vertrag. |
| `OFFLINE-48H-001` | 48 Stunden arbeitsfaehig mit einer Outbox, verlustfreier Altqueue-Drainage, Neustart, Konflikt- und Wiederholschutz. | `READY_AFTER_DEPENDENCY` | Benoetigt stabile Shell, Receipt-Writer/Readback sowie Inventar, idempotenten Import, Quarantaene, Nutzeranzeige und Rollback fuer bestehende Browserqueues. |
| `SEC-STORAGE-001` | MIME-, Groessen-, Pfad-, Tenant- und Storage-Limits fuer Fotos/Dokumente. | `READY_AFTER_DEPENDENCY` | Mit Capture-/Storage-Vertrag. |
| `BACKUP-RESTORE-001` | Daten, Dokumente, Fotos, Audit und Wiederherstellung nachweisbar sichern. | `PROTECTED_BACKLOG` | Vor Verkauf/Go-live vollstaendig testen. |

## Offene PRs und Branch-Disposition

| Quelle | Status | Geschuetzter Wert | Verbot / naechste Aktion |
|---|---|---|---|
| PR `#8` | `PROTECTED_SALVAGE` | Identity-Switch-/Permissions-Ideen und Tests | Archiv `archive/pr-8-auth-identity-002-007b85b`; nicht mergen |
| PR `#15` | `PROTECTED_SALVAGE` | Capture/Auth/Tenant-, Test- und CI-Arbeit aus 48 Commits | Archiv `archive/pr-15-capture-auth-tenant-f0090ab`; kein Sammelmerge |
| PR `#19` | `PROTECTED_SALVAGE` | Security-, Tenant-, RLS-, Schema- und Testkandidaten | Archiv `archive/pr-19-foundation-security-338a13c`; nicht mergen |
| PR `#20` | `PROTECTED_SALVAGE` | Fail-closed-Adapter, Tests und Dispositionsmaterial | Archiv `archive/pr-20-foundation-consolidation-2589fde`; nicht mergen |
| geschlossener PR `#21` | `PROTECTED_SALVAGE` | Nachweis, dass die lokale Historie keinen Fresh-Replay besteht | nicht wiedereroeffnen |
| uebrige Remote-Branches | `PROTECTED_SALVAGE` | moegliche Einzelideen und historische Nachweise | keine pauschale Loeschung |

Ein geschlossener PR verliert seinen Branch nicht automatisch.

## Lokale und externe Arbeitsstaende

| Quelle | Status | Regel |
|---|---|---|
| lokaler `main`-Worktree | sauber | exakt `origin/main`; keine Mission direkt darin entwickeln |
| `codex/foundation-gap-fill-001` | `DONE_MERGED` | PR #39 merged. Recovery-Migrationen applied auf Production. |
| 2 Migrationen via execute_sql | `APPLIED_NOT_IN_LEDGER` | Grant-Revoke + Legacy-PIN-Hash via Supabase MCP execute_sql applied. Nicht im Supabase-Migrations-Ledger. Bei naechstem Fresh-Replay als Ledger-Eintraege nachfuehren. |
| frueher genannter Windows-Dirty-Checkout | `UNKNOWN_EXTERNAL` | read-only inventarisieren, dann gezielt committen; kein Reset/Stash/Delete |

## Operativer Kern und Erfassung

| ID | Ziel | Status | Abhaengigkeit / Nachweis |
|---|---|---|---|
| `APP-STRUCTURE-001` | Zielgrenzen und Import-/Ownership-Vertrag fuer den realen Vertikalschnitt festlegen. | `PARTIAL` | PR #36 brachte Ownership-/Importregeln; verbleibender Vertrag folgt ohne Big-Bang-Umsortierung. |
| `OPERATIVE-SLICE-001` | Kunde -> Auftrag -> Behaelter/QR -> Teil -> Arbeitsaktion -> Today -> Receipt -> Readback. | `BLOCKED` | Strukturvertrag, PIN-/Rollen-/RLS-Grenze und W1-Runtime-Writer fehlen. |
| `CAPTURE-ORIGINAL-001` | Eine kanonische Originalerfassung vor OCR und Zuordnung. | `READY_AFTER_DEPENDENCY` | Identitaet und Offline-Shell stabil. |
| `OFFLINE-CAPTURE-001` | Foto/Datei offline sichern, Neustart ueberstehen und genau einmal synchronisieren. | `READY_AFTER_DEPENDENCY` | `CAPTURE-ORIGINAL-001`, `OFFLINE-48H-001`. |
| `APP-0001D-A` | Echte Kamera und Datei-Upload als getrennte, verstaendliche Wege. | `READY_AFTER_DEPENDENCY` | Salvage aus `feature/capture-auth-tenant`. |
| `APP-0001D-B` | OCR, privater Storage, `item_photos`, Signed URLs und Orphan-Cleanup. | `BLOCKED` | Remote-Schema, Migrationsquelle, Drizzle und RLS zuerst abgleichen. |
| `OCR-REVIEW-001` | Konfidenz je Feld; nur unsichere Felder pruefen. | `READY_AFTER_DEPENDENCY` | OCR-Vertrag. |
| `CAPTURE-ASSIGN-001` | Kunde, Auftrag und Teilgruppe sicher vorschlagen/zuordnen. | `READY_AFTER_DEPENDENCY` | Original- und OCR-Vertrag. |
| `LABEL-QR-001` | QR-/Etiketterkennung als schneller Zuordnungsweg. | `READY_AFTER_DEPENDENCY` | Teil des operativen Vertikalschnitts. |
| `WARENEINGANG-EVENT-001` | Aufnahme erzeugt nachvollziehbares Wareneingangsereignis. | `READY_AFTER_DEPENDENCY` | Zuordnung und Receipt-Vertrag stehen. |
| `FIRST-PRODUCTION-CARD-001` | Erster vollstaendiger Eingang bis sichtbarer Produktionskarte. | `READY_AFTER_DEPENDENCY` | Wareneingangsereignis, Timeline und Today-Read-Model. |
| `FIRST-WARENEINGANG-E2E-001` | Original bis Produktionskarte und Reload belegen. | `READY_AFTER_DEPENDENCY` | Operativer Slice, Capture-/Storage- und Offline-Vertrag muessen bestanden sein. |
| `AI-PHOTO-001` | Optionale Teile-/Zustandsanalyse mit Quellen, Konfidenz und Review. | `DEFERRED_WITH_REASON` | Erst nach belastbarer Original-, Storage- und Zuordnungsbasis. |
| `APP-PHOTO-002` | Wiederholungs- und Nacharbeitsfotos ohne Duplikat-/Verlustpfad. | `READY_AFTER_DEPENDENCY` | `APP-0001D-B`. |

## Modularitaet und Wiederverwendung

| ID | Ziel | Status | Abhaengigkeit / Nachweis |
|---|---|---|---|
| `MODULAR-CORE-001` | Neue Module ueber Ports/Provider, Typen, Props und Konfiguration entkoppeln. | `ACTIVE` | Gilt fuer jede neue Mission. |
| `LEDGER-CORE-PREP-001` | Buchhaltungs-/OCR-Inventar und spaetere Paketgrenze dokumentieren. | `READY_AFTER_DEPENDENCY` | Nach operativem Kern; keine Extraktion. |
| `LEDGER-CORE-EXTRACT-001` | Stabilen Buchhaltungskern einmal kontrolliert herausloesen. | `DEFERRED_WITH_REASON` | Erst nach produktiver Buchhaltung. |
| `SHARED-MODULE-CATALOG-001` | Capture, Suche, Timeline, Offline-Outbox und Analyse katalogisieren. | `PROTECTED_BACKLOG` | Keine vorschnelle Generalisierung. |

## Geschuetzte Produktroadmap

| Bereich | Geschuetztes Ziel | Status |
|---|---|---|
| Kontroll-Cockpit | Cash, offene Auftraege, Engpaesse, Termine als handlungsorientierte Chefansicht. | `PROTECTED_BACKLOG` |
| Planbarkeit | Investitions-, Personal-, Fahrzeug- und Liquiditaetsentscheidungen. | `PROTECTED_BACKLOG` |
| Auftragstimeline | Vollstaendiger Verlauf von Kontakt bis Folgeauftrag. | `PROTECTED_BACKLOG` |
| Buchhaltung | Belege, Rechnungen, Zahlungen, DATEV/CSV/ZIP, UStVA, Audit. | `PROTECTED_BACKLOG` |
| Such-Gehirn | Suche ueber Kunden, Auftraege, Teile, Dokumente, Kommunikation und Geld. | `PROTECTED_BACKLOG` |
| KI-Entscheidungen | Antworten mit Quellen, Links, Konfidenz und Review. | `PROTECTED_BACKLOG` |
| Kundenkarte | Kundenwissen, Beziehungen und optionale Deep-Research-Anreicherung. | `PROTECTED_BACKLOG` |
| Kommunikation | Telefonnotiz, E-Mail, Bilder, Rueckruf, Anfrage und Kundenkontext. | `PROTECTED_BACKLOG` |
| Marketing | Aktion -> Reichweite -> Klick -> Anfrage -> Auftrag -> Umsatz/Marge. | `PROTECTED_BACKLOG` |
| Lager/Baeder/Energie/QS/KVP | Operative Bestaende, Badwerte, Energie, Qualitaet, Reklamationen. | `PROTECTED_BACKLOG` |
| Performance | Fluessige Tablet-/Desktop-Nutzung, kein Jank. | `PROTECTED_BACKLOG` |
| Modularer Kern | Tenant-Begriffe, Vertraege und Konfiguration zentral. | `PROTECTED_BACKLOG` |

## Nutzer-Twins als Abnahmeregel

- **Rolf:** Desktop primaer; Kontrolle, Geld, Termine, Freigaben und Planbarkeit.
- **Philipp:** Tablet primaer; Produktion und Zahlen ohne zusaetzliche Buerarbeit.
- **Michael:** stark gefuehrte Aufnahme, Telefon, E-Mail, Eingang und Ausgang.

Keine Mission gilt als produktreif, wenn der relevante Nutzer-Twin den Kernweg nicht ohne versteckte Entwicklerkenntnisse ausfuehren kann.
