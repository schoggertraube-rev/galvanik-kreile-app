<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M01_BUCHHALTUNG — Regeln, Sperren und Konflikte

## Sperren (vorbeugend)

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| Keine M01-Route vor Transfergate | Nutzung eines nicht adoptierten Moduls | UI/Server | OE-2609-04/05; Anleitung §6 | SPEZ |
| Nicht klickbar „In Klärung“ bei offener Strukturentscheidung | Vorwegnahme von D1–D4, Provider- oder Storageentscheidungen | UI/Server | OE-2609-04; RT P0-D1–D4 | SPEZ |
| Nicht klickbar „In Aufbau“ bei entschiedener, nicht angebundener Capability | Fakefunktion und verdeckter Fallback | UI/Server | Anleitung §6 | SPEZ |
| Tenant-/Actor-/Capability-Prüfung pro Read und Command | Fremdtenant- und unberechtigten Zugriff | Server/DB | C2 HostAdapter; OE-2609-09 | GEBAUT im C2; Host/DB FEHLT |
| Expected-Version-Prüfung | Lost Update und Stale Write | Server/DB | C2 CommandEnvelope | GEBAUT im C2; Host/DB FEHLT |
| Intent-/Idempotency-Prüfung | Doppelmutation nach Doppelclick oder Antwortverlust | Server/DB | D-RES-001; C2 | GEBAUT im C2; Host/DB FEHLT |
| Read-before-retry bei `unknown` | unkontrollierten zweiten Write | UI/Server | D-RES-001; C2 Recovery | GEBAUT im C2; Host FEHLT |
| Integer-Cent-/EUR-Validierung | Rundungsfehler, Overflow und unzulässige Währung | Server | RT §11.3; C2 | GEBAUT im C2 |
| Fail-closed Cancel-State | Storno bezahlter, teilbezahlter oder inkonsistenter Rechnung | Server | RT A2; `origin/main` 4faa2ba9 | GEBAUT im Servercommand |
| Atomare DB-Precondition für Rechnungsstorno | Umgehung der Bezahlt-Sperre durch Race oder Direktweg | DB | A-M01-009; Red-Team RT-14 | FEHLT → Q-M01-014 |
| Payment-Reversal-Capability nicht exportieren | improvisiertes Löschen/Überschreiben einer Zahlung | UI/Server | RT P0-D1; DIG #32 | FEHLT → Q-M01-001 |
| Originalbelege unveränderlich halten | Verlust der Nachweis- und E-Rechnungswahrheit | Server/Storage | DIG #3/#14; OE-2609-20 | GEPLANT |
| Nur Vorschläge aus OCR/Parser/Bankmatching | stille KI-/Provider-Fachmutation | Server | D-AI-001/002; DIG #14 | GEPLANT |
| Menschliche Bestätigung vor Bankzuordnung, Mahnung und Fachrouting | falsche oder unbemerkte Buchung/Zustellung | UI/Server | DIG #3; RT Slices B/C/E | GEPLANT |
| Provider-SDK nur hinter Adapter | zweite Paymentwahrheit und Core-Kopplung | Build/Server | OE-2609-12; D-ARCH-012 | SPEZ |
| Legacy-Denylist | Dual Write und Schattenmodell | Build/Server | RT §§5/9; C2 Denylist | GEBAUT im C2; Produktprüfung FEHLT |
| Kein Mock-/Leer-/Null-Erfolgsfallback | vorgetäuschte Produktfähigkeit | Build/Server/UI | AGENTS.md; DIG #31 | SPEZ |
| Retention-Hold und Adminfreigabe | zu frühes oder stilles Löschen/Anonymisieren | Server/DB/Storage | OE-2609-20; AO §147; HGB §257 | GEPLANT |
| Export erst nach Steuerberater- und Hash-Readback | fachlich falsches oder verlorenes Übergabeartefakt | UI/Server/Storage | RT D4/Slice F | FEHLT → Q-M01-004/013 |
| Stale-Kontostand-Warnung ohne Schätzwert | falsche Liquiditätssicherheit | Server/UI | OE-2609-24 | GEPLANT → Q-M01-010 |
| Gehaltsdaten nur aggregiert und capability-gebunden | Offenlegung personenbezogener Einzelwerte | Server/DB | DIG #14; OE-2609-24 | GEPLANT → Q-M01-012 |

## Konflikte

