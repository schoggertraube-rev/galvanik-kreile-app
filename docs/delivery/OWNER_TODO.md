# Owner-TODO – Verkaufsstufe 1

Stand: 25.10.2026

## P1 · aktive Quellen im Quality-Gate

- Blocker: `npm run quality:module-gates` akzeptiert vier aktive Lieferdateien noch nicht (`ABGABE_P0.md`, `KREILE_BAUUMFANG_STUFEN.html`, `KREILE_CODEX_BAUAUFTRAG_STUFE1.md`, `OWNER_TODO.md`). Das Produktmodul-Gate selbst meldet keine weitere Verletzung; die dafür zuständige Governance-/Checker-Datei ist im P1 ausdrücklich gesperrt.
- Genau ein Schritt für den Owner: Eine gesonderte Freigabe erteilen, den bestehenden Authority-Checker auf die am 25.10.2026 autorisierte Bauquelle umzustellen.
- Empfehlung: Diese reine Quellenregister-Korrektur vor der P1-Abnahme zulassen; keine weitere Governance- oder Planänderung damit verbinden.

## P1 · neue Nutzer anlegen

- Blocker: Die Laufzeit lässt ausschließlich die drei fest gebundenen Produktprofile Rolf, Phillip und Gregor zu. Ein zusätzlich angelegter Nutzer könnte sich deshalb trotz Datensatz nicht als Produktakteur autorisieren. Eine Umsetzung würde das gesperrte Auth-/Rollen-/Sessionmodell ändern.
- Genau ein Schritt für den Owner: Bestätigen, dass S03 in Stufe 1 auf Rollen-, PIN- und Sperrpflege der bestehenden drei Nutzer begrenzt bleibt.
- Empfehlung: Neue Nutzeranlage auf eine ausdrücklich freigegebene spätere Auth-Erweiterung verschieben; in P1 bleibt die Stelle ehrlich als „In Klärung“ ausgegraut.
