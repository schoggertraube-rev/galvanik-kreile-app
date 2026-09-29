<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 07 — Abnahme und Tests

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-G09-001 | A-G09-001/A-G09-032 | Given fremder Tenant oder fehlende Capability, when ein G09-Read/Command angefordert wird, then sind Ergebnis und Seiteneffekte fail-closed. | E2E | Zu ergänzen; vorhandene F0 Tenant-/Authorization-Negativtests wiederverwenden, nicht ersetzen. |
| T-G09-002 | A-G09-002 | Given zwei Clients mit derselben Version, when beide denselben Auftrag ändern, then schreibt genau einer und der andere erhält `CONFLICT` plus aktuellen Readback. | E2E | Bestand: Commandtests `orderStationCommand`; SHA `9E835B092419`; G09-UI-E2E ergänzen. |
| T-G09-003 | A-G09-003 | Given gleiche `clientEventId` und gleiche Absicht, when wiederholt, then identisches Receipt ohne zweite Mutation; bei anderer Absicht `CONFLICT`. | E2E | Vorhandene F1-Commandtests; missionsbezogener Laufbeleg neu zu erzeugen. |
| T-G09-004 | A-G09-004/A-G09-005 | Given direkter UPDATE/DELETE/TRUNCATE-Versuch auf geschützte Historie, when ausgeführt, then weist DB ab und ursprüngliche Zeile bleibt identisch. | E2E | Bestehende Migration-/Negativtests; Hashes in `09`. |
| T-G09-005 | A-G09-006 | Given Matrix aus Status, Payment Mode und Zahlung, when Warenausgang ausgelöst wird, then nur erlaubte Kombination schreibt ein Receipt. | E2E | Bestand: `recordGoodsOutCommand` SHA `C9D55BBB2DD3`; Matrix-E2E mit G07-Vertrag ergänzen. |
| T-G09-006 | A-G09-007/A-G09-034 | Given Antwortverlust nach Command, when UI keinen Receipt hat, then zeigt sie `AUSGANG_UNGEKLÄRT`, sucht Receipt, liest zurück und sendet nicht blind erneut. | E2E | Zu erstellen; D-RES-001-Abnahme. |
| T-G09-007 | A-G09-008/A-G09-010 | Given unvollständige oder doppelte Konfliktitems, when Feed gebaut wird, then unvollständige Items scheitern und gleiche Schlüssel erscheinen einmal. | Smoke | Unit-/Contract-Test für `buildConflictFeedV1` zu erstellen. |
| T-G09-008 | A-G09-009 | Given gebaute G09-Integration, when Importgraph und Schema diff geprüft werden, then existieren keine G09-Tabelle, Local-Storage-Wahrheit oder privaten Cross-Module-Imports. | Smoke | Architekturtest zu erstellen; D-RES-001. |
| T-G09-009 | A-G09-011 | Given jede Konfliktart aus `05`, when Verantwortung abgeleitet wird, then Ergebnis entspricht Rolf/Phillip-Matrix und nie Gregor im Businessfeed. | Smoke | Tabellengetriebener Contract-Test zu erstellen. |
| T-G09-010 | A-G09-012 | Given Rolf mit gemischten Fakten, when Startseite lädt, then „Das braucht dich“ zeigt nur dringende Entscheidungen/Konflikte und keine KPI-Kachelwand. | Owner-UX | Screenshot-/DOM-Beleg Desktop/Tablet/Handy zu erstellen. |
| T-G09-011 | A-G09-013 | Given Phillip mit Werkstatt- und Finanzfällen, when Startseite lädt, then „Heute sichern“ enthält nur operative Aktionen und keine Geld-/Kundenentscheidung. | Owner-UX | Screenshot-/DOM-Beleg Desktop/Tablet/Handy zu erstellen. |
| T-G09-012 | A-G09-014 | Given Termine gestern/heute/morgen in Berlin, when klassifiziert, then Labels sind überfällig/heute/morgen und enthalten keine Kapazitätsprognose. | Smoke | Zeitzonenfester Unit-Test zu erstellen; Altlogik `getUrgency` SHA `9EDFEDF24DCF` umbauen. |
| T-G09-013 | A-G09-015 | Given null/ungültiger Termin, when Feed lädt, then erscheint bei Rolf „Termin — In Klärung“ und kein erfundenes Datum. | Owner-UX | DOM-Test zu erstellen. |
| T-G09-014 | A-G09-016 | Given aktuelle Version und Pflichtgrund, when Rolf Termin verschiebt, then altes/neues Datum, Actor und Grund sind im immutable Event belegt und Readback aktualisiert den Feed. | E2E | `rescheduleOrderCommand`-Tests und Migrationsevidenz zu erstellen. |
| T-G09-015 | A-G09-016 | Given veraltete Version, fehlender Grund oder fremder Tenant, when Terminverschiebung versucht wird, then null Mutation/Providercall und verständlicher Fehler. | E2E | Negative Command-/Provider-Spiontests zu erstellen. |
| T-G09-016 | A-G09-017/A-G09-020 | Given echtes Kreile-Büropostfach, when Abwesenheiten gelesen und Auftragstermin projiziert wird, then Übersicht und Detail entsprechen OE-2609-19 und App-Links funktionieren. | E2E | BLOCKIERT bis M04: Real-Provider-E2E, keine Mock-Abnahme. |
| T-G09-017 | A-G09-018 | Given Auftragstermin und Kalenderintervalle, when Person/Ressource gleich und Intervalle überlappen, then Konflikt; bei Randberührung, anderer oder fehlender Zuordnung keiner. | Smoke | Tabellengetriebener Intervalltest zu erstellen. |
| T-G09-018 | A-G09-019 | Given typischer Terminfall, when Rolf/Phillip ihn erledigen, then direkter Kalenderbesuch ist auf Annahme, Verschiebung, Startseite und Werkstatt nicht nötig. | Owner-UX | Moderierter Task-Test nach G02/M04 zu erstellen. |
| T-G09-019 | A-G09-021 | Given M365 nicht verbunden, Tokenfehler oder Rate Limit, when Feed lädt, then kein „konfliktfrei“, kein Fallback und definierter In-Aufbau-/Fehlerzustand. | E2E | Provider-Fail-closed-Test nach M04 zu erstellen. |
| T-G09-020 | A-G09-022 | Given N offene Aufträge in Station Galvanik, when Werkstatt lädt, then WIP zeigt exakt N und keine Kapazitäts-/Prozentangabe. | E2E | Read-Port-/DOM-Test zu erstellen. |
| T-G09-021 | A-G09-023 | Given beliebige WIP-Zahlen ohne Kapazitätsmodell, when Feed lädt, then keine Ampel/Engpasswarnung und „Kapazität — In Klärung“. | Owner-UX | Negativer DOM-/Texttest zu erstellen. |
| T-G09-022 | A-G09-024/A-G09-025 | Given drei offene Teile mit Freitext Zink, when Feed lädt und Hinweis geklickt wird, then Text lautet „3 Aufträge nennen Zink — Bündelung prüfen“, Liste ist gefiltert und null Writes erfolgen. | E2E | Read-/Routing-/No-Write-Test zu erstellen. |
| T-G09-023 | A-G09-024 | Given ähnliche, leere oder verschiedene Oberflächenwerte, when Feed baut, then keine technische Kompatibilität und kein Bündelcommand wird behauptet. | Smoke | Unit-Test zu erstellen. |
| T-G09-024 | A-G09-026/A-G09-027 | Given inline Blocker und Startseitenfeed, when Ursache unverändert bleibt, then Karte bleibt; nach erfolgreicher Fachaktion plus Readback verschwindet sie ohne separates Erledigt. | E2E | Fachfall-E2E zu erstellen. |
| T-G09-025 | A-G09-028 | Given Rolf delegiert und Phillip gibt zurück, when Commands erfolgreich sind, then beide sehen dieselbe Assignment-Wahrheit und Rolf erhält den Fall zurück. | E2E | Bestandsha `C54C5C1D299C`/`F16FFE473254`; Rollen-UI-E2E ergänzen. |
| T-G09-026 | A-G09-029 | Given kein persistenter Snooze-Port, when Karten rendern, then existiert keine Snooze-Aktion; später lehnt der Command Datum nach Frist ab. | Smoke | Negativer DOM-Test jetzt; Servertest erst nach Q-G09-004. |
| T-G09-027 | A-G09-030 | Given Produkt-Entrypoints, when statischer Importgraph geprüft wird, then `WarningBell`, `WarningDrawer`, `engine`, `ruleRegistry` und `store` sind nicht produktiv verdrahtet. | Smoke | Bestandsbefund; T-13 Linkprüfung/Abbaubeleg zu erstellen. |
| T-G09-028 | A-G09-031 | Given Rolf, Phillip und Adminprofile, when Feeds/Aktionen geladen werden, then Daten und Aktionen sind capabilitygebunden und Businesskonflikte gehen nur an Rolf/Phillip. | E2E | Rollen-/Authorization-Matrix zu erstellen. |
| T-G09-029 | A-G09-033 | Given jeder der sieben Zustände, when Desktop/Tablet/Handy und Tastatur/Screenreader geprüft werden, then Zustand ist sichtbar, verständlich und ohne Layout-/Fokusverlust. | Owner-UX | Visual-/A11y-Beleg nach Designphase 1; Texte aus `02`. |
| T-G09-030 | A-G09-035 | Given parallele Auftragsannahmen an der Nummerngrenze, when beide schreiben, then keine Doppelnummer, kein Teilauftrag und sichere Wiederaufnahme. | E2E | RT-15 Prüfbeleg zu erstellen; Besitzer ist Intake/Orders. |
| T-G09-031 | Gesamtscope | Given Repository-Scan auf Kapazität/WIP/Bündelung, when gebauter Stand bewertet wird, then nur echte neue Implementierung gilt und Archiv/Mock/Schemafeld wird nicht als Lieferung gezählt. | Smoke | Vorher-Befund Red-Team 2026-09-26; nach Mission erneut ausführen. |
| T-G09-032 | Gesamtscope | Given echte Produktdaten, when alle G09-Flows getestet werden, then kein synthetischer Datensatz, Mockprovider oder simulierter Erfolg befindet sich im Produktpfad. | E2E | Missionsevidenz mit Real-Reads; synthetische Fixtures ausschließlich isoliert im Test. |

## Abnahme-Reihenfolge

1. Smoke: Contract-, Rollen-, Dedupe-, Termin-, Importgraph- und Textgrenzen.
2. E2E: echte Server-/DB-Receipts, Readback, Konkurrenz, Offline und Besitzeraktionen.
3. Owner-UX: Rolf/Phillip auf Desktop, Tablet und Handy, einschließlich aller sieben Zustände.
4. Kalender-E2E erst nach M04-External-Gate; ein Mock kann Unitlogik prüfen, aber nie dieses Gate bestehen.
