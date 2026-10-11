<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Regeln, Sperren und Konflikte

## 1. Sperren (vorbeugend)

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| Scope-Fingerprint muss Host, Environment, Partition und Capability entsprechen. | Cross-Tenant-/Cross-Host-Lesen und -Schreiben | Server/DB | CAND Scope-Vertrag | SPEZ |
| Actor, Session und Auth-Evidence müssen zum exakten Intent autorisiert sein. | unberechtigte Aufnahme, Offenlegung, Mutation oder Sendung | UI/Server | CAND; OE-2609-09 | SPEZ; Host fehlt |
| Aufnahme akzeptiert nur nichtleeren, validierten Inhalt und eindeutige Source-ID. | leere oder doppelte Fälle | Server/DB | CAND Validatoren/Idempotenz | SPEZ |
| E-Mail benötigt aktuelle UDI- und Dokumentoriginal-Evidenz einschließlich Absenderbefund. | Verarbeitung ungesicherter, veralteter oder gefälschter Mail | Server | CAND; D-AI-002 | SPEZ; Ports fehlen |
| Quarantäne oder Source-Evidence-Drift blockiert Review, Domain-Aktion und Send. | Aktion auf unsicherer Quelle | UI/Server | CAND Events/Security | SPEZ |
| Kein Kundenkontext ohne bestätigte Assignment-Revision. | falscher Kunde bei gleichen/ähnlichen Namen | UI/Server | DIGEST; CAND | SPEZ |
| Kandidatensatz- oder Assignment-Revision muss aktuell sein. | TOCTOU und stille Umzuordnung | Server/DB | CAND | SPEZ |
| Disclosure-Grant ist zweck-, kunden-, assignment-, intent- und zeitgebunden. | unzulässige Einsicht in fremde Fachdaten | Server | CAND Authorized Context | SPEZ |
| Analyse bleibt Vorschlag; Bestätigung bindet Evidence-Set und Zielrevision. | automatische Fachmutation durch KI/Regelwerk | UI/Server | D-AI-001/002; CAND | SPEZ |
| Owner-Command benötigt Idempotency-Key, Intent-Hash und menschliche Confirmation. | Doppelausführung und unbestätigte Mutation | Server/DB | ARCH; CAND | SPEZ |
| Erfolg wird erst nach dauerhaftem Receipt und fachlichem Readback angezeigt. | falsche Erfolgsmeldung | UI/Server/DB | D-RES-001; CAND | SPEZ |
| `OUTCOME_UNKNOWN` darf nicht blind erneut gesendet werden. | Doppelmutation/Doppelmail | Server/DB | CAND Recovery | SPEZ |
| Antwortempfänger muss dem attestierten Inbound-Sender und dessen Revision entsprechen. | Versand an manipulierte/freie Empfänger | UI/Server | CAND Outbound V1 | SPEZ |
| Draft-, Assignment-, Grant- und Recipient-Revision müssen bei Send identisch bestätigt sein. | Send nach zwischenzeitlicher Änderung | UI/Server | CAND | SPEZ |
| Event-MAC, Command-Intent-Key und Checkpoint-Key müssen aktiv sein. | nicht überprüfbare Persistenz | Server/DB | CAND | SPEZ; Runtime fehlt |
| Recovery erfordert Lease und begrenztes Budget. | parallele oder endlose Wiederholung | Server/DB | CAND Recovery | SPEZ; Worker fehlt |
| Projektionen enthalten keine Rohtexte/Anhänge und laufen per TTL/Revoke aus. | Datenleck in Suche/Startseite/Analyse | Server/DB | CAND Projections/Security | SPEZ; Verbraucher fehlen |
| Fristablauf erzeugt nur einen Lösch-/Anonymisierungsvorschlag; Ausführung braucht Admin-Freigabe und verändert das Microsoft-Postfach nicht. | stilles oder zu frühes Löschen von Geschäfts- und Kommunikationsdaten | UI/Server/DB | OE-2609-20 | SPEZ; Datenschutz-/Steuerberater-Gate offen |
| Hinten angestelltes Modul besitzt keine Route; graue Elemente sind nicht klickbar. | Fake- oder Schattenprodukt vor Adoption | UI | KANON; OE-2609-04/05 | GEPLANT |

