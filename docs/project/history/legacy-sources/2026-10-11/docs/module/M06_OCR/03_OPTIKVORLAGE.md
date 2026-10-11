<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Optikvorlage M06

**Status: FEHLT → Designphase 1b**

Es existiert kein dediziert freigegebenes M06-Mock. `KREILE_GESAMTMOCK_V5_2026-09-14.html` ist der verbindliche App-Stil und enthält einen nützlichen Interaktionsanker für „Dokument / Info erfassen“, aber keinen abgenommenen Modulentwurf. Der Builder darf den V5-Prototyp nicht als fertige Produktfunktion oder Providerbeweis ausgeben.

**Quelle:** `02_app/docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` · SHA-256 `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA` · Anker `intakeModal`, `openIntake()`, `renderIntake()`; nur Stil/Interaktionsfolge, kein dediziertes M06-Mock.

| Screen | Desktop ≥1300 px | Tablet | Handy | Zustände belegt | Quelle/Anker |
|---|---|---|---|---|---|
| S-M06-001 Quelle wählen | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 im dedizierten Mock | V5 `intakeModal`, Stufe 0 nur Anker |
| S-M06-002 Original sichern | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 | V5 `renderIntake()`, Stufe 1 nur Anker |
| S-M06-003 Analyse starten | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 | V5 Leitfolge; Providerzustände fehlen |
| S-M06-004 Fakten prüfen | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 | V5 `renderIntake()`, Stufe 2 nur Anker |
| S-M06-005 Zuordnung | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 | V5 `renderIntake()`, Stufe 3 nur Anker |
| S-M06-006 Wirkung bestätigen | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 | kein belegter M06-Screen |
| S-M06-007 Receipt/Readback | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 | D-RES-001, kein Mock |
| S-M06-008 Offene Vorgänge | fehlt → Designphase 1b | fehlt → Designphase 1b | fehlt → Designphase 1b | 0/7 | D-RES-001, kein Mock |

**Designsystem-Bausteine (`kr-`):** wird nach Phase 1 ergänzt. Es werden keine Mock-CSS-Werte kopiert; Kreile-DS aus V5 (Fraunces + Inter, Navy/Cream, Touch 48 px) ist maßgeblich.

## Vollständige Inhaltsliste für Designphase 1b

| Screen | Person | Daten (Felder) | Aktionen | Zustände | Quelle |
|---|---|---|---|---|---|
| S-M06-001 Quelle wählen | alle; Admin kann sperren/erweitern | Quelle, Dateiname, MIME, Größe, Seiten, Zweck/`Unklar`, unterstützte Formate/Limits | Datei wählen, Dokumentfoto, Original sichern, Abbrechen | alle 7 aus F-M06-001 | V5 Stufe 0; A-M06-001/026/034/035 |
| S-M06-002 Original sichern | alle berechtigten | Uploadfortschritt, Originalstatus, Hash-Kurzbeleg, Sicherungszeit, Fehler/Korrelation | Upload abbrechen, erneut versuchen, weiter | alle 7 aus F-M06-001 | V5 Stufe 1; D-ARCH-012; D-RES-001 |
| S-M06-003 Analyse starten | alle berechtigten | Source-ID, Analyseweg, Providerstatus, Modellfähigkeiten, Format-/Seitenlimit, Datenübertragung | Vorschläge erzeugen, manuell fortsetzen, später | alle 7 aus F-M06-002 | D-AI-001; OP-09; Provider-Matrix |
| S-M06-004 Fakten prüfen | alle; Konflikte Rolf/Phillip | Originalseiten/-anker, Feldgruppen, Roh-/Endwert, Konfidenz, Kritikalität, Disposition, Coverage, Version | Quelle anspringen, korrigieren, disponieren, Entwurf speichern, Fakten geprüft | alle 7 aus F-M06-003/004 | V5 Stufe 2; Mapping-Vertrag |
| S-M06-005 Zuordnung | alle; Konflikte Rolf/Phillip | bestätigte Schlüsselfakten, bis zu drei echte Kandidaten, Treffergrund, Zielstatus | Ziel wählen, nicht zuordnen, erneut suchen, an Rolf/Phillip geben | alle 7 aus F-M06-005 | V5 Stufe 3; Mapping-Vertrag |
| S-M06-006 Wirkung bestätigen | fachlich berechtigte Person | serverseitiges Aktionslabel, Ziel, Wirkung, Risiko, Rechte, Vorbedingungen, Idempotenz | konkret benannte Aktion bestätigen, ohne Aktion abschließen, zurück | alle 7 aus F-M06-006 | D-AI-002; Mapping-Vertrag |
| S-M06-007 Receipt/Readback | ausführende Person | Receipt-ID, Zeit, Actor, Ziel, Commandstatus, Readback, Korrelation | Ergebnis öffnen, Original öffnen, Status prüfen, Startseite | alle 7 aus F-M06-006 | D-RES-001; Mapping-Vertrag |
| S-M06-008 Offene Vorgänge | alle für jeweilige Vorgänge; Konflikte Rolf/Phillip | Originalname, Zeitpunkt, Checkpoint, offener Grund, Version, Status | fortsetzen, Original öffnen, manuell fortsetzen, übergeben | alle 7 aus F-M06-007/008 | D-RES-001 |

