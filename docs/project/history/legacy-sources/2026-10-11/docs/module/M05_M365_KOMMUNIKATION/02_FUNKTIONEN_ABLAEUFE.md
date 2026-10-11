<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Funktionen und Abläufe

Für alle Funktionen gilt: Standardmäßig dürfen alle Personen alles; der Admin kann je Person sperren oder erweitern. Die folgenden UI-Texte sind erst in Designphase 1b festzulegen. Wo keine wörtliche Quelle existiert, steht deshalb bewusst `FEHLT → Q-M05-003`.

### F-M05-001 — Manuelle Telefonnotiz aufnehmen

**Auslöser:** Eine Person startet den Telefonnotiz-Einstieg in der Kundenkarte oder über den freigegebenen Grundstamm-Schnelleinstieg.
**Personen:** Alle; Admin-Regel aus G01 gilt.
**Schritte:** 1. Person erfasst Text oder ein bereits erzeugtes Sprachtranskript. 2. Host erzeugt sichere Content-Referenz und Source-Evidence. 3. M05 eröffnet einen Fall und hängt den Eintrag an. 4. Kundenabgleich startet; bei Mehrdeutigkeit wählt die Person den Kunden. 5. Person prüft und akzeptiert oder verwirft den Eintrag.
**Ergebnis + Receipt/Readback:** Durable M05-Receipt und Readback der Fallrevision; eine Kunden-Notiz entsteht nur über bestätigten Customers-Command mit dessen Receipt/Readback.
**Fehlerfälle:** Leerer Inhalt, unsichere Transkription, ähnliche Namen, Scope-/Key-/Store-Fehler.
**Sperren/Konflikte:** K-M05-001, K-M05-002, K-M05-004, K-M05-009.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Erfasster Text, Capture-Art, Zeit, bestätigter Kunde und Prüfschritt | FEHLT → Q-M05-003 | DIGEST; CAND |
| lädt | Speichern/Abgleich läuft, Eingabe nicht doppelt absendbar | FEHLT → Q-M05-003 | RT-22 |
| leer | Leere Notiz mit Erfassungsaktion | FEHLT → Q-M05-003 | RT-16/22 |
| Fehler | Fail-closed-Fehler mit Wiederaufnahme statt Datenverlust | FEHLT → Q-M05-003 | CAND Recovery |
| gesperrt | Funktion durch Admin oder fehlende sichere Laufzeit blockiert | FEHLT → Q-M05-003 | OE-2609-09 |
| In Klärung | Gedämpfter, nicht klickbarer Einstieg | „In Klärung“ | OE-2609-04; Anleitung §6 |
| In Aufbau | Gedämpfter, nicht klickbarer Einstieg | „In Aufbau“ | OE-2609-04; Anleitung §6 |

### F-M05-002 — Eingehende E-Mail sicher aufnehmen

**Auslöser:** Der Graph-Adapter meldet eine Nachricht aus dem Hauptposteingang des lizenzierten benannten Kreile-Büropostfachs; Delta-Abgleich kann denselben Eingang idempotent nachliefern.
**Personen:** Systemaufnahme; Sicht und Bearbeitung durch berechtigte Personen.
**Schritte:** 1. Die Vercel-Benachrichtigungsroute schreibt den Hinweis ohne Fachverarbeitung in die Kreile-DB-Warteschlange. 2. Supabase Cron startet den Worker; Delta-Abgleich sichert Nachricht und Anhänge als Originale. 3. UDI attestiert Quelle, Version, Absenderbefund, Coverage, Unsicherheit und Quarantäne. 4. M05 validiert alle Claims. 5. Es eröffnet idempotent einen Fall und speichert nur Referenzen/Evidenz. 6. Projektionsjobs werden über die Outbox ausgelöst.
**Ergebnis + Receipt/Readback:** Durable Receipt und Readback der aufgenommenen Revision; Provider-Acknowledgement allein ist kein fachlicher Erfolg.
**Fehlerfälle:** Fehlendes Original, unvollständige UDI-Evidenz, Spoofing, Quarantäne, abgelaufene Subscription, Delta-/Throttle-Fehler.
**Sperren/Konflikte:** K-M05-003, K-M05-008, K-M05-009.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Absender, Betreff, Eingangszeit, Original-/Anhangsnachweise, Sicherheitsstatus | FEHLT → Q-M05-003 | RUNTIME; CAND |
| lädt | Evidenz und Original werden geprüft | FEHLT → Q-M05-003 | RT-22 |
| leer | Kein neuer bearbeitbarer Kommunikationsfall | FEHLT → Q-M05-003 | RT-22 |
| Fehler | Aufnahme fehlgeschlagen; kein Fall wird behauptet | FEHLT → Q-M05-003 | CAND |
| gesperrt | Quarantäne, ungültige Evidenz oder fehlende Berechtigung | FEHLT → Q-M05-003 | CAND Security |
| In Klärung | Connector-Element ohne Aktion | „In Klärung“ | OE-2609-04 |
| In Aufbau | Connector-Element ohne Aktion | „In Aufbau“ | OE-2609-04 |

