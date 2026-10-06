# 00 · UI-REFERENZEN — GEBUNDENE UI-QUELLENORDNUNG

Status: `AUTHORITATIVE_UI_REFERENCE_INDEX`
Stand: 2026-10-06 · D-GOV-001 · D-UI-DS-001

> **STAND 2026-09-06:** Die vier kanonischen UI-Referenzen sind jetzt als HTML-Dateien **im Repo eingefroren** unter `docs/project/linie/ui/`. Die frühere Aussage „existieren nicht auf der Platte / nur Artefakte / nicht mehr suchen" ist **überholt und ungültig**.

## Explizit erlaubte neueste Referenzen
Ordner: `docs/project/linie/ui/`
- `KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html` — Werkstatt (Kontroll-Home „Heute sichern").
- `KREILE_STARTSEITE_ROLF_V8_2026-08-20.html` — „Der Tag".
- `KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html` — Auftragskarte.
- `KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html` — Kundenkarte.
- Nichtautoritative Erläuterung zu kanonisch/verworfen: `ui/00_UI_REFERENZ_KANONISCH.md`.

## Quellenordnung (D-UI-DS-001, Owner 2026-10-06)

Diese vier HTML-Dateien bestimmen Seite, Layout und Flow und bleiben unverändert.
Das Designsystem V1.1 (`designsystem_v1_1`) bestimmt Tokens und Komponenten; seine
`SHA256SUMS.txt` hat SHA-256
`71b0cb01f484beef042cfd04d31f951d2db2d441c427f8212f35a8d41a8041e5` und enthält
55 Datei-Einträge plus eine Kommentarzeile. Bei einem Konflikt entscheidet die
Seitenreferenz über Seitenlayout und Ablauf, V1.1 über Tokens und Komponenten.
Versionsname, Datum, Screenshot, HTML-Titel oder eine andere Mockdatei übersteuern
das nie. V2/V3/V4 und der V5-Gesamtmock sind keine alternative Token-, Komponenten-
oder Seitenwahrheit und kein Bauinput; `ui/CURRENT_DESIGN_REFERENCE.json` und
`ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` bleiben nur als Provenienz erhalten.
V1.1 ist noch nicht nach `ui/` importiert; der Import ist `KR-10b` vorbehalten.

Maschinenlesbarer Vertrag (identisch in `quality/authoritative-sources.json` und
im Entscheidungsregister, vom Authority-Gate erzwungen):

```text
DESIGNSYSTEM_CONTRACT.id=designsystem_v1_1
DESIGNSYSTEM_CONTRACT.version=1.1
DESIGNSYSTEM_CONTRACT.role=TOKEN_AND_COMPONENT_TRUTH
DESIGNSYSTEM_CONTRACT.manifestFile=SHA256SUMS.txt
DESIGNSYSTEM_CONTRACT.manifestSha256=71b0cb01f484beef042cfd04d31f951d2db2d441c427f8212f35a8d41a8041e5
DESIGNSYSTEM_CONTRACT.manifestEntryCount=55
DESIGNSYSTEM_CONTRACT.pageReferenceRole=PAGE_LAYOUT_FLOW_TRUTH
DESIGNSYSTEM_CONTRACT.pageReferenceCount=4
DESIGNSYSTEM_CONTRACT.conflictPageLayoutFlow=PAGE_REFERENCES
DESIGNSYSTEM_CONTRACT.conflictTokensComponents=DESIGNSYSTEM_V1_1
DESIGNSYSTEM_CONTRACT.aggregateMockRole=NOT_BUILD_INPUT
DESIGNSYSTEM_CONTRACT.importStatus=NOT_IMPORTED_BEFORE_KR_10B
```

Keine andere HTML-, Screenshot-, Mockup- oder Designdatei ist UI-Wahrheit. Änderungen an dieser Bindung sind eine Produktentscheidung im Entscheidungsregister.

Demo-Daten darin (Mustermann, 300 SL …) sind Design-Demo — **nie** als Produktdaten (kein Mock).

## Verbindliche Nachbarschaft (zuerst lesen)
- `ARCHITEKTUR_MODULE_PATH1.md` — WIE gebaut wird (Module, fünf CI-Nähte).
- `MODULKARTE_KANON.md` — WAS es gibt (Module) und WAS entfällt/Quarantäne.
- `ui/00_UI_REFERENZ_KANONISCH.md` — ergänzende Referenzhinweise ohne eigene UI-Wahrheit.

## Verweis
LINIE: D-ARCH-008 (Path 1), D-ARCH-009 (Modulkarte). Register: `KREILE_LINIE_ENTSCHEIDUNGSREGISTER_2026-08-28.md`.

## Verfahren für eine spätere Designreferenz

Eine neue Ablaufreferenz wird nur nach ausdrücklicher Owner-Bestätigung mit
Repo-Pfad und SHA-256 gebunden. Der Pointer wird vor jeder internen Etappe, vor
jeder Browserabnahme und vor jedem Draft-PR erneut gegen die Datei geprüft; ein
Hashwechsel wird dokumentiert. Versionsnummer, Datum oder HTML-Titel entscheiden
niemals automatisch über den Kanon.
