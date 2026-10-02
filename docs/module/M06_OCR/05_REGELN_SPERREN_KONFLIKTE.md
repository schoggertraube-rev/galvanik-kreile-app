<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# Regeln, Sperren und Konflikte M06

## Nicht verhandelbare Regeln

| ID | Regel | Technische/visuelle Durchsetzung |
|---|---|---|
| R-M06-001 | Original vor Analyse und Zuordnung | Server lehnt Analyse ohne finalisierte SourceEnvelope ab; UI zeigt `Original zuerst`. |
| R-M06-002 | Original unverändert | Bearbeitungen nur als Ansicht/Arbeitskopie; Hash der Ursprungsdatei bleibt maßgeblich. |
| R-M06-003 | Strukturierte Daten vor OCR | Orchestrator dokumentiert gewählten Pfad; OCR ist keine Standardantwort auf jedes Format. |
| R-M06-004 | Provideroutput ist untrusted | Schema-, Quellen-, Rollen- und Coverage-Validierung vor UI/Fachschritt. |
| R-M06-005 | Human-in-the-loop immer | `requiresHumanConfirmation=true`; keine automatische Mutation. |
| R-M06-006 | 85 % nur UI-Schwelle | Ab 85 % `Vorausgewählt`, darunter `Prüfen`; beide bestätigungspflichtig. |
| R-M06-007 | Kritische Fakten immer einzeln prüfen | Rollen, IDs, Beträge, Datumsbedeutung, Ziele und Aktionen lassen sich nicht per Sammelbestätigung überspringen. |
| R-M06-008 | Vollständige Faktendisposition | Genau eine Disposition je Fakt; gesamte Analyseversion sonst ungültig. |
| R-M06-009 | Keine erfundene Zuordnung | Ziel-ID stammt ausschließlich aus Host-Kandidatenport; sonst `NO_VERIFIED_DB_MATCH`. |
| R-M06-010 | Maximal drei Kandidaten | Verständliche Auswahl plus `Nicht zuordnen`; keine kognitive Trefferliste ohne Grenze. |
| R-M06-011 | Aktion aus Serverkatalog | Modell- oder Clientlabel besitzt keine Ausführungswirkung. |
| R-M06-012 | Genau ein Kommando | separate Bestätigung + Idempotenz; Refresh/Doppelklick erzeugt keine Doppelwirkung. |
| R-M06-013 | Erfolg nur mit Receipt und Readback | HTTP 200, Providerstatus oder Modelltext reicht nie. |
| R-M06-014 | Kein stiller Fallback | jeder Adapter-/Modellwechsel sichtbar, zugelassen und auditiert; Quarantäne nie Fallback. |
| R-M06-015 | Fail closed, Original bleibt nutzbar | Analyse-/Zuordnungsfehler blockiert Wirkung, nicht manuelle Arbeit am gesicherten Original. |
| R-M06-016 | Keine zweite Datenwahrheit | keine eigenen Fachstammdaten/-tabellen; nur IDs und Ports. |
| R-M06-017 | Tenant/Rechte auf jeder Grenze | keine reine Clientprüfung, keine dauerhafte öffentliche Original-URL. |
| R-M06-018 | Keine PII in Telemetrie | IDs/Korrelation/Metriken statt Dokumenttext, Adresse, E-Mail, Telefon oder Betrag. |
| R-M06-019 | Provider-Gate vor Echtverkehr | Kreile-eigenes Azure-Abo, Datenschutz, DPA/AVV, Region, Netzwerk, Retention, Kosten und Betrieb freigegeben; F0-Dev nur synthetisch. |
| R-M06-020 | Modul-Gate vor Route | Manifest, Handshake, Tests, Review und serielles Owner-Gate; vorher graues Element. |
| R-M06-021 | Kreile-Providerkonfiguration nur serverseitig | Ressourcen, Endpunkte, Identität und Providerstatus des Tenants `galvanik-kreile` liegen nur in der Kreile-Hostkonfiguration. |
| R-M06-022 | Wahrheit vor Komfort | Unklarer Wert bleibt Konflikt/ungeklärt; UI erfindet keine plausible Ergänzung. |
| R-M06-023 | Keine stille Löschung | Aufbewahrungsfristen kommen je Dokumentart aus dem Host; Löschung/Anonymisierung nur als Vorschlag mit Admin-Freigabe. |