Finanzielle/administrative Konflikte liegen bei Rolf. Konflikte bei Übergabe oder Kassieren liegen bei Phillip. Gregor erhält keinen neuen M01-Konflikttyp; fachliche Werkstattabweichungen bleiben im zuständigen Grundstammmodul. Alle Einträge erscheinen oben auf der jeweiligen Startseite im Bereich **„Handlungsbedarf“** und verlinken erst nach Adoption auf den echten Fall.

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-M01-001 | Storno bei bestätigter, möglicher oder inkonsistenter Zahlung | Cancel-State oder atomare Precondition ist nicht eindeutig `unpaid` | Rolf | Rolf › Handlungsbedarf | Zahlung/Inkonsistenz prüfen; gegebenenfalls getrennte Korrektur | GEBAUT Server / FEHLT DB+Anzeige |
| K-M01-002 | fehlende Capability, Fremdtenant oder personenbezogene Sperre | serverseitiger Auth-Kontext lehnt Read/Command ab | Rolf | Rolf › Handlungsbedarf, nur falls administrativ lösbar | Admin prüft Personenrecht/Tenant; niemals Clientoverride | GEPLANT |
| K-M01-003 | Read ist stale, partial, unavailable oder unknown | ReadEnvelope-Metadaten | Rolf | Rolf › Handlungsbedarf | Quelle aktualisieren oder Coverage ausdrücklich akzeptieren; kein Write aus unsicherem Read | GEBAUT im C2 / Anzeige FEHLT |
| K-M01-004 | Receipt, Aggregat und erwarteter Betrag/Version widersprechen sich | unabhängiger Readbackvergleich | Rolf | Rolf › Handlungsbedarf | Vorgang über Receipt-Recovery klären; bis dahin sperren | GEBAUT im C2 / Host FEHLT |
| K-M01-005 | Doppel-, Über- oder paralleles Payment-Reversal/Refund | Originalreceipt, Restbetrag, Idempotency und Version | Rolf | Rolf › Handlungsbedarf | aktuellen Stand lesen; zulässigen Rest neu bestätigen | FEHLT → Q-M01-001 |
| K-M01-006 | Refund- oder Mahnzustellung endet `unknown` | Providerantwort fehlt, Receipt ist nicht eindeutig | Rolf | Rolf › Handlungsbedarf | Providerreceipt/Reconciliation lesen; nicht blind wiederholen | GEPLANT |
| K-M01-007 | Bankbewegung ist doppelt, fremde Währung oder beschädigt | tenantgebundener Dedupe-Key, Währungs-/Dateivalidierung | Rolf | Rolf › Handlungsbedarf | Importquelle prüfen; Bewegung nicht löschen | GEPLANT |
| K-M01-008 | Bankbewegung passt auf mehrere/keine Rechnung oder kollidiert mit Zahlung | Matching liefert keine eindeutige, aktuelle OP-Basis | Rolf | Rolf › Handlungsbedarf | menschlich zuordnen oder offen lassen; falsche Zuordnung additiv reversieren | GEPLANT |
| K-M01-009 | Terminal offline, Betrag abweichend oder Ausgang unbekannt | Adapterstatus plus Receipt-Abgleich | Phillip | Phillip › Handlungsbedarf | Vorgang am Terminal/Adapter abgleichen; erst dann erneut kassieren | GEPLANT → Q-M01-005 |
| K-M01-010 | Dokument/E-Rechnung ist ungültig, doppelt oder XML und Sichtdarstellung widersprechen sich | Hash, Profilvalidator und Parservergleich | Rolf | Rolf › Handlungsbedarf | Original in Quarantäne prüfen; korrigiertes Dokument neu empfangen | GEPLANT |
| K-M01-011 | Dokumentrouting/OCR ist mehrdeutig oder unvollständig | fehlende Pflichtfelder, niedrige Konfidenz oder mehrere Ziele | Rolf | Rolf › Handlungsbedarf | Vorschlag manuell korrigieren/bestätigen; Original bleibt | GEPLANT |
| K-M01-012 | Kostenfakt hat kein Original, kollidiert mit Duplikat oder Steuerklassifikation | Originalhash, Dedupe- und Fachvalidierung | Rolf | Rolf › Handlungsbedarf | Quellbeleg/Fachklassifikation prüfen; keine Legacybuchung | FEHLT → Q-M01-002 |
| K-M01-013 | Mahnung wäre nach Zahlung/Storno, an falschen Empfänger oder doppelt | erneuter OP-/Lifecycle-/Empfänger-/Idempotency-Read vor Sendung | Rolf | Rolf › Handlungsbedarf | Entwurf stoppen, Stammdaten/Fall prüfen, dann neu freigeben | FEHLT → Q-M01-003 |
| K-M01-014 | Export hat Teilabdeckung, ungültiges Format oder Hashmismatch | Coverage-, Format- und Hashprüfung | Rolf | Rolf › Handlungsbedarf | Lauf als fehlgeschlagen behalten; Ursache beheben; neuen Lauf erzeugen | FEHLT → Q-M01-004/013 |
| K-M01-015 | Kontostand ist älter als freigegebene Schwelle | Vergleich `asOf` mit konfigurierter Schwelle | Rolf | Rolf › Handlungsbedarf | neuen manuellen/bestätigten Stand erfassen | GEPLANT → Q-M01-010 |
| K-M01-016 | Liquiditätsfakten sind unvollständig oder Gehaltsaggregat ist denied | Coverage je Quelle | Rolf | Rolf › Handlungsbedarf | fehlende Quelle nachpflegen/freigeben; M02 zeigt keine sichere Prognose | GEPLANT |
| K-M01-017 | Retentionfrist ist unklar oder Ablaufhemmung aktiv | Dokumentklasse, Fristbeginn und Hold-Status | Rolf | Rolf › Handlungsbedarf | fachlich/steuerlich klären; bis dahin keine Freigabe zur Anonymisierung | GEPLANT → Q-M01-007 |

## Zuständigkeits- und Auflösungsregeln

- Konflikte sind Handlungsbedarf, keine zweite Aufgaben- oder Analysedatenbank. Der Quellfall bleibt im owning Modul.
- Auflösung erfolgt ausschließlich über den verlinkten Fachcommand und dessen Receipt/Readback; „als erledigt markieren“ ohne Fachwirkung ist unzulässig.
- Rolf kann einen Übergabe-/Kassierkonflikt nicht still übernehmen; Zuständigkeitswechsel braucht einen auditierten Grund. Dasselbe gilt umgekehrt.
- Bei `unknown` bleibt der Konflikt offen. Ein Timeout ist weder Erfolg noch sichere Nullmutation.
- Ein Konflikt darf erst verschwinden, wenn ein frischer Read seine Ursache widerlegt oder ein bestätigtes Receipt die Auflösung belegt.