## 2. Konflikte

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-M05-001 | Mehrere plausible Kunden | versionierter Kandidatensatz enthält mehrere belastbare Treffer | Rolf | Rolf-Startseite › oben: dringende Konflikte/Warnungen/Entscheidungen | richtigen Kunden manuell bestätigen oder Fall ungeklärt lassen | SPEZ; Anzeige FEHLT |
| K-M05-002 | Kein Kunde auffindbar | Kandidatensatz leer | Rolf | Rolf-Startseite › oben: dringende Konflikte/Warnungen/Entscheidungen | Kunde über G05 prüfen/anlegen und danach Zuordnung neu starten | SPEZ; Anzeige FEHLT |
| K-M05-003 | Mail/Anhang quarantänisiert, unvollständig oder Absenderbefund unsicher | UDI-/Original-Evidence liefert denial, partial, uncertainty oder security disposition | Rolf; Gregor nur bei technischer Ursache | Rolf-Startseite › oben: dringende Konflikte; bei Connectorfehler zusätzlich Gregor-Startseite › Systemzustand | Quelle nicht verwenden; fachlich verwerfen oder technische Evidenz reparieren und neu attestieren | SPEZ; Ports/Anzeige FEHLT |
| K-M05-004 | Kunde oder Evidenz ändert sich während Review/Aktion | Assignment-/Evidence-Revision weicht von Confirmation ab | Rolf | Rolf-Startseite › oben: dringende Konflikte/Warnungen/Entscheidungen | alten Vorschlag superseden, Kontext neu lesen und erneut bestätigen | SPEZ; Anzeige FEHLT |
| K-M05-005 | Antwortempfänger oder Draft änderte sich nach Prüfung | Recipient-Digest/Draft-Revision stimmt nicht | Rolf | Rolf-Startseite › oben: dringende Konflikte/Warnungen/Entscheidungen | Send blockieren, Entwurf neu prüfen und erneut bestätigen | SPEZ; Anzeige FEHLT |
| K-M05-006 | Sendestatus bleibt unbekannt oder Sent-Items-Readback passt nicht | Timeout, `OUTCOME_UNKNOWN`, `READBACK_MISMATCH`, orphaned artifact | Rolf; Gregor bei Connectorstörung | Rolf-Startseite › oben: dringende Konflikte; Gregor-Startseite › Systemzustand | zunächst Readback/Reconciliation, nie blind resend; danach fachlich klären | SPEZ; Graph/Anzeige FEHLT |
| K-M05-007 | Owner-Domain-Receipt fehlt oder Readback widerspricht | Action-State `OUTCOME_UNKNOWN`/`READBACK_REJECTED` | Rolf bei Kunde/KV; Phillip bei zugewiesener Auftragsaktion | zuständige Startseite › oben: dringende Konflikte/Warnungen/Entscheidungen | Owner-System lesen, Receipt korrelieren, fachlich bestätigen/verwerfen; kein zweiter Command ohne Recovery-Entscheid | SPEZ; Hostports FEHLT |
| K-M05-008 | Graph-Consent, Subscription, Delta, Supabase Cron oder Outbox ist gestört | Health-Port meldet stale/partial/denied; Ablauf oder 429-Budget | Gregor | Gregor-Startseite › Systemzustand | Consent/Subscription/Worker nach Owner-Gate reparieren, Delta-Reconciliation ausführen | GEPLANT; Runtime FEHLT |
| K-M05-009 | Persistenz, Scope, Schlüssel oder Eventkette ist nicht belegbar | Validator, MAC-/Checkpoint- oder Store-Readback schlägt fehl | Gregor | Gregor-Startseite › Systemzustand | Modul fail-closed halten, Kette/Restore prüfen; keine Daten als erfolgreich anzeigen | SPEZ; Runtime FEHLT |
| K-M05-010 | Projektionsverbraucher hat Sequence-Lücke, abgelaufene TTL oder widerrufenen Datensatz | Projection-Readback/Checkpoint | Gregor; fachlicher Fall bleibt Rolf/Phillip | Gregor-Startseite › Systemzustand | Revoke/Replay ab sicherem Checkpoint; Rohquelle bleibt unverändert | SPEZ; Verbraucher FEHLT |

## 3. Zuständigkeitsregel

Kommunikationsaufnahme, Kundenzuordnung, KV-Vorbereitung und Antwort bleiben bei Rolf. Eine bestätigte Auftragsaktion, die fachlich Phillip gehört, erscheint bei Phillip. Fachliche Konflikte stehen oben im Dringlichkeitsbereich der jeweiligen Startseite; der Tagesüberblick folgt darunter. Connector-, Persistenz-, Key- und Workerfehler erscheinen bei Gregor; ein technischer Fehler verschiebt die fachliche Verantwortung nicht. Die endgültige feingranulare Aktionsmatrix ist Q-M05-012.