## Sperren (vorbeugend)

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| S-M06-001 Cockpit-/Adoptionsgate | Route, Dialog und Direkt-URL vor Adoption | UI + Server | OE-2609-004/005/006; Ausgrauen-Standard; Text `In Klärung` | SPEZ |
| S-M06-002 Original-Gate | Analyse, Review und Zuordnung vor finalisiertem Original | UI + Server + Storagebeleg | D-ARCH-012; Mapping-Vertrag; Text `Original zuerst` | SPEZ |
| S-M06-003 Provider-Gate | echten externen Analyseaufruf ohne Kreile-eigene Produktionsumgebung und Datenschutz/Betrieb/Kosten | UI + Server | OE-2609-25; OP-09; Provider-Matrix; Text `Dokumentendienst in Klärung` | SPEZ |
| S-M06-004 Format-/Limit-Gate | Upload/Analyse unzulässiger Datei | UI + Server | Microsoft Service Limits; Adaptercapabilities | SPEZ |
| S-M06-005 Analysevertrags-Gate | Teilübernahme eines ungültigen Providerresultats | Server + Persistenzadapter | D-AI-002; Mapping-Vertrag; Text `Vorschläge unvollständig` | SPEZ |
| S-M06-006 Review-Gate | Bestätigung/Aktion bei offenem kritischem Fakt | UI + Server | Mapping-Vertrag; Text `Prüfung noch offen` | SPEZ |
| S-M06-007 Match-Gate | erfundene/automatische Ziel-ID | Server | `NO_VERIFIED_DB_MATCH`; Kandidatenport | SPEZ |
| S-M06-008 Rechte-/Versions-Gate | Zuordnung/Aktion auf veraltetem oder gesperrtem Ziel | UI + Server + DB/RLS | D-RES-001; Text `Ziel nicht verfügbar` | SPEZ |
| S-M06-009 Receipt-/Readback-Gate | Erfolgsmeldung oder Wiederholung ohne bestätigte Wirkung | UI + Server | D-AI-002; Text `Aktion nicht bestätigt` | SPEZ |
| S-M06-010 Tenant-/Session-Gate | fremden Lauf, Vorschau oder Serveroperation | UI + Server + DB/RLS | AGENTS; D-ARCH-012; Text `Vorgang gesperrt` | SPEZ |

## Fachliche Konflikte

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-M06-001 | Absender und Empfänger sind mehrdeutig oder widersprechen Kontext | getrennte Rollenfakten/Regeln; kein implizites Mapping | Rolf oder Phillip nach fachlicher Zuständigkeit | jeweilige Startseite › Dringende Konflikte, Warnungen und Entscheidungen | am Original Rolle bestätigen oder `CONFLICT`; danach Fakten neu bestätigen | SPEZ |
| K-M06-002 | Mehrere Kunden-/Auftrags-/Belegkandidaten passen | echte Kandidaten mit unterschiedlichen Treffergründen | Rolf oder Phillip | jeweilige Startseite › Dringende Konflikte, Warnungen und Entscheidungen | genau ein Ziel bestätigen oder ungeklärter Eingang | SPEZ |
| K-M06-003 | Netto/Steuer/Brutto/Währung oder Datumsbedeutung ist inkonsistent | getrennte Fakten plus deterministische Plausibilisierung | Rolf oder Phillip | jeweilige Startseite › Dringende Konflikte, Warnungen und Entscheidungen | Wert/Bedeutung am Original klären; sonst `CONFLICT` | SPEZ |
| K-M06-004 | Kommandoausgang und Readback widersprechen sich | Receipt vorhanden, Readback fehlt/ist inkonsistent | Rolf fachlich; Phillip technisch je Zuständigkeit | Rolf/Phillip › Dringende Konflikte, Warnungen und Entscheidungen | `Status prüfen`; keine Wiederholung bis geklärt | SPEZ |
| K-M06-005 | Provider/Modellstufe soll wegen Unsicherheit gewechselt werden | Analyse fehlgeschlagen/unsicher; alternative Stufe nicht freigegeben | Phillip technisch; Rolf bei fachlichem Zweck | Phillip › Dringende Konflikte, Warnungen und Entscheidungen | explizites Gate/Freigabe oder manuell fortsetzen; kein stiller Fallback | SPEZ |
| K-M06-006 | Originalreferenz, Arbeitskopie oder Laufversion passt nicht | Hash-/Versions-/Tenantprüfung | Phillip technisch | Phillip › Dringende Konflikte, Warnungen und Entscheidungen | Lauf sperren, Original prüfen, nur bestätigten Checkpoint fortsetzen | SPEZ |

## Aufgelöster Quellenabgleich (keine App-Konflikte)

