<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G04 · Regeln, Sperren und Konflikte

## 1. Sperren (vorbeugend)

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| S-G04-001 Tenant aus Session statt Request | Lesen/Schreiben fremder Aufträge | Server/DB | Produktwahrheit; F1-Commands | GEBAUT |
| S-G04-002 Capability je Person | unberechtigte Anzeige oder Mutation | UI/Server | OE-2609-09 | SPEZ; feste Rollenprüfung umzubauen |
| S-G04-003 Pflichtfelder/Datumsformat vor Annahme | unvollständigen Auftrag | UI/Server/DB | F1 Order Intake | GEBAUT |
| S-G04-004 Advisory-Lock + Unique-Constraint für Nummer | doppelte Auftragsnummer bei Parallelität | Server/DB | `src/lib/server/commands/orderIntakeCommand.ts`; RT-15 | GEBAUT |
| S-G04-005 erlaubte Übergangsmatrix | Überspringen/Rückwärtssetzen ohne Korrektur | UI/Server/DB | D-ARCH-010; F1.2 | GEBAUT |
| S-G04-006 `expectedVersion` | Lost Update bei parallelen Befehlen | Server/DB | F1.2/F1.3; D-RES-001 | GEBAUT |
| S-G04-007 Freeze bei `fertig` | stille Änderung historisierter Aufwände/Beträge | UI/Server/DB | D-F13-001 | GEBAUT |
| S-G04-008 G07-Warenausgangsgate | unerlaubte Abholung/Übergabe | UI/Server/DB | D-F15-001/-003 | GEBAUT |
| S-G04-009 genau ein Termin-Feld + Pflichtgrund pro Command | mehrdeutige oder nicht auditierbare Terminänderung | UI/Server/DB | OE-2609-13/-21 | SPEZ |
| S-G04-010 kein Terminwechsel nach `abgeholt` ohne Korrekturweg | rückwirkliche KPI-Manipulation | UI/Server | OE-2609-21; Auditprinzip | SPEZ |
| S-G04-011 keine Kalender-Doppelwahrheit | Divergenz zwischen Woche/Monat, Auftrag und Outlook | Server/Architektur | OE-2609-19; D-ARCH-011 konkretisiert | SPEZ |
| S-G04-012 kein KPI-Ersatzwert | erfundene Termintreue bei fehlenden Fakten | Server/UI | OE-2609-21; Produktwahrheit | SPEZ |
| S-G04-013 kein stilles Löschen/Anonymisieren | unbeabsichtigten Datenverlust | Server/Admin-UI | OE-2609-20 | SPEZ; OP-13 Gate |
| S-G04-014 keine Mutation bei `AUSGANG_UNGEKLÄRT` mit neuer ID | Doppelbuchung nach Netzfehler | UI/Server | D-RES-001 | SPEZ im Adapter-Umbau |

