<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 05 — Regeln, Sperren und Konflikte

## Grundregeln

1. Eine **Sperre** verhindert eine unzulässige Mutation unmittelbar und serverseitig; UI-Erklärungen sind zusätzliche Bedienhilfe.
2. Ein **Konflikt** ist eine read-only Projektion realer Besitzerfakten, die eine zuständige Person zu einer sicheren Fachaktion führt.
3. Ein **Hinweis** wie WIP, Abwesenheit oder Bündelprüfung darf nicht als Konflikt oder Kapazitätsurteil überzeichnet werden.
4. Kein Konflikt erhält eine eigene Erledigt-Wahrheit. Er ist gelöst, wenn der Besitzer-Read-Port seine Ursache nicht mehr liefert.
5. Alle Zeitvergleiche erfolgen in `Europe/Berlin`; Kalenderintervalle verwenden explizite Zeitzonen.

## Gebaute und erforderliche Sperren

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| Tenant-/Actor-/Capability-Prüfung | fremde oder unautorisierte Reads/Writes | Server + DB/RLS | F0; `authorization`; RLS-Härtung | GEBAUT, erhalten |
| Exakte Command-Eingabe | zusätzliche/fehlende Felder und implizite Defaults | Server | F1-Commands | GEBAUT |
| `expectedVersion` | Lost Update und konkurrierende Zustandsüberschreibung | Server + atomare DB-Bedingung | `orderStationCommand.ts` und weitere Commands | GEBAUT |
| `clientEventId`/Intent-Bindung | Doppelbuchung und abweichenden Replay | Server + Unique/Receipt | F1-Commands/Receipt-Views | GEBAUT |
| Erlaubter Lifecycle-Übergang | Überspringen/rückwärts Schreiben ohne Korrekturpfad | Server | `orderLifecycleContract.ts`, `orderStationCommand.ts` | GEBAUT |
| Ein Command je Übergang | parallele Schreibwege und UI-Direktmutation | Server/Architektur | F1-Evidenz | GEBAUT; Importgraph erhalten |
| Evidenz-/Objektgraph | Foto/Beleg am falschen Auftrag, Item oder Tenant | Server + DB-FK/View-Integrität | W4/F1.3 | GEBAUT |
| Payment-/Goods-out-Gate | Ausgabe ohne erlaubten Status/Zahlungsstand | Server + DB-View | `recordGoodsOutCommand.ts`, Payment Summary | GEBAUT |
| Immutable Events/Receipts | nachträgliches Umschreiben/Löschen der Historie | DB | UPDATE/DELETE/TRUNCATE-Trigger | GEBAUT |
| Assignment-Rolle/-Tenant/-Version | Zuweisung an fremden/inaktiven Nutzer oder veralteten Auftrag | Server + DB | `orderTaskAssignmentCommand.ts`, State/View | GEBAUT |
| Receipt vor UI-Erfolg | falsche Erfolgsmeldung bei unklarem Ausgang | UI + Serververtrag | D-RES-001 | TEILWEISE; E2E offen |
| Terminänderungs-Command | stilles Überschreiben der Kundenzusage | Server + DB-Event | A-G09-016; geplanter `rescheduleOrderCommand` | FEHLT |
| Kalender-Provider-Gate | Fake-/Fallback-Termine und unbestätigte Projektion | Server/Provider | D-ARCH-011; Provider-Matrix | GESPERRT bis M365-E2E |
| Kapazitäts-Gate | erfundene Auslastung/Engpasswarnung | Contract + UI | Red-Team RT-03; Performance-UX | SPEZIFIZIERT, Daten fehlen |
| Snooze-Frist-Gate | Wegdrücken hinter die sichtbare Frist | UI + künftiger Servercommand | V5; Q-G09-004 | NICHT GEBAUT, Aktion ausblenden |

