# KREILE — KANONISCHE UI-REFERENZ (verbindlich, im Repo eingefroren)

Stand 2026-09-06. Dies ist die EINZIGE gültige UI-Wahrheit für Kreile. Sie liegt bewusst im Repo (`02_app/docs/project/linie/ui/`), damit PL und Writer sie sehen. Alte Entwürfe außerhalb dieses Ordners sind NICHT Quelle der Wahrheit und dürfen nicht als Vorlage dienen.

## Kanonisch (genau diese Dateien)
- `KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html` — Startseite Phillip „Werkstatt".
- `KREILE_STARTSEITE_ROLF_V8_2026-08-20.html` — Startseite Rolf „Der Tag".
- `KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html` — Auftragskarte.
- `KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html` — Kundenkarte.

## Phillip-Startseite V4 = „Kontroll-Home", NICHT Produktionsband
MUSS: Held „Heute sichern" (Aufträge nach Fälligkeit, je Karte Aktion) · proaktiver Bündel-Vorschlag (Zink/Sammellauf) · „In Arbeit" als EINE ruhige Menge (eine WIP-Kachel) · generischer Primärgriff „Auftrag öffnen/scannen" → Picker → Mehrarbeit / fertig=Freeze · feste Navy-Aktionsleiste unten (Auftrag öffnen/scannen · Mehrarbeit · Fertig melden · Neuer Eingang · Ware raus) · KEIN Geld auf der Startseite. Bäder/Bereiche liegen eine Ebene TIEFER, nie auf der Startseite.

## VERWORFEN — nie bauen (Design-Chat: „Entfernt (falsch)")
- Transport-/Stationsband als Startseite: Wareneingang → Galvanik → Warenausgang mit „Station öffnen".
- Transport-Kanban „Als Nächstes → im Bad → fertig".
- „In Galvanik starten" / separater Start-Klick.
- Bad-Sprache auf der Startseite. Zweites Designsystem / nicht abgestimmter Dark-Mode.

## Regel für jeden UI-PR (PL-Gate)
Jeder Kreile-UI-PR wird gegen genau diese Referenzen geprüft. Enthält die Startseite ein Stationsband/Transport-Home oder fehlt „Heute sichern" + Aktionsleiste → REVIEW_VERDICT: FAIL (mit Datei:Zeile). Grün in der CI ist NICHT genug; Designtreue ist Teil der Abnahme.

## Designsystem
Tokens: Navy/Cream/Brand-Verlauf, Fraunces (Serif) + Inter, Touch 48px. Ein Designsystem, kein Fork. Referenz-HTMLs oben sind maßgeblich.