## 2. Konflikte

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-G04-001 | dieselbe `clientEventId` wird mit anderer Absicht benutzt | Intent-Hash des Receipts weicht ab | Gregor | Einstellungen › Technischer Konflikt | ursprüngliches Receipt prüfen; neue bewusste Handlung mit neuer ID | GEBAUT |
| K-G04-002 | Nummernvergabe/Receipt ist nach technischer Störung nicht eindeutig | Receipt-Readback fehlt oder stimmt nicht | Gregor | Einstellungen › Technischer Konflikt | Status über Korrelation prüfen; niemals blind wiederholen | SPEZ |
| K-G04-003 | Command basiert auf alter Auftragsversion | `expectedVersion != currentVersion` | handelnde Person; fachlich Rolf | Der Tag › Handlungsbedarf | aktuellen Auftrag neu laden, Unterschiede zeigen, Handlung neu bestätigen | GEBAUT für Kerncommands; Termincommand SPEZ |
| K-G04-004 | Fertigmeldung ohne gültigen historisierten Stundensatz | Freeze-Validierung schlägt fehl | Rolf | Der Tag › Handlungsbedarf | Satz/Mehrarbeit fachlich klären, dann erneut mit aktueller Version | GEBAUT |
| K-G04-005 | Vorkasse-Auftrag soll ohne bestätigte Zahlung raus | G07-Gate `blocked` | Rolf | Der Tag › Handlungsbedarf | Zahlung bestätigen oder Zahlungsmodus über eigenen auditierten Weg klären | GEBAUT |
| K-G04-006 | Werkstatt versucht ungültigen Lebenszyklusübergang | Übergang nicht exakt der nächste erlaubte | Phillip | Werkstatt › Heute sichern | Auftrag öffnen und zulässige nächste Handlung ausführen | GEBAUT |
| K-G04-007 | bestätigter Termin ist überschritten/nahe und Auftrag noch nicht fertig | Datum versus `Europe/Berlin`, Status und Fertig-Zeitpunkt | Phillip bei Ausführung; Rolf bei Kunden-/Terminentscheidung | Werkstatt › Heute sichern und Der Tag › Handlungsbedarf | fertigstellen oder Termin versioniert mit Grund ändern | SPEZ; keine erfundene Kapazität |
| K-G04-008 | Termin-/KPI-Fakten sind widersprüchlich oder mehrfach | `due_date`/Legacy-Abgleich, mehrere Finish/Pickup-Ereignisse, fehlende Version | Gregor | Einstellungen › Technischer Konflikt | read-only Diagnose, Datensatz einzeln freigeben/korrigieren; keine automatische Wahl | SPEZ |
| K-G04-009 | Abholtermin fehlt/ist überschritten, Auftrag ist fertig aber nicht abgeholt | `status=fertig` plus `pickup_due_date`/Abholereignis | Rolf | Der Tag › Handlungsbedarf | Abholtermin vereinbaren/ändern oder Abholung korrekt buchen | SPEZ; Eskalationsschwelle Q-G04-003 |
| K-G04-010 | externer Betriebs-/Abwesenheitstermin kollidiert mit Auftragstermin | M04 liefert read-only Überschneidung; G04-Termin bleibt Quelle | Rolf | Der Tag › Tagesübersicht | Auftragstermin prüfen/verschieben; externen Kalender nicht aus G04 ändern | GEPLANT nach M04-Gate |
| K-G04-011 | mehrere offene Aufträge teilen dieselbe Zieloberfläche | gleiche normalisierte `surface_requested`, geeigneter Status/Zeitraum | Phillip | Werkstatt › Bündeln heute | Vorschlag bestätigen oder ablehnen; keine automatische Status-/Terminänderung | GEPLANT |
| K-G04-012 | M04-Projektion eines bestätigten Termins ist ausstehend/fehlgeschlagen | Projection-Receipt fehlt; G04-Receipt vorhanden | Gregor | Einstellungen › Integrationen | idempotente Projektion über M04 prüfen/wiederholen; G04 nicht zurückrollen | GEPLANT |
| K-G04-013 | Lösch-/Anonymisierungsvorschlag betrifft prüfungsrelevante Unterlagen | Dokumentart/Frist/Audit-Hold | Gregor | Einstellungen › Aufbewahrung | Vorschlag ablehnen oder erst nach Admin- und Fachfreigabe ausführen | SPEZ; OP-13 |

## 3. Deterministische Terminregeln

- `überfällig`: bestätigter Termin liegt vor dem heutigen Kreile-Datum und es gibt keinen Fertig-Zeitpunkt.
- `heute fällig`: bestätigter Termin ist heute und Auftrag ist nicht fertig.
- `fristgerecht fertig`: `completed_date` liegt am oder vor dem Ende des zugesagten Kreile-Tages.
- `fristgerecht abgeholt`: Abholereignis liegt am oder vor dem Ende des zugesagten Kreile-Tages; ob die Kennzahl „fertig“ oder „abgeholt“ verwendet, entscheidet M02 transparent, nicht G04.
- Fehlender Termin, fehlender Zeitstempel oder ungeklärtes Storno ist `missing/unknown`, niemals automatisch pünktlich oder unpünktlich.
- Kapazitätswerte, Kollisionsgewichte und die Eskalationsschwelle für nicht abgeholte fertige Aufträge werden bis Q-G04-003/-004 nicht berechnet; die App zeigt nur belegte Datumsfakten.
