<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Anforderungskatalog M06

## Prioritäten

- **MUSS:** für einen sicheren Modulpass zwingend.
- **SOLL:** Teil des Zielbilds; darf nur mit ausdrücklich dokumentierter, sicherer Degradierung fehlen.
- **KANN:** spätere Erweiterung, ohne den Kernvertrag zu verändern.

## Funktionale und fachliche Anforderungen

| ID | Anforderung (testbar, ein Satz) | Pflicht | Quelle | Abnahmekriterium | Stand |
|---|---|---|---|---|---|
| A-M06-001 | Universelle Dokumentaufnahme statt enger „OCR-Maske“ | Muss | Digest, Anforderungen 2026-09-14, Azure-Limits | Datei/Foto/Scan/PDF und die vom ausgewählten DI-Modell unterstützten Office-Formate können als Quelle angenommen werden; Formatgrenzen werden vor Upload erklärt. | SPEZ |
| A-M06-002 | Original zuerst | Muss | D-ARCH-012, D-RES-001 | Vor Analyse, Vorschauübernahme oder Zuordnung ist ein unverändertes, tenantgebundenes Original mit Hash, Größe, MIME-Typ und Speicherreferenz bestätigt. | SPEZ |
| A-M06-003 | Original bleibt beweiskräftig | Muss | Mindmap, Mapping-Vertrag | Rotation, Zuschnitt, Kompression oder Konvertierung erzeugt höchstens eine Arbeitskopie; das Original wird nie überschrieben. | SPEZ |
| A-M06-004 | Strukturierte Quelle vor OCR | Muss | D-AI-001 | Vor OCR wird geprüft, ob ein strukturierter Import/Parser die Daten verlustärmer liefert; die gewählte Methode ist am Lauf sichtbar. | SPEZ |
| A-M06-005 | Provider hinter Port | Muss | D-ARCH-012, Provider-Matrix | UI und Fachlogik kennen weder Azure-SDK noch Provider-Secret; sie sprechen nur mit dem `DocumentIntelligencePort`. | SPEZ |
| A-M06-006 | Kein stiller Fallback | Muss | D-AI-001, Quarantäne | Providerfehler wechseln nicht zu Gemini, Klippa, Mock oder einem stärkeren Modell. Jeder Stufenwechsel erfordert eine sichtbare, protokollierte Entscheidung. | SPEZ |
| A-M06-007 | Quellennachweis je Fakt | Muss | D-AI-002, Mapping-Vertrag | Jeder Vorschlag enthält stabile `factId`, Originalreferenz, Seite/Bereich oder Textanker, Rohwert, normalisierten Wert, Provider/Modellversion und Konfidenz. | SPEZ |
| A-M06-008 | Lückenlose Faktendisposition | Muss | Mapping-Vertrag, D-RES-001 | Jeder erkannte Fakt hat genau einen Zustand `ASSIGNED`, `REFERENCE_ONLY`, `CONFLICT` oder `UNASSIGNED`; doppelte oder fehlende Disposition verwirft den gesamten Lauf. | SPEZ |
| A-M06-009 | Human-in-the-loop | Muss | Owner-Vorwissen, Microsoft Transparency Note | Kein fachlich wirksamer Wert und keine Zuordnung wird allein aus Modelloutput übernommen. Der Mitarbeiter prüft und bestätigt. | SPEZ |
| A-M06-010 | 85-%-Schwelle richtig anwenden | Muss | Anforderungen 2026-09-14, Mapping-Vertrag | `>= 0,85` darf grün und vorausgewählt erscheinen; `< 0,85` wird einzeln als „Prüfen“ markiert. Beide Bereiche benötigen menschliche Bestätigung. | SPEZ |
| A-M06-011 | Kritische Felder nie allein per Schwelle | Muss | Realtest, Mapping-Vertrag | Rollen (Absender/Empfänger), Geldbeträge, Datumsbedeutung, Kunde, Auftrag, Beleg und auslösende Aktionen sind unabhängig von der Konfidenz explizit zu prüfen. | SPEZ |
| A-M06-012 | Original und Fakten nebeneinander | Muss | V5-Interaktionsanker, Anforderungen | Prüfansicht zeigt Originalseite und zugehörige Felder gleichzeitig; Auswahl eines Felds hebt die Quelle hervor. | SPEZ |
| A-M06-013 | Werte editierbar, Herkunft bleibt sichtbar | Muss | D-RES-001 | Korrektur ersetzt nicht den Rohwert; Originalvorschlag, Bearbeiter, Zeitpunkt und Endwert bleiben nachvollziehbar. | SPEZ |
| A-M06-014 | Dokumentzweck klassifizieren | Muss | Digest, V5 | Dokumenttyp/Zweck ist Vorschlag, editierbar und bestätigungspflichtig; „Unklar“ ist ein valider Zustand. | SPEZ |
| A-M06-015 | Fachliche Felder breit abbilden | Muss | Digest, Anforderungen | Mindestens Parteien/Kontakt, Referenzen, Datumswerte, Positionen/Mengen/Oberflächen, Beträge/Zahlungsbedingungen und Logistikinformationen als Faktenfamilien behandeln. Nicht vorhandene Felder werden nicht erfunden. | SPEZ |
| A-M06-016 | Rollen und Beträge trennen | Muss | UPS-Realtest, Mapping-Vertrag | Absender, Empfänger, Kunde, Lieferant und Rechnungsempfänger sowie Netto, Steuer, Brutto und Währung sind getrennte Fakten; keine implizite Gleichsetzung. | SPEZ |
| A-M06-017 | Kandidatensuche statt Blindtreffer | Muss | Anforderungen | Exakte Nummern zuerst, danach bestätigte Kontaktmerkmale, danach Ähnlichkeit; maximal drei Kandidaten plus „Nicht zuordnen“. Treffergrund wird angezeigt. | SPEZ |
| A-M06-018 | Keine erfundene Datenbankübereinstimmung | Muss | Mapping-Vertrag | Ohne tatsächlich abgefragte Kandidaten lautet das Ergebnis `NO_VERIFIED_DB_MATCH`; ein Modell darf keine ID erzeugen. | SPEZ |
| A-M06-019 | Ungeklärter Eingang ist erster Klasse | Muss | V5, D-RES-001 | Wenn keine sichere Zuordnung möglich ist, bleibt das gesicherte Original im ungeklärten Eingang; nichts verschwindet und keine Zuordnung wird erzwungen. | SPEZ |
| A-M06-020 | Aktionen nur aus Serverkatalog | Muss | Mapping-Vertrag | Das Modell darf höchstens einen `actionKey` vorschlagen. Label, Rechte, Vorbedingungen, Risiko und Verfügbarkeit werden serverseitig neu bestimmt. | SPEZ |
| A-M06-021 | Getrennte Aktionsbestätigung | Muss | D-AI-002, Mapping-Vertrag | Faktenprüfung und Fachaktion sind zwei sichtbare Schritte. Erst die zweite Bestätigung löst genau ein idempotentes Kommando aus. | SPEZ |
| A-M06-022 | Receipt und Readback | Muss | D-AI-002, D-RES-001 | Nach Kommando zeigt die App Beleg/Receipt und liest die tatsächliche Fachwahrheit zurück; ein Modelltext ist kein Erfolgsnachweis. | SPEZ |
| A-M06-023 | Sicherer manueller Kernpfad | Muss | Modulkarte, Provider-Matrix | Bei gesperrter oder fehlerhafter Analyse kann der Nutzer das Original öffnen und Fakten manuell erfassen/zuordnen, ohne Fake-Erfolg. | SPEZ |
| A-M06-024 | Wiederaufnahme | Muss | D-RES-001 | Nach Browserabbruch, Timeout oder Providerfehler wird derselbe Lauf über tenantgebundene ID und Idempotenzschlüssel wieder aufgenommen; kein doppeltes Kommando. | SPEZ |
| A-M06-025 | Verständliche Fehler | Muss | D-RES-001 | Fehler zeigen Korrelation, betroffenen Schritt und genau eine sichere nächste Aktion; interne Prompts, Stacktraces, Secrets und Dokumentinhalt fehlen. | SPEZ |
| A-M06-026 | Alle sieben UI-Zustände | Muss | Dossier-Anleitung, RT-22 | Jede Funktion besitzt Daten-, Lade-, Leer-, Fehler-, Gesperrt-, In-Klärung- und In-Aufbau-Zustand mit dem Wortlaut aus Datei 02. | SPEZ |
| A-M06-027 | Tenant- und Rechteprüfung serverseitig | Muss | AGENTS, D-ARCH-012 | Jede Original-, Analyse-, Kandidaten-, Bestätigungs- und Readback-Operation prüft Tenant, Session und Berechtigung neu. | SPEZ |
| A-M06-028 | Datenminimierung | Muss | OP-09, Microsoft Datenschutz | Nur für den bestätigten Zweck erforderliche Seiten/Fakten an den Provider senden; Logs und Telemetrie enthalten keine Dokumenttexte. | SPEZ |
| A-M06-029 | Providerbetrieb bleibt Gate | Muss | OP-09, Provider-Matrix | Ohne geklärte AVV/DPA-, Regions-, Netzwerk-, Kosten-, Lösch- und Betriebsentscheidung gibt es keinen echten Provideraufruf in der App. | SPEZ |
| A-M06-030 | Quarantäne bleibt ausgeschlossen | Muss | Ist-Code, RT-31 | Gemini, Klippa, `ManualProvider`, `MockOcrProvider`, `simulateScan` und Demo-Beleg dürfen nicht über Manifest, Import oder Route erreichbar sein. | SPEZ |
| A-M06-031 | Keine zweite Datenwahrheit | Muss | Path 1, AGENTS | M06 besitzt keine Kunden-/Auftrags-/Buchhaltungstabellen. Es referenziert bestätigte IDs und nutzt vorhandene Fachkommandos. | SPEZ |
| A-M06-032 | Bestehende `scan_uploads`-Basis prüfen | Muss | Ist-Code-Audit | Persistenz darf erst nach dokumentiertem Abgleich von Baseline und `src/db/schema.ts` genutzt werden; keine Blindmigration und keine neue Tabelle. | SPEZ |
| A-M06-033 | Such-/Chat-Nutzung nur bestätigt | Muss | Digest, D-AI-002 | Spätere Suche oder KI-Chat erhalten nur bestätigte, tenant- und rechtegefilterte Fakten plus Originalreferenz; Rohoutput und Konflikte werden nicht als Wahrheit indexiert. | SPEZ |
| A-M06-034 | Barrierearme Bedienung | Muss | UI-Kanon, RT-22 | Vollständig per Tastatur; sichtbarer Fokus; Status zusätzlich als Text/Icon, nie nur Farbe; Feldfehler am Feld; Dialogfokus gefangen und rückkehrend. | SPEZ |
| A-M06-035 | Responsive Prüfansicht | Muss | Designphase 1b | Desktop zweispaltig; schmale Ansicht schaltet zwischen „Original“ und „Felder“, ohne Änderungen zu verlieren. | SPEZ |
| A-M06-036 | Vollständige Auditspur | Muss | D-RES-001 | Aufnahme, Analyseanforderung/-ergebnis, Korrektur, Bestätigung, Zuordnung und Kommandoausgang werden mit Actor, Tenant, Zeit, Korrelation und Version protokolliert. | SPEZ |
| A-M06-037 | Geheimnisse nur benennen | Muss | Auftrag, AGENTS | Dossier/Client/Logs enthalten keine Keys. Erwartete Konfigurationsnamen stehen ausschließlich in Datei 04. | SPEZ |
| A-M06-038 | Providerkonfiguration ist tenantgebunden | Muss | AGENTS.md; OE-2609-25, 2026-09-26 | Endpunkte, Identität, Ressourcen und Providerstatus für den Tenant `galvanik-kreile` kommen ausschließlich aus serverseitiger Kreile-Hostkonfiguration; der Client enthält weder Endpunkt noch Schlüsselwert. | SPEZ |
| A-M06-039 | Mehrseitige Navigation | Soll | Anforderungen, Designphase 1b | Seitenminiaturen zeigen Anzahl, Warnungen und unbearbeitete Fakten; Sprung zum Feld öffnet die richtige Seite. | SPEZ |
| A-M06-040 | Qualitätswarnungen | Soll | Anforderungen | Unschärfe, Rotation, Beschnitt, schwacher Kontrast und nicht unterstütztes Format werden vor Analyse verständlich angezeigt. | SPEZ |
| A-M06-041 | Barcode als Zusatzfakt | Soll | Azure-Realtest | Barcodes können als quellennachweisbare Fakten einfließen; sie umgehen weder Review noch Kandidatenprüfung. | SPEZ |
| A-M06-042 | Starke Modellstufe | Soll | D-AI-001 | Eine zusätzliche multimodale Stufe ist nur nach eigener Kosten-/Datenschutzfreigabe und sichtbarer Nutzerentscheidung zulässig. | SPEZ |
| A-M06-043 | Aufbewahrung und Löschung folgen der Dokumentart | Muss | OE-2609-20, 2026-09-26 | Hostfristen werden je Dokumentart angewandt; Löschung oder Anonymisierung erfolgt nur als Vorschlag nach Admin-Freigabe, nie still; Original, Arbeitskopie, bestätigte Fakten und Auditbelege bleiben bis zur jeweils geltenden Frist nachvollziehbar. | SPEZ |
| A-M06-044 | Produktionsprovider gehört Kreile | Muss | OE-2609-25, 2026-09-26; `HINWEIS_OWNER_OE-2609-25.md` | Produktion nutzt ausschließlich das Kreile-eigene Azure-Abo im freigegebenen S0-Zuschnitt; die vorhandene F0-Dev-Ressource bleibt auf synthetische Tests beschränkt, und Dev-E2E wird vor Livegang im Kreile-Tenant wiederholt. | SPEZ |