### F-M05-003 — Kundenkandidaten prüfen und Zuordnung bestätigen

**Auslöser:** Ein offener Kommunikationsfall benötigt Kundenkontext.
**Personen:** Alle berechtigten Personen; fachlich primär Rolf.
**Schritte:** 1. Kern sendet gehashte/abgeleitete Match-Hinweise an CustomerMatchReadPort. 2. Host liefert versionierten Kandidatensatz. 3. Person prüft Namen und Kontext. 4. Person bestätigt einen Kunden oder lässt den Fall ungeklärt. 5. Korrektur erzeugt eine neue Assignment-Revision und superseded alte abhängige Vorschläge.
**Ergebnis + Receipt/Readback:** Durable Zuordnungs-Receipt und Readback der exakten Assignment-Revision.
**Fehlerfälle:** Kein Treffer, mehrere ähnliche Kunden, veralteter Kandidatensatz, parallele Korrektur.
**Sperren/Konflikte:** K-M05-001, K-M05-002, K-M05-004.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Versionierte Kandidaten, Match-Hinweise, Unsicherheit und Auswahl | FEHLT → Q-M05-003 | CAND; DIGEST |
| lädt | Kandidaten werden gesucht | FEHLT → Q-M05-003 | RT-22 |
| leer | Kein Kunde gefunden; Zuordnung bleibt offen | FEHLT → Q-M05-003 | DIGEST |
| Fehler | Kandidaten konnten nicht sicher gelesen werden | FEHLT → Q-M05-003 | CAND |
| gesperrt | Veralteter Kandidatensatz oder fehlende Rechte | FEHLT → Q-M05-003 | CAND |
| In Klärung | Zuordnungselement ohne Aktion | „In Klärung“ | OE-2609-04 |
| In Aufbau | Zuordnungselement ohne Aktion | „In Aufbau“ | OE-2609-04 |

### F-M05-004 — Inhalt prüfen und Routing vorbereiten

**Auslöser:** Ein Fall ist einem Kunden zugeordnet und soll als Kunde, Auftrag, KV, Dokument, Wiedervorlage oder Terminverschiebung weiterbearbeitet werden.
**Personen:** Alle berechtigten Personen; Zuständigkeit richtet sich nach der Zielaktion.
**Schritte:** 1. Zweckgebundener Disclosure-Grant wird angefordert. 2. Host liest autorisierten Kontext aus Customers, Orders, Quotes, Accounting und Dokument-Original. 3. Analyse liefert begründete Vorschläge mit Evidenz und Unsicherheit. 4. Person prüft einzelne Einträge. 5. Person bestätigt, verwirft oder superseded das Routing. 6. Eine Terminverschiebung wird nur als bestätigter Vorschlag an den Termin im Auftragsobjekt und an die zuständige Startseite übergeben; es gibt keinen Sprung in eine Kalenderfläche.
**Ergebnis + Receipt/Readback:** M05-Receipt für Review und Routing-Entscheidung; noch keine fremde Domain-Mutation.
**Fehlerfälle:** Grant verweigert/abgelaufen, Teilabdeckung, Evidence-Drift, falscher Kundenkontext.
**Sperren/Konflikte:** K-M05-003, K-M05-004, K-M05-009.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Quellenbeleg, autorisierter Kontext, Vorschlag, Unsicherheit, Ziel | FEHLT → Q-M05-003 | CAND |
| lädt | Kontext und Vorschläge werden geladen | FEHLT → Q-M05-003 | RT-22 |
| leer | Keine belastbare Handlung vorgeschlagen | FEHLT → Q-M05-003 | REG D-AI-002 |
| Fehler | Kontext/Analyse nicht sicher verfügbar | FEHLT → Q-M05-003 | CAND |
| gesperrt | Disclosure verweigert oder Evidenz driftet | FEHLT → Q-M05-003 | CAND |
| In Klärung | Routingelement ohne Aktion | „In Klärung“ | OE-2609-04 |
| In Aufbau | Routingelement ohne Aktion | „In Aufbau“ | OE-2609-04 |