## Verbindlicher V5-Anker

- Titel: **„Dokument / Info erfassen“**.
- Leitfolge: **„Original → optionale OCR-Vorschläge → Sichtprüfung → Zuordnung.“**
- Original wird vor Analyse gesichert.
- Original und Vorschläge stehen in der Prüfung nebeneinander.
- Abschlüsse: Auftrag, Kundenakte oder ungeklärter Eingang; nichts verschwindet.
- Der im V5-Mock verwendete synthetische Inhalt ist nur Layoutreferenz und darf nicht in Produktpfade übernommen werden.

## Cockpit-Zustand vor Adoption

| Eigenschaft | Festlegung |
|---|---|
| Kachel/Zeile | `Dokument / Info erfassen` |
| Statuschip | `In Klärung` |
| Darstellung | grau, im Raster der übrigen hinten angestellten Module |
| Interaktion | nicht klickbar, kein Link, keine Route, kein Dialog |
| Hilfetext | `Datenschutz und Dokumentendienst werden noch geklärt.` |
| Screenreader | `Dokument / Info erfassen, In Klärung, nicht verfügbar.` |

Nach begonnenem, aber noch nicht adoptiertem Bau darf der Status nur nach Projektgate zu **„In Aufbau“** wechseln. Grau und nicht klickbar bleiben unverändert.

## In Designphase 1b zu liefernde Ansichten

### S-M06-001 – Quelle wählen

- Kopf: Titel, ein Satz Leitfolge, Schließen.
- Auswahlkarten: Datei/Scan, Dokumentfoto; weitere Quellen nur bei realer Fähigkeit.
- Akzeptierte Formate, aktuelle Größen-/Seitenlimits und Datenschutzkurztext.
- Zweckauswahl mit `Unklar` als erlaubtem Wert.
- Primäraktion `Original sichern`, sekundär `Abbrechen`.
- Keine Kamera- oder Office-Option, wenn Adapter/Browser sie nicht real unterstützt.

### S-M06-002 – Original sichern

- Dateiname, Typ, Größe, Seitenzahl soweit lokal sicher bestimmbar.
- Fortschritt in Prozent und Text; Abbruchmöglichkeit.
- Expliziter Satz: `Es wurde noch keine Analyse gestartet.`
- Nach Finalisierung: Hash-Kurzbeleg, Zeitpunkt und `Original gesichert`.
- Fehlerbereich mit Korrelation und `Erneut versuchen`.

### S-M06-003 – Analyse starten

- Gesichertes Original als Voraussetzung.
- Gewählter Analyseweg: `Strukturierter Import`, `Dokumentanalyse` oder `Manuell`.
- Providerstatus, erlaubte Formatgrenze, erwartete Datenübertragung in klarer Sprache.
- Primäraktion `Vorschläge erzeugen`; bei offenem Gate deaktiviert plus Status `In Klärung`.
- Immer sichtbare Alternative `Manuell fortsetzen`.

### S-M06-004 – Fakten prüfen

- Desktop: links Originalviewer (55 %), rechts Prüfpanel (45 %).
- Schmal: zwei stabile Tabs `Original` und `Felder`; Tabwechsel verwirft nichts.
- Seitenleiste/Thumbnails für mehrseitige Dokumente, Warnpunkt je offener Seite.
- Feldgruppen: Dokumentzweck, Parteien/Kontakt, Referenzen, Daten, Positionen/Mengen/Oberflächen, Beträge/Zahlung, Logistik, weitere Fakten.
- Feldzeile: Label, editierbarer Wert, Rohwert aufklappbar, Konfidenz als Prozent und Text, Disposition, Quellensprung.
- Markierung: `Vorausgewählt` ab 85 %, `Prüfen` unter 85 %, `Kritisch` für Rollen/Beträge/IDs/Aktionen. Farbe nie allein.
- Konfliktkarte stellt beide Deutungen gegenüber; keine vorausgewählte Konfliktlösung.
- Sticky-Footer: Anzahl offen/geprüft, `Entwurf speichern`, `Fakten geprüft`.

### S-M06-005 – Zuordnung

