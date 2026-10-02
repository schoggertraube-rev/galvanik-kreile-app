<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Optikvorlage

Status: FEHLT → Designphase 1b

Es gibt keinen gültigen M05-Mock. Die alten M365-V1/V2/V3-Prototypen sind verworfen. Verbindliche Grundstamm-Referenz ist `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`, SHA-256 `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`; für M05 belegt sie nur Einbettungsstellen und Modal-Inhalte, nicht das M05-Layout. Designsystem-Bausteine (`kr-`) werden nach Phase 1 ergänzt. Mock-CSS und eigene Farbwerte dürfen nicht übernommen werden.

## Variantenabdeckung

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| G05 Kundenkarte: Kommunikationsverlauf und Telefonnotiz | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7: nur „In Aufbau“, „In Klärung“ wörtlich belegt | V5 Kundenkarte/Telefonnotiz; DIGEST |
| G03/G05 Overlay „Telefonnotiz erfassen“ | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7 | V5 Telefonkontakt-Modal; DIGEST |
| G06 Anfrageprüfung „KV vorbereiten“ | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7 | Mindmap F2; DIGEST; CAND |
| G04 Auftragskarte: Kommunikationsbezug | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7 | Mindmap F2; CAND |
| Antwortentwurf und Sendebestätigung | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7 | V5 E-Mail-Modal; CAND |
| G02 oben: dringender Kommunikationskonflikt | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7 | OE-2609-10; OE-2609-26; CAND |
| G08 Suchtreffer Kommunikation | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7 | CAND Search projection |
| G10 Connector-/Gesundheitsstatus | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 2/7 | RUNTIME; CAND Health |

## Inhaltsliste für Designphase 1b

Alle Einträge sind Bestandteile vorhandener Grundstamm-Screens oder Overlays. M05 erhält keine eigene Route, Inbox-Fläche oder Outlook-Nachbildung.

| Screen | Person | Daten (Felder) | Aktionen | Zustände | Quelle |
|---|---|---|---|---|---|
| G05 Kundenkarte · Kommunikation | Rolf, Phillip, Gregor nach Recht | bestätigter Kunde; Fall-ID; Kanal; Eingangszeit; Betreff/Kurzmetadaten; Status; Zuständigkeit; Quelle/Original-Ref; Unsicherheit; letzter sicherer Readback | Fall prüfen; Telefonnotiz starten; zu Auftrag/KV springen, wenn Grundstamm-Ziel und Recht vorhanden | Daten, lädt, leer, Fehler, gesperrt, In Klärung, In Aufbau | DIGEST „ein Müller“; CAND; OE |
| Overlay Telefonnotiz | alle nach Recht | Kunde/Kandidaten; Nummer optional; Notiztext; Capture-Art TYPED/SPEECH_TRANSCRIPT; Zeitpunkt; Sprache optional; Retention-Klasse; Unsicherheit | Text erfassen; Kunde bestätigen; speichern; verwerfen; Review akzeptieren/ablehnen | alle 7 | V5 Telefonkontakt-Modal; DIGEST; CAND |
| G06 Anfrageprüfung | primär Rolf | Quelle; bestätigter Kunde; Kontext-Coverage; prüfbare Einträge; Anhänge/Original-Claims; Routingvorschlag; Unsicherheit; KV-Ziel | Einträge prüfen; Kundenwahl korrigieren; Vorschlag bestätigen/verwerfen; bestätigten Quote-Command senden | alle 7 | Mindmap F2; CAND |
| G04 Auftragskarte · Kommunikationsbezug | Rolf/Phillip nach Zuständigkeit | Auftrag-Ref; Fall-Ref; letzte Nachricht; Status; offene Aktion; Evidence-Refs; Readback | Kontext öffnen; Routing bestätigen; auf Handlungsbedarf reagieren | alle 7 | Mindmap F2; CAND; OE-2609-10 |
| Antwortentwurf | berechtigte sendende Person | Bezug; attestierter Absender/Empfänger; Betreff; Body; Anlagen-Claims; Draft-Revision; Assignment-Revision; Disclosure-Grant; Sendestatus | Entwurf speichern; verwerfen; exakte Revision bestätigen; senden; unbekannten Ausgang klären | alle 7 | V5 E-Mail-Modal; CAND Outbound V1 |
| G02 · oben: dringende Konflikte, Warnungen und Entscheidungen | Rolf für Büro/KV; Phillip für Auftragsaktion | Konflikt-ID; Fall; Auslöser; Zuständigkeit; sicherer Status; Alter; erlaubtes Ziel | öffnen; zuordnen; bestätigen; verwerfen; technisch an Gregor eskalieren | alle 7 | OE-2609-10; OE-2609-26; Anleitung §5; CAND |
| G08 Suchtreffer | alle nach Recht | Fall-Ref; bestätigter Kunde; Kanal; Zeit; Status; Zielreferenzen; Coverage/Stale/Partial | erlaubtes Ziel öffnen; kein Rohinhalt in Suchindex | alle 7 | CAND Search projection; G08-Portbedarf |
| G10 Connectorstatus | Gregor/Admin | Kreile-Tenant; lizenziertes benanntes Kreile-Büropostfach; Consent-/Subscription-/Delta-/Supabase-Cron-/Outbox-/Readback-Status; letzte sichere Prüfung; Fehlercode ohne Secret | Verbindung autorisieren/erneuern nur nach separatem Owner-Gate; Diagnose öffnen; keine Provideraktion im Dossier | alle 7 | OE-2609-18; OE-2609-25; RUNTIME; OP-11; CAND Health |
| Recovery-/Klärdialog im Ursprungsscreen | zuständige Fachperson; Gregor bei Technik | unbekannte Operation; Receipt; Readback; Revision; Wiederholungsbudget; Evidenz; letzter sicherer Zustand | erneut lesen; fachlich bestätigen/verwerfen; begrenzt neu planen; schließen | alle 7 | CAND Recovery |

## Verbindliche Einbettungs- und Interaktionsregeln

- Kein Navigationspunkt und keine Route `/kommunikation`; Direktaufruf bleibt 404/fail-closed.
- Vor Adoption zeigt der Grundstamm ausschließlich gedämpfte, nicht klickbare `kr-`-Elemente mit „In Aufbau“ oder „In Klärung“, ohne Fake-Daten.
- Touchziele mindestens 48 px; Typografie, Farben und Zustände kommen ausschließlich aus dem aus V5 abgeleiteten Kreile-Designsystem.
- Desktop, Tablet und Handy müssen dieselbe fachliche Zustandsmaschine zeigen; keine Funktion darf nur über Hover erreichbar sein.
- Rohmail, Anhänge und Volltext dürfen nicht in Startseiten-, Such- oder Analyseprojektionen erscheinen.
- Das Overlay muss die Kundenauswahl bei ähnlichen Namen sichtbar erzwingen und vor Senden die exakte Empfänger-/Draft-Revision zeigen.
