<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G05 Kunden — Sperren, Konflikte und Fehler

## Harte Sperren

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| Fehlende/ungültige Session | Lesen oder Schreiben von Kundendaten | UI + Server | Customer-Adap­ter/Actions, D-GOV-001 | gebaut/zu testen |
| Falscher Tenant | Cross-Tenant-Lesen/-Schreiben | Server + DB | tenant-gebundene Reads/Create-Migration | gebaut für belegte Wege |
| Fehlende `customers.read`-Berechtigung | Kundenliste und -karte | UI + Server | Denied-Zustände der Adapter | gebaut |
| Fehlende `customers.create`-Berechtigung | Kundenanlage | UI + Server | `createCustomerCommand` | gebaut |
| Fehlendes Receipt oder fehlgeschlagener Readback | Erfolgsmeldung nach Schreibvorgang | UI + Server | D-RES-001, Create-Flow | gebaut für Create |
| Abweichender Intent bei gleicher Idempotency-ID | versehentliche Wiederverwendung eines Commands | Server + DB | privates Receipt/Intent-Hash | gebaut für Create |
| Fehlende Straße/PLZ/Ort vor Rechnung | Rechnungsübergang | Server | D-UI-V5-003; Rechnungscommand/Migration | gebaut laut Codeprüfung |
| Fehlende Straße/PLZ/Ort vor Versand | Versandübergang | Server | D-UI-V5-003 | fehlt; darf nicht nur UI-Sperre sein |
| Kein sicherer Update-Command | Kundenstammdaten ändern | UI + Server | `customers.actions.ts` fail-closed | korrekt gesperrt; Q-G05-002 |
| Kein sicherer Phone-note-Command | Telefonnotiz speichern/ändern | UI + Server | `phoneNotes.actions.ts` = `NOT_AVAILABLE` | korrekt serverseitig gesperrt; UI-Stub muss ersetzt werden |
| Keine Admin-Freigabe/Legal-Hold ungeklärt | Löschung oder Anonymisierung | Server + DB | OE-2609-20 | Mechanik fehlt; bis dahin keinerlei Änderung |
| Ungeklärter Dokument-/Fotospeicher | Upload/Download | UI + Server | MODULKARTE, Q-G05-007 | „In Klärung“, nicht klickbar |

## Konflikte

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-G05-001 | Mehrere mögliche Kunden passen zur Erfassung | serverseitige Dublettenkandidaten mit Vergleichsfeldern | Rolf fachlich; Phillip bei technischer Fehlzuordnung | Bereich Konflikte → Kunden | bestehenden Kunden wählen oder bewusste Neuanlage gemäß Q-G05-001; nie Auto-Merge | In Klärung |
| K-G05-002 | Zwei gleichnamige Kunden oder mehrere passende Aufträge | mehr als ein realer Treffer, kein eindeutiger Schlüssel | Rolf | Bereich Konflikte → Zuordnung | Person wählt anhand Kundennummer/Ort und gegebenenfalls Auftrag-ID | Spezifiziert |
| K-G05-003 | Customer-Version änderte sich seit Öffnen | erwartete Version stimmt nicht mit Serverversion überein | Rolf fachlich; Phillip technisch | Bereich Konflikte → Kunden | aktuelle Fassung laden, Abweichungen zeigen, Änderung neu bestätigen | In Klärung |
| K-G05-004 | Receipt vorhanden, Readback fehlt oder widerspricht | Correlation/Customer-ID/Intent/Version stimmen nicht überein | Phillip; Rolf sieht Status | Bereich Konflikte → Technisch | mit derselben Idempotency-ID Status lesen, niemals blind erneut anlegen | Create gebaut; Anzeige offen |
| K-G05-005 | Telefonnotiz nennt widersprüchliche Kundendaten, Zahlungsangaben oder mehrere Prozesse | bestätigbare Fakten widersprechen Stammdaten/anderen bestätigten Fakten | Rolf; Phillip bei Pipelinefehler | Bereich Konflikte → Telefonnotizen | Rohquelle erhalten, Fakten einzeln korrigieren/bestätigen, keine automatische Stammdatenänderung | In Klärung |
| K-G05-006 | Aufbewahrungsvorschlag trifft Geschäftsdaten, Legal Hold oder noch prüfbaren Zeitraum | Fristen-/Klassifikationsprüfung nicht eindeutig | Rolf fachlich; Phillip technisch; Gregor nur wenn vom Owner als Datenschutz-/Steuerkontakt benannt | Bereich Konflikte → Datenschutz | Vorschlag blockieren, Grund dokumentieren, Admin-/Fachfreigabe einholen | In Klärung |
| K-G05-007 | Kundenanschrift fehlt beim Versand/Rechnungslauf | serverseitige Prüfung von Straße, PLZ, Ort | Rolf | Bereich Konflikte → Kunden/Auftrag | Kundenkarte öffnen, Anschrift nach sicherem Update-Vertrag ergänzen, Übergang erneut ausführen | Rechnung teilweise gebaut; Versand/Edit offen |

Gregor erhält keine pauschale Zuständigkeit: Die verbindliche Owner-Regel weist Konflikte standardmäßig Rolf beziehungsweise Phillip zu. Eine Gregor-Zuweisung ist erst zulässig, wenn der Owner seine konkrete Rolle festlegt.

## Fehlerklassen und Reaktion

| Fehlerklasse | Beispiel | Nutzerreaktion | Technische Regel |
|---|---|---|---|
| Validierung | ungültige E-Mail, fehlender Anzeigename | Feld markieren, Eingabe erhalten | kein Command/kein Receipt |
| Gesperrt | fehlendes Recht | neutraler Sperrtext, keine Details | fail-closed; keine sensitiven Daten im DOM/Log |
| Nicht gefunden | unbekannte Kunden-ID | „Kunde nicht vorhanden“ | kein Fallback auf anderen Tenant/Legacy-Store |
| Konflikt | veraltete Version, mehrdeutiger Treffer | Unterschiede/Kandidaten zeigen und Konflikt einstellen | keine Last-write-wins- oder Auto-Merge-Logik |
| Technischer Lesefehler | Read-Port nicht verfügbar | festgelegter Fehlertext, sichere Wiederholen-Aktion | keine Mock-/Cache-Wahrheit als Erfolg |
| Unbekannter Schreibausgang | Timeout nach Command | Status unbekannt, Wiederaufnahme anbieten | gleiche Idempotency-ID/Correlation, kein neuer Intent |
| Teilquelle fehlt | Orders-Projektion ausgefallen | Kundenstamm bleibt sichtbar, Auftragsbereich zeigt belegten Teilfehler | Teilfehler nicht als „keine Aufträge“ tarnen |
| Nicht angeschlossen | Telefonnotiz, Dokumente, Retention | nicht klickbar „In Klärung“ | kein Foundation-Stub, Alert oder leerer Route als Produktfunktion |

## Protokollierungsgrenze

Logs enthalten Correlation-ID, Modul, Operation, Tenant-Referenz und technische Fehlerklasse, aber keinen Telefon-Freitext, keine vollständigen Kontaktdaten und keine Secrets. Fachliche Konflikte verweisen auf Objekt-IDs; die eigentlichen Daten werden nur in berechtigten UI-Reads geladen.