### F-M05-005 — Bestätigte Fachaktion ausführen

**Auslöser:** Eine Person bestätigt einen geprüften Vorschlag für Customers, Orders oder Quotes.
**Personen:** Alle mit G01-Berechtigung; Rolf für Büro-/KV-Aktionen, Phillip für ihm zugewiesene Auftragsaktionen.
**Schritte:** 1. M05 bindet Command an Assignment-, Evidence- und Confirmation-Revision. 2. Intent-Hash und Idempotency-Key werden erzeugt. 3. Owner-Port nimmt Command an. 4. Receipt wird dauerhaft gespeichert. 5. Readback bestätigt oder widerlegt das Ergebnis. 6. Bei unbekanntem Ausgang startet kontrollierte Recovery.
**Ergebnis + Receipt/Readback:** Exaktes Owner-Receipt plus Readback; erst dann gilt die Aktion als bestätigt.
**Fehlerfälle:** Autorisierung widerrufen, Revision veraltet, Receipt fehlt, Readback-Mismatch, Timeout.
**Sperren/Konflikte:** K-M05-004, K-M05-007, K-M05-009.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Aktion, Zielmodul, Bestätigung, Receipt und Readback-Status | FEHLT → Q-M05-003 | CAND |
| lädt | Bestätigte Aktion wird genau einmal verarbeitet | FEHLT → Q-M05-003 | CAND |
| leer | Keine bestätigte Fachaktion vorhanden | FEHLT → Q-M05-003 | RT-22 |
| Fehler | Readback weist Ergebnis zurück | FEHLT → Q-M05-003 | CAND |
| gesperrt | Version, Rechte oder Evidenz erlauben keine Übergabe | FEHLT → Q-M05-003 | CAND |
| In Klärung | Aktionsknopf ohne Route | „In Klärung“ | OE-2609-04 |
| In Aufbau | Aktionsknopf ohne Route | „In Aufbau“ | OE-2609-04 |

### F-M05-006 — Antwortentwurf prüfen und senden

**Auslöser:** Eine zugeordnete, attestierte Eingangsmail soll beantwortet werden.
**Personen:** Alle mit Sendeberechtigung; Admin kann individuell sperren.
**Schritte:** 1. Disclosure-Kontext und attestierter Absender werden erneut gelesen. 2. Entwurf entsteht als sichere Revision. 3. Person prüft Empfänger, Betreff, Text und Anlagen. 4. Exakte Revision und Empfänger-Digest werden bestätigt. 5. Host erstellt/sendete über Graph. 6. Receipt und Sent-Items-Readback bestimmen den Status.
**Ergebnis + Receipt/Readback:** Transport-Receipt plus Sent-Items-Readback; `202 Accepted` bleibt pending.
**Fehlerfälle:** Empfängerdrift, Draft superseded, 429, Timeout, Readback-Mismatch, verwaistes Artefakt.
**Sperren/Konflikte:** K-M05-005, K-M05-006, K-M05-008, K-M05-009.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Bezug, attestierter Empfänger, Betreff, Text, Anlagen, Revision | FEHLT → Q-M05-003 | V5 E-Mail-Modal; CAND |
| lädt | Versand/Readback läuft; kein erneutes Senden | FEHLT → Q-M05-003 | CAND |
| leer | Noch kein Antwortentwurf | FEHLT → Q-M05-003 | RT-22 |
| Fehler | Versand nicht bestätigt oder Readback abweichend | FEHLT → Q-M05-003 | CAND |
| gesperrt | Bestätigung, Recipient-Attestation oder Senderecht fehlt | FEHLT → Q-M05-003 | CAND |
| In Klärung | Antwortaktion ohne Sendefunktion | „In Klärung“ | OE-2609-04 |
| In Aufbau | Antwortaktion ohne Sendefunktion | „In Aufbau“ | OE-2609-04 |