- Zusammenfassung der bestätigten Schlüsselfakten.
- Maximal drei echte Kandidatenkarten: Typ, Name/Nummer, Treffergrund, relevante bestätigte Merkmale.
- Radiowahl plus feste Option `Nicht zuordnen – ungeklärter Eingang`.
- Konflikttext und Übergabe `An Rolf geben` oder `An Phillip geben`, soweit fachlich erlaubt.
- Primäraktion `Zuordnung prüfen`, nicht `Automatisch zuordnen`.

### S-M06-006 – Wirkung bestätigen

- Getrennte Bestätigungsseite/-stufe.
- Zeigt serverseitiges Aktionslabel, konkrete Wirkung, Ziel, Risiken, Rechte und Vorbedingungen.
- Checkbox/Bestätigungstext nennt die tatsächliche Wirkung, nicht „KI-Vorschlag übernehmen“.
- Primäraktion als Verb und Objekt, zum Beispiel `Dokument dem Auftrag zuordnen`.
- Kein Aktionsvorschlag ist ebenfalls ein vollständiger Abschluss: `Ohne Aktion abschließen`.

### S-M06-007 – Receipt und Readback

- Erfolgsstatus erst nach Readback.
- Receipt-ID, Zeitpunkt, Actor, Ziel und nachgelesene Zusammenfassung.
- Links `Original öffnen`, `Ergebnis öffnen` und `Zur Startseite`.
- Bei unklarem Ausgang kein grüner Erfolg; stattdessen `Aktion nicht bestätigt` und `Status prüfen`.

### S-M06-008 – Offene Vorgänge

- Liste eigener/erlaubter offener Läufe mit Originalname, Zeitpunkt, sicherem Checkpoint und offenem Grund.
- Filter `Meine`, `In Klärung`, `Fehler` nur bei echtem Datenbestand.
- Aktionen `Fortsetzen`, `Original öffnen`, fachlich erlaubte Übergabe.
- Keine Dokumentvorschau für unberechtigte Zeilen; Tenantwechsel leert UI-Cache.

## Komponenten und Designregeln

| Komponente | Verbindliche Eigenschaften |
|---|---|
| Statuschip | exakt `In Klärung`, `In Aufbau`, `Gesperrt`, `Prüfen`, `Vorausgewählt`, `Konflikt`; zusätzlich Icon/Text |
| Originalviewer | Zoom, Seite, Rotation nur als Ansicht; Original niemals überschreiben |
| FactRow | Label, Endwert, Rohwert, Quelle, Konfidenz, Disposition, Bearbeitungsstatus |
| SourceHighlight | sichtbare Region und Textalternative; bei Office ohne Polygon mindestens Seiten-/Abschnittsanker |
| CandidateCard | echte ID intern, lesbarer Name/Nummer, Treffergrund, keine Modellbegründung als Wahrheit |
| ConflictCard | beide Werte und Quellen; Aktionen `Wert A`, `Wert B`, `Manuell`, `In Klärung` |
| GateBanner | warum gesperrt, was nicht gesendet/ausgeführt wurde, sichere Alternative |
| ReceiptPanel | Receipt plus Readback; kein Erfolg nur aufgrund HTTP 200/Modelltext |

## Barrierefreiheit und Werkstatt-Tauglichkeit

- Mindestzielgröße 44 × 44 px; Kontrast nach WCAG AA.
- Fokusreihenfolge folgt Quelle → Feld → Status → Aktion; Viewer-Sprung kehrt zum Feld zurück.
- Dialoge halten Fokus und geben ihn beim Schließen an den Auslöser zurück.
- Fehlerzusammenfassung verlinkt jedes betroffene Feld.
- Prozentwerte erhalten Text: `92 %, vorausgewählt` beziehungsweise `64 %, prüfen`.
- Lange Nummern bleiben kopierbar und werden nicht durch rein visuelle Kürzung verfälscht.
- Ungespeicherte Änderungen lösen eine klare Verlassen-Warnung aus.
- Touch-Bedienung, Handschuhmodus und helle Werkstattumgebung werden im Designreview mit realistischen Geräten geprüft.

## Explizit verboten

- „Demo“, „Mock“, „simuliert“ oder zufällige Erfolgswerte in einer erreichbaren Produktoberfläche.
- Ein einziger Button `Alles übernehmen`.
- Nur grün/gelb/rot ohne Text.
- Automatische Vorauswahl eines Kunden allein aus Modelloutput.
- Fortschritts- oder Erfolgstext, wenn Original, Kommando oder Readback nicht real bestätigt ist.
- Versteckter Providerwechsel und ein nicht abschaltbarer KI-Pfad.

## Design-Abnahme

Das dedizierte Mock ist erst freigabefähig, wenn alle acht Ansichten, alle sieben Zustände jeder Funktion aus Datei 02, Desktop und schmale Ansicht, Tastaturführung sowie mindestens die Konfliktfälle `Absender/Empfänger`, `Betrag`, `kein DB-Treffer` und `Provider gesperrt` sichtbar dargestellt sind.
