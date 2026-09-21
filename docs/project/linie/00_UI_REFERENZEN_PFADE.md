# 00 · UI-REFERENZEN — EINZIGE UI-WAHRHEIT

Status: `AUTHORITATIVE_UI_REFERENCE_INDEX`
Stand: 2026-09-20 · D-GOV-001 · D-UI-V6-001

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
`ui/KREILE_UI_BIBEL_V6_2026-09-20.html` mit SHA-256
`545E3139163615AEDDF1772AAD102C0A63597897E2B667A8B79C971359A43BD0`.
V2/V3/V4/V5-Gesamtmocks sind superseded und kein Bauinput. Interne HTML-Titel
sind Metadatenaltlasten und kein Produkttext.

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