## Konflikt- und Hinweiskatalog

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-G09-001 | Veraltete Auftragsversion | Command liefert `CONFLICT`; Readback zeigt höhere Version | auslösender Rolf oder Phillip; Gregor: — | zunächst inline; Startseite nur bei weiter offenem Besitzerfall | Aktuellen Zustand lesen und gültige Aktion bewusst neu auslösen | GEBAUTER Command, Feed offen |
| K-G09-002 | Command-Ausgang nach Netzabbruch unklar | Kein bestätigtes Receipt/Readback für gesendete `clientEventId` | auslösender Rolf oder Phillip; Gregor: — | jeweiliger Rollenbereich, falls nicht inline klärbar | Receipt-Suche und Readback; kein Blind-Retry | FEHLT querschnittlich |
| K-G09-003 | Unzulässiger Stationsübergang | Ist-Status passt nicht zum angeforderten Übergang | Phillip; Gregor: — | „Heute sichern“, sofern reale Werkstattaktion offen bleibt | Richtige nächste Station/Aktion aus Orders-Readback | Command GEBAUT |
| K-G09-004 | Erforderliches Foto/Evidenz fehlt oder ist nicht integer | Evidence-/Station-Port meldet fehlend/`UNAVAILABLE` | Phillip; Gregor: — | „Heute sichern“ | Evidenz über sicheren Upload-/Finalize-Weg ergänzen und Readback | Teilweise GEBAUT |
| K-G09-005 | Preis, Kundenfreigabe oder widersprüchliche Geschäftsdaten blockieren | Besitzer-Port liefert expliziten belegten Blocker | Rolf; Gregor: — | „Das braucht dich“ | Entscheidung im Besitzer-Modul, Receipt/Readback | Regel belegt, einzelne Ports offen |
| K-G09-006 | Warenausgang wegen Zahlung/Rechnung/Status gesperrt | Payment Summary oder Goods-out-Command liefert expliziten Grund | Rolf; Phillip sieht nur inline; Gregor: — | Rolf „Das braucht dich“ plus Phillip inline am Auftrag | Zahlungs-/Modus-/Rechnungsfall im Owner-Modul lösen, dann neuer Readback | GEBAUTER Gate, Feed offen |
| K-G09-007 | Auftrag ist überfällig oder heute fällig und noch nicht fertig | Reales `due_date` plus Lifecycle-Endzustand, Kalendertag Berlin | Phillip für physische Ausführung; bei Kundenentscheidung Rolf; Gregor: — | Phillip „Heute sichern“, gegebenenfalls Rolf „Das braucht dich“ ohne Duplikat | Ausführung oder versionierte Terminentscheidung; Readback | Daten vorhanden, Ableitung umzubauen |
| K-G09-008 | Termin fehlt/ist ungültig oder muss als Kundenzusage verschoben werden | `due_date` null/invalid beziehungsweise bewusster Änderungsweg | Rolf; Gregor: — | „Das braucht dich“ | Termin klären; geplanter Terminänderungs-Command plus Readback | FEHLT |
| K-G09-009 | Auftragstermin überlappt Abwesenheit/Betriebstermin derselben Person/Ressource | Intervallüberschneidung über Orders-Assignment + `CalendarPort` | Rolf; Gregor: — | „Das braucht dich“; Phillip erst nach neuer Aufgabe | Termin/Zuweisung fachlich ändern, M365 projizieren, reconciliieren | M365 BLOCKIERT |
| K-G09-010 | Kalenderquelle nicht verbunden/fehlerhaft | `CalendarPort` Health nicht `synced` oder Read fehlgeschlagen | Rolf als Terminverantwortlicher; Phillip sieht Status; Gregor: — | grauer Status, nicht als Businesskonflikt zählen | M04-Verbindung beziehungsweise erneut laden; nie Fallback | PENDING |
| K-G09-011 | Aktuelle Aufträge in einer Station | Exakter Zähler aus Orders-Read-Port | Phillip; Gregor: — | „Heute sichern“/Werkstatt als **WIP-Hinweis** | Keine Auflösung nötig; Navigation zur Liste | FEHLT, kein Konflikt |
| K-G09-012 | Mindestens zwei offene Teile nennen dieselbe Oberfläche, z. B. Zink | Gleiches normalisiertes nichtleeres `surface_requested` | Phillip; Gregor: — | „Heute sichern“ als **Bündelprüfung** | Gefilterte Aufträge öffnen und manuell prüfen; kein Auto-Write | FEHLT |
| K-G09-013 | Belegte Kundendublette oder widersprüchliche Zuordnung | Nur expliziter Customers-Port; keine bloße Fuzzy-Namensähnlichkeit | Rolf; Gregor: — | „Das braucht dich“ | Manuelle Prüfung; niemals automatische Fusion | Port/Regel offen |
| K-G09-014 | Phillip gibt auftragsbezogene Aufgabe zurück | `ORDER_TASK_HANDED_BACK_V1`/Assignment-Readback aktiv=false | Rolf; Gregor: — | „Das braucht dich“ | Rolf entscheidet oder weist erneut zu | Command GEBAUT, UI offen |
| K-G09-015 | Auftragsnummer kollidiert bei Parallelannahme | Unique-/Command-Konflikt mit vollständig zurückgerolltem Intake | Rolf als Intake-/Kundenfall; Gregor: — | zunächst inline; Startseite nur wenn Aufnahme wiederaufzunehmen ist | Neuen atomaren Intakeversuch nach Readback starten | RT-15 Prüfung offen |
| K-G09-016 | Kapazität soll bewertet werden, aber Bedarf/Verfügbarkeit/Grenzwerte fehlen | Pflichtfelder des Kapazitätsmodells existieren nicht | Rolf und Phillip sehen nur „In Klärung“; Gregor: — | graue Fläche, nicht im Konfliktzähler | Q-G09-001 durch PL/Owner mit echten Quellen klären | BEWUSST DEAKTIVIERT |
| K-G09-017 | Aufschub/Delegation für nicht auftragsbezogenen Konflikt gewünscht | Kein persistenter Besitzervertrag vorhanden | Rolf; Gregor: — | Aktion nicht rendern | Q-G09-004; bis dahin direkt im Fachvorgang lösen | BEWUSST DEAKTIVIERT |