## Eingabeformate und Grenzen

Die Produktoberfläche darf nur Formate anbieten, die der **konkret konfigurierte Modellpfad** unterstützt. Für Azure Document Intelligence API `2024-11-30` sind laut aktueller Microsoft-Dokumentation PDF sowie JPEG/JPG, PNG, BMP, TIFF und HEIF breit unterstützt. DOCX, PPTX und XLS sind beim Read-/Layout-Pfad unterstützt, nicht pauschal bei vorgefertigten oder Custom-Modellen. Deshalb wird „Office-Datei“ nicht blind an ein Rechnungsmodell geschickt.

Der vorhandene F0-Testtarif ist kein Produktionszuschnitt: aktuell 1 Analyze-Transaktion/s, 4 MB und 2 Seiten pro Analyse; außerdem 500 Seiten/Monat kostenlos. Die App muss Limits aus der aktiven Providerkonfiguration erhalten und vor dem Senden prüfen. Tarifwerte werden nicht hart im UI verdrahtet.

## Mindestumfang für Modulpass

Ein Modulpass setzt A-M06-001 bis A-M06-038 sowie A-M06-043/A-M06-044, die Tests in Datei 07, ein freigegebenes Design und einen bestandenen unabhängigen Review voraus. A-M06-039 bis A-M06-042 dürfen nach dem Pass ergänzt werden, solange ihre Abwesenheit sichtbar dokumentiert ist und keine Muss-Regel geschwächt wird.