| ID | Konflikt | Verbindliche Auflösung | Begründung |
|---|---|---|---|
| SK-M06-001 | Frühere Anforderung „ab 85 %“ kann wie automatische Übernahme wirken; neuer Mapping-Vertrag verlangt Bestätigung. | 85 % ist ausschließlich Darstellungs-/Vorauswahlschwelle. Keine Mutation ohne Mensch. | Neuerer, strengerer Rettungs-/Mapping-Vertrag und Owner-Vorgabe gewinnen. |
| SK-M06-002 | Azure-Rechnungsmodell meldete hohe Konfidenz, vertauschte aber bei UPS Absender/Empfänger. | Rollen sind immer kritisch; Layoutfakten plus deterministische Regeln, menschliche Rollenprüfung. | Konfidenz misst Modellselbsteinschätzung, nicht fachliche Rollenrichtigkeit. |
| SK-M06-003 | Ältere Modulkarte bezeichnet einzelne spätere Module sinngemäß als entfallen; Owner-Plan stellt M01–M07 hinten an. | M06 ist `HINTEN_ANGESTELLT`; der Kern darf nach OE-2609-17 parallel gebaut werden, wobei M06 vor M05 liegt; Kreile-Anbindung bleibt seriell nach Grundstamm. | OE-2609-17 vom 2026-09-26 präzisiert die Bau- und Anbindungsreihenfolge. |
| SK-M06-004 | Zwei abweichende Entscheidungsregisterkopien. | Repo-Kopie aus `origin/main` plus D-UI-V5-003 gilt; Abweichung bleibt als OP-01 dokumentiert. | Nutzerauftrag und Quellenautorität legen dies ausdrücklich fest. |
| SK-M06-005 | V5 zeigt einen synthetischen OCR-Ablauf, Produktwahrheit verbietet Fake-Funktion. | V5 nur Stil-/Interaktionsanker; synthetische Werte und Demoaktionen dürfen nicht in erreichbare Produktpfade. | D-UI-V5-003 plus Produktwahrheit. |
| SK-M06-006 | Baseline enthält mehr `scan_uploads`-Felder als Drizzle-Schema. | Vor Bau Abgleich; keine Blindmigration, keine neue Tabelle. Persistenz ausschließlich über Hostport. | Verhindert zweite Schemawahrheit und Datenverlust. |
| SK-M06-007 | „Office-Dateien“ sind als Eingabe gefordert, werden aber nicht von jedem Azure-Modell gleich unterstützt. | UI bietet ein Format nur für den konkret aktiven, vom Adapter gemeldeten Modellpfad an. | Aktuelle Microsoft-Limits unterscheiden Read/Layout von Prebuilt/Custom. |
| SK-M06-009 | F0-Devressource ist real getestet, aber nicht produktionsgeeignet/freigegeben. | Sie bleibt ausschließlich für synthetische Tests; Produktion ist als S0 im Kreile-eigenen Azure-Abo festgelegt, aber erst nach G-M06-003/005 aktivierbar. | OE-2609-25; OP-09; Provider-Matrix. |

## Fachliche Konflikte im Lauf

| Konflikttyp | Darstellung | Erlaubte Auflösung |
|---|---|---|
| Absender vs. Empfänger | beide Werte, beide Quellen, keine Vorauswahl | Nutzer wählt Rolle oder setzt `CONFLICT`; bei Wirkung Rolf/Phillip |
| Mehrere Beträge | Netto/Steuer/Brutto/Währung einzeln | am Original prüfen; fehlende Bedeutung nicht raten |
| Mehrere Datumswerte | Wert plus vermutete Bedeutung | Bedeutung bestätigen oder `REFERENCE_ONLY`/`CONFLICT` |
| Mehrere Kunden/Aufträge | bis zu drei echte Kandidaten mit Treffergrund | genau ein Ziel oder ungeklärter Eingang |
| Provider vs. Nutzerkorrektur | Rohwert bleibt sichtbar, Endwert separat | Nutzerkorrektur mit Actor/Zeit; kein stilles Überschreiben |
| Modell schlägt unbekannte Aktion vor | keine Aktionskarte aus Modelltext | verwerfen; nur Serverkatalog oder ohne Aktion abschließen |
| Original und abgeleitete Datei unterscheiden sich | Originalhash und Arbeitskopie getrennt | Original maßgeblich; Analyse ggf. neu und versioniert |

## Datenschutz-/Provider-Gate G-M06-003

Vor echtem Providertraffic muss ein prüfbarer Gatebeleg mindestens enthalten:

- freigegebener Zweck und zulässige Dokumentklassen/PII,
- Microsoft-DPA/AVV- und interne Datenschutzprüfung,
- tatsächlich konfigurierte Region und dokumentierter Datenweg,
- Authentifizierung/RBAC; lokale Keyauth bleibt deaktiviert, sofern freigegebenes Ziel nicht anders entscheidet,
- öffentliche/Private-Endpoint-Entscheidung und Egresskontrolle,
- 24-Stunden-Providerretention und gegebenenfalls frühere Delete-Operation als getesteter Beleg,
- dokumentartbezogene Original-/Produktretention nach OE-2609-20 und Lösch-/Anonymisierungsvorschlag mit Admin-Freigabe im Host,
- Tarif, Budget, Rate-/Seiten-/Größenlimits und Alarmierung,
- Failure-Injection, Timeout, Retry ohne Doppelwirkung und manueller Pfad,
- reale Kreile-Testmenge einschließlich atypischer Rechnung, Handschrift, Rotation und Mehrseite,
- unabhängiger Review; keine bloße Portal- oder HTTP-200-Bestätigung.

## Integrationsgate G-M06-004/005

Adoption ist nur erlaubt, wenn:

1. der Grundstamm vom Owner abgenommen ist,
2. die serielle Kreile-Anbindung eingehalten wird; der parallele Kernbau nach OE-2609-17 ersetzt dieses Transfergate nicht,
3. dediziertes M06-Design freigegeben ist,
4. Manifest und Handshake exakt zum Commit passen,
5. keine Quarantäneimporte/Routes erreichbar sind,
6. RLS/Tenant-, Command-/Receipt-/Readback- und Failure-Tests bestehen,
7. ein unabhängiger read-only Reviewer PASS gibt,
8. Rollback das Modul deaktiviert, ohne Originale oder Auditbelege zu löschen.