## Termin- und Intervallregeln

- `überfällig`: `due_date < heute` und Auftrag nicht im belegten Endzustand.
- `heute fällig`: `due_date = heute`; bei noch nicht fertigem Auftrag dringend für Phillip, bei nötiger externer Neuzusage Entscheidung für Rolf.
- `morgen fällig`: Prioritätshinweis, **keine** Prognose „gefährdet“ ohne Laufzeit-/Kapazitätsmodell.
- Kalenderintervalle überschneiden sich genau dann, wenn `order.start < blocker.end && blocker.start < order.end`; reine Randberührung ist kein Konflikt.
- Ohne Person-/Ressourcenmatch keine Konfliktaussage. Allgemeine Abwesenheiten bleiben Information.
- Serien, Zeitzonen, Delta-Sync und Reconciliation gehören zum `CalendarPort`, nicht zu G09.

## Disposition des alten Warning-Regelregisters

Der Ist-Code enthält **18** aktive Konstanten aus einer nichtkanonischen Archiv-Spec. Keine davon darf durch bloße Verdrahtung Produktwahrheit werden.

| Legacy-Code | Disposition für G09 | Begründung/Owner |
|---|---|---|
| `LOGIN_BRUTEFORCE` | entfällt aus G09; bestehende Auth-/Rate-Limit-Sperre erhalten | G01/Fundament besitzt Auth |
| `SESSION_INACTIVE_30M` | entfällt aus G09 | Sessionmodell G01; 30 Minuten nicht neu freigegeben |
| `STATION_PING_PONG` | In Klärung, nicht aktivieren | Schwelle `>3` nur Archiv, keine Owner-Freigabe |
| `STATION_MISSING_PHOTO` | durch belegten Evidence-/Stations-Port ersetzen | Fachfakt relevant, Legacy-Expression nicht authoritative |
| `STATION_BLOCKED_RELEASE` | durch konkreten Besitzer-Gate ersetzen oder nicht zeigen | generische „Kundenfreigabe“ nicht als einheitlicher Vertrag belegt |
| `PAYMENT_OVERDUE_14D` | nur aus echter Rechnungsfälligkeit im Accounting-Port neu ableiten | Archivschwelle nicht pauschal aktivieren |
| `PAYMENT_OVERDUE_30D` | nur aus echtem Mahnvertrag im Accounting-Port; derzeit nicht G09-wirksam | Mahnlogik nicht in diesem Dossier entschieden |
| `PAYMENT_CUSTOMER_RISK` | deaktiviert | Schwelle `>3 Rechnungen` unbelegt |
| `DATA_REWORK_DOUBLED` | entfällt aus G09 | Analyse/KPI später; Vergleichslogik unbelegt |
| `DATA_DOCUMENTATION_DROP` | deaktiviert | 80-%-Schwelle unbelegt |
| `BACKUP_STALE_36H` | entfällt aus Businessfeed | Backup/Restore eigenes Betriebs-Gate; 36 h nur Archiv |
| `PRINTER_JOB_FAILED` | entfällt aus G09 | Hardwareprovider nicht real; Altpfad simuliert |
| `DEVICE_OFFLINE_24H` | entfällt aus G09 | Geräte-/24-h-Vertrag unbelegt |
| `CUSTOMER_OPEN_OVER_LIMIT` | deaktiviert | Kundenlimit-Feld/Schwelle nicht kanonisch belegt |
| `CUSTOMER_NO_CONTACT_DETAILS` | optionaler Customers-Datenhinweis, nicht dringender G09-Konflikt | kein Startseitenbedarf aus Owner-Quelle |
| `UPLOAD_MISSING_CATEGORY` | entfällt aus G09 | kein kanonischer G09-Uploadvertrag |
| `DSR_DEADLINE_NEAR` | entfällt aus G09 | Datenschutzprozess eigenes Modul/Gate; 5 Tage nur Archiv |
| `SEARCH_NO_RESULT_RATE_HIGH` | entfällt aus G09 | Suchtelemetrie/KPI nicht Businesskonflikt |

Die Komponenten `WarningBell` und `WarningDrawer`, `engine.ts`, `store.ts`, `ruleRegistry.ts` und die Typen werden nicht reaktiviert. T-13 darf sie erst nach Importgraph-/Linkprüfung kontrolliert entfernen; dieser Dossierauftrag löscht nichts.