### F-M05-007 — Projektionen für Suche, Startseite und Analyse liefern

**Auslöser:** Ein Fall oder seine Sichtbarkeit ändert sich.
**Personen:** Lesende Personen gemäß G01; Verbraucher sind G02, G08 und M02.
**Schritte:** 1. Kern erzeugt sequenzierte Upsert-/Revoke-Feeds. 2. Feed enthält nur erlaubte Metadaten/Referenzen. 3. Host prüft Scope und TTL. 4. Verbraucher materialisieren ihre eigene Projektion. 5. Dringende Kommunikationskonflikte werden oben im Dringlichkeitsbereich der zuständigen Startseite angezeigt; der Tagesüberblick darunter bleibt Grundstammwahrheit. 6. Widerruf/Expiry entfernt Sichtbarkeit.
**Ergebnis + Receipt/Readback:** Projektions-Checkpoint/Readback pro Verbraucher; keine Rohinhalte im Feed.
**Fehlerfälle:** Sequence-Lücke, TTL abgelaufen, Verbraucher offline, Scope-Mismatch.
**Sperren/Konflikte:** K-M05-009, K-M05-010.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Fallreferenz, Status, Zuständigkeit, Zeit und sichere Kurzmetadaten | FEHLT → Q-M05-003 | CAND Projection-Vertrag |
| lädt | Projektion wird aktualisiert | FEHLT → Q-M05-003 | RT-22 |
| leer | Keine Kommunikationsfälle im erlaubten Ausschnitt | FEHLT → Q-M05-003 | RT-22 |
| Fehler | Projektion ist unvollständig/veraltet gekennzeichnet | FEHLT → Q-M05-003 | CAND |
| gesperrt | Projektion widerrufen, abgelaufen oder nicht autorisiert | FEHLT → Q-M05-003 | CAND |
| In Klärung | Projektionsbereich ohne Link | „In Klärung“ | OE-2609-04 |
| In Aufbau | Projektionsbereich ohne Link | „In Aufbau“ | OE-2609-04 |

### F-M05-008 — Unklaren Ausgang wiederaufnehmen und Fall abschließen

**Auslöser:** Domain- oder Transportaktion bleibt unbekannt, Evidenz driftet, oder ein geprüfter Fall kann abgeschlossen werden.
**Personen:** Zuständige Fachperson; Gregor nur bei technischem Connector-/Laufzeitproblem.
**Schritte:** 1. Supabase Cron übernimmt einen deduplizierten Job aus der Outbox; der Recovery-Worker erwirbt ein Lease. 2. Er liest Receipt, Readback und aktuelle Evidenz, ohne blind zu wiederholen. 3. Er bestätigt, verwirft, eskaliert oder plant begrenzt neu. 4. Person löst den fachlichen Konflikt. 5. Der Fall wird resolved oder bei neuer Quelle wiedereröffnet. 6. Nach Ablauf der dokumentartspezifischen Frist wird nur ein Lösch-/Anonymisierungsvorschlag erzeugt; Tombstone oder Key-Erasure erfolgt erst nach Admin-Freigabe und verändert das Microsoft-Postfach nicht.
**Ergebnis + Receipt/Readback:** Recovery-Events und durable Readback; nachvollziehbarer Endstatus.
**Fehlerfälle:** Lease-Konflikt, Wiederholungsbudget erschöpft, Key fehlt, beschädigte Eventkette.
**Sperren/Konflikte:** K-M05-006, K-M05-007, K-M05-008, K-M05-009.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Letzter sicherer Stand, unbekannter Schritt, Belege und Auflösung | FEHLT → Q-M05-003 | CAND Recovery |
| lädt | Readback/Recovery läuft | FEHLT → Q-M05-003 | CAND |
| leer | Kein offener Recovery-Fall | FEHLT → Q-M05-003 | RT-22 |
| Fehler | Recovery kann sicheren Stand nicht belegen | FEHLT → Q-M05-003 | CAND |
| gesperrt | Lease, Scope, Key oder Eventkette ungültig | FEHLT → Q-M05-003 | CAND |
| In Klärung | Klärfall ohne automatische Fortsetzung | „In Klärung“ | OE-2609-04 |
| In Aufbau | Recovery-Element ohne Aktion | „In Aufbau“ | OE-2609-04 |
