# 00 · UI-REFERENZEN — EINZIGE UI-WAHRHEIT

Status: `AUTHORITATIVE_UI_REFERENCE_INDEX`
Stand: 2026-09-14 · D-GOV-001 · D-UI-V5-001

> **STAND 2026-09-06:** Die vier kanonischen UI-Referenzen sind jetzt als HTML-Dateien **im Repo eingefroren** unter `docs/project/linie/ui/`. Die frühere Aussage „existieren nicht auf der Platte / nur Artefakte / nicht mehr suchen" ist **überholt und ungültig**.

## Explizit erlaubte neueste Referenzen
Ordner: `docs/project/linie/ui/`
- `KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html` — Werkstatt (Kontroll-Home „Heute sichern").
- `KREILE_STARTSEITE_ROLF_V8_2026-08-20.html` — „Der Tag".
- `KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html` — Auftragskarte.
- `KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html` — Kundenkarte.
- Nichtautoritative Erläuterung zu kanonisch/verworfen: `ui/00_UI_REFERENZ_KANONISCH.md`.

Diese vier Dateien bleiben die unveränderte Seitenwahrheit. Zusätzlich bindet
`ui/CURRENT_DESIGN_REFERENCE.json` genau eine aktuelle Ablauf-/Zwischenschritt-Referenz:
`ui/KREILE_GESAMTMOCK_V5_2026-09-14.html` mit SHA-256
`75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`.
V2/V3/V4-Gesamtmocks sind superseded und kein Bauinput. Der interne HTML-Titel
der V5 ist Metadatenaltlast und kein Produkttext.

Keine andere HTML-, Screenshot-, Mockup- oder Designdatei ist UI-Wahrheit. Änderungen an dieser Bindung sind eine Produktentscheidung im Entscheidungsregister.

Demo-Daten darin (Mustermann, 300 SL …) sind Design-Demo — **nie** als Produktdaten (kein Mock).

## Geteilte UI-Wahrheit ab D-UI-CORE-003

Die vier oben genannten, im Repo eingefrorenen HTML-Dateien bleiben die
`PAGE_AND_FLOW_TRUTH`. Der bereits hashgebundene V5-Ablaufpointer bleibt die
zusaetzliche Ablauf-/Zwischenschritt-Referenz. Fuer Layout, Seitenaufbau,
Informationshierarchie, Nutzerfluss und responsive Anordnung gilt daher
`LAYOUT_FLOW_FROM_CANONICAL_REFERENCES`.

Die freigegebene Quelle
`../_DESIGN_VERBINDLICH/designsystem_v1_1` ist davon getrennt die
`TOKEN_AND_COMPONENT_TRUTH`. Gebunden sind:

- `SHA256SUMS.txt`: 55 Eintraege, SHA-256
  `71B0CB01F484BEEF042CFD04D31F951D2DB2D441C427F8212F35A8D41A8041E5`.
- Der bytegleiche Repository-Lock
  `docs/project/linie/ui/DESIGN_SYSTEM_V1_1_SHA256SUMS.txt` traegt denselben
  SHA-256 und macht die Quellenbindung auch in CI ohne den externen
  Schwesterordner pruefbar. Ist die externe Quelle lokal vorhanden, muss sie
  vollstaendig vorliegen und wird fuer alle 55 Pfade physisch nachgespielt;
  ein nur teilweise vorhandenes externes Quellenbuendel ist unzulaessig.
- `../_DESIGN_VERBINDLICH/FREIGABE_DS_V1.txt`: SHA-256
  `D8D95F8E48CDB02C5A4F7BB8A4C07F2658EA32D1B7753A912BBA91C97013FC25`.
- `../_DESIGN_VERBINDLICH/PRUEFUNG_DESIGN_V1_1_2026-09-27.md`: SHA-256
  `D6435C10D6F24699FEB97B408DD4BB8F6C59ED7C374B1627F5D720CF66245257`.

Bei einem Konflikt gilt ohne weitere Auslegung:
`TOKENS_COMPONENTS_FROM_DESIGN_SYSTEM_V1_1`, aber
`LAYOUT_FLOW_FROM_CANONICAL_REFERENCES`. Das Designsystem darf keine
Seiten-/Flowentscheidung ueberschreiben; eine Seitenreferenz darf keine zweite
Token- oder Komponentenwahrheit erzeugen. Dieses Paket bindet nur die Quelle:
`NOT_IMPORTED_UNTIL_KR_10B`. Der physische Import nach `ui/`, die dort
freigegebenen Auflagen und jede Produktverdrahtung gehoeren ausschliesslich in
`KR-10B-DESIGN-SYSTEM-IMPORT`.

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
