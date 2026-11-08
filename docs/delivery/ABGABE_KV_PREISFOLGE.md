# KV-Preisfolge U-246/247 — Zwischenabgabe

**Draft, noch keine Merge-Bitte.** Mehrpositionsregel angefragt im BAULOG 08.11. 10:24; bisher keine PL-Antwort gefunden. Keine neue Oberfläche.

## Fertiger eindeutiger Umfang

Eine gemeinsame Rechenfunktion im bestehenden Quote-Modul: Rüsten bleibt fest, Arbeitsstunden und Material werden mengenanteilig angepasst. Ganzzahlige Dezimalrechnung, keine Standardpreise oder zweite Preisablage. Textänderung verwendet den bestehenden Update-Writer; Warenpreis wird aus dem unveränderten Ursprungs-KV und dem tatsächlichen Warenbeleg gelesen. Öffentlicher Modul-Port statt Tiefimport.

Realer Vergleich: KV 4 Stück, 4 Stunden × 10 EUR, Rüsten 12 EUR, Material 9 EUR = 61 EUR. Sowohl „3 statt 4“ als auch echte Annahme von drei Stück ergeben 3 Stunden, Rüsten 12 EUR, Material 6,75 EUR = **48,75 EUR**. Folgeänderung auf fünf Stück ergibt 73,25 EUR.

## Nachweise

- Warenweg: echte Anlage/Zusage/Warenannahme/Auftragsanlage → DB/Ereignis/Auftragskarte/Kopiervorbereitung/Retry, PASS (7,84 s).
- Textweg: echte Erkennung/Vorschlag/Update → DB/Ereignis/KV-Leseport, einschließlich Preisziel/Termin/Zusage und Fehlergrenzen, PASS (7,26 s).
- Mehrpositionen mit einem Nullzugang: bestehender echter Vor-Ort-Fall bleibt PASS (7,82 s). Eine einzige gelieferte Position darf nicht mit einem ursprünglich einpositionigen KV verwechselt werden; Prüfung zählt die ursprünglichen KV-Positionen.
- Sechs gezielte Rechenfälle PASS, Typprüfung/gezieltes Lint/Diffprüfung PASS vor dem letzten engen Herkunfts-Zähler-Nachtrag; dessen finale Typ-/Lintprüfung folgt.
- Modulprüfung meldet ausschließlich bekannte fremde `DESIGN_POINTER_PAGE_BINDING` aus uncommitteter Planung, keine neue Modulverletzung.
- Keine Migration und keine Dev-/Produktionsdatenänderung. Replay-Daten isoliert und synthetisch.

## Offen

Mehrere Positionen mit verschiedenen Mengenfaktoren brauchen die verbindliche Verteilung des festen Rüstanteils; es gibt keine gespeicherten Ansätze pro Position. Vorschlag und Alternativen werden ausschließlich durch PL im BAULOG geklärt. Bis dahin bleiben diese bestehenden Mehrpositionswege unverändert; dieser Draft behauptet ihre Preisangleichung ausdrücklich nicht.

CI, READY-Preview exakt am finalen SHA, vorgeschriebener Sichtbeleg und PL-Diffprüfung werden nach der abschließenden Umsetzung ergänzt. Kein Merge durch Codex.
