# Vernetzung 04 – kritische Ablauf- und UI-Prüfung

07.11.2026 · **bestehende V04 korrigiert, keine neue Vorschauversion.**

## Ergebnis und Einordnung

**57 Prüfpunkte bestanden:** 18 vernetzte Abläufe, 11 Gegenfälle, 28 ergänzende Ablauf-/Darstellungsprüfungen. Das bedeutet bestanden für diese isolierten Tests, nicht „jede Kundensituation fehlerfrei“ oder Produktfreigabe.

Red-Team- und UI-Spezialist wurden jeweils angefordert; beide Starts scheiterten am Sitzungslimit. Deshalb getrennte adversarielle Ablauf- und UI-Selbstprüfung. **Keine unabhängige Agentenabnahme.**

Geprüfte HTML, SHA-256: `EE9DD32493D4B1A87F3A51E3134E9B75180358A9C70548E9F5128D22068C0CC4`.

## Nachgestellte Konflikte und kleine Korrekturen

| Vorher | Jetzt im selben V04-Stand |
|---|---|
| Geänderter, zuvor versendeter KV zeigte noch „Gesendete Fassung ansehen“. Hilfetext, Kopf und Status konnten zurückbleiben. | Neue Fassung, Status, Stunden/Preis-Begleitung und Button stimmen überein; erneuter Testversand derselben aktuellen Fassung. Fokus bleibt im Feld. |
| Mengenabweichung nur von der Rechnung aus. | Vergleich auch vom Lieferschein aus; beide Belege erreichbar. |
| Vergleich passender Belege bot trotzdem eine Rückfrage. | Rückkehr zum Ausgangsbeleg, keine künstliche Zusatzarbeit. |
| Neues Vergleichs-/Belegfenster war im Rückweg nicht bekannt. | Rücknavigation für die bestehenden Vernetzungsdialoge ergänzt; Kontext bleibt erhalten. |
| „Gesendete Rückfrage“ führte erneut in einen bearbeitbaren Versandentwurf. | Unveränderten gesendeten Text ansehen; neue Entwürfe getrennt. |
| Fehlendes Angebot bzw. mehrere Kontobelege hatten keine jeweils passende Hauptaktion. | Referenzbezogene Angebotsrückfrage bzw. Gegenüberstellung der Kontobelege. Keine erfundene Zahlung. |
| Rotes Plus im Postfach nicht rechts. | Gleicher rechts erreichbarer Eingang, weiterhin ein Klick. |
| Archiv verlinkte eine ältere Übergabe noch als neue. | V04 und aktuelle Markdown zusammen verlinkt und im selben Paket. Alte Fassungen als historisch bezeichnet. |

## Beobachtete Wege

- Anfrage → KV mit Sonderwunsch → Testversand → Nachricht wartet auf Antwort. Änderungen → neue Fassung → erneuter Versand.
- Rechnung → Lieferschein/Angebot → konkrete Abweichung → vorbereitete Rückfrage → gesendeter Verlauf → Beleg bleibt offen.
- Späterer Lieferschein und korrigierte Quellen aktualisieren Zusammenhang und Aufgaben.
- Falscher Lieferant, doppelte Referenz, Teilzahlung und mehrere Kontotreffer erzeugen keinen falschen eindeutigen Treffer.
- Werkstatt → zugehörige Terminfrage ohne erneute Suche. AZ-Korrektur ersetzt Tageswert statt zu addieren; Mehrarbeit bleibt direkt erreichbar.
- Mailansicht/Anliegen greifen auf dieselben Nachrichten zu; Nachricht/Beleg-Rückbezug bleibt nach Speicherung erhalten.
- Frischer Der-Tag-Hauptbereich gegenüber V03 identisch (9961 Zeichen). Keine neue Der-Tag-Oberfläche.

Details: `PRUEFUNG_Vernetzung04.json`. Skripte und Screenshots liegen im Arbeitsarchiv unter `03_PRUEFNACHWEISE/Vernetzung04_Abschlusspruefung/`.

## UI-Sichtprüfung

Eingang, KV, Werkstatt, Nachrichten und Belegvergleich visuell betrachtet; Breiten 1914, 1220 und 390 px. Kein Querüberlauf in den geprüften Ansichten. Hauptaktion im Belegdialog sichtbar am unteren Rand, mindestens 44 px hoch. Nachricht und ihre Handlung bleiben eine gemeinsame Fläche. Farben, Kachelkomposition und Kameraansicht nicht neu gestaltet.

Der Browser meldete im Abschlusslauf beim angeforderten Desktopmaß 1914 × 917 tatsächlich 1914 × 918; Tablet 1220 × 880 und Mobil 390 × 844. Dies ist **keine** formale Produkt-Viewport-Abnahme. Lange Eingaben auf 390 px benötigen Scrollen; kein Nachweis für echte Bildschirmtastatur, Touchhardware oder Kamerawechsel. Diese Einschränkung wird nicht als behoben ausgegeben.

Konsole im geprüften Browserlauf: 0 Fehler, 0 Warnungen.

## Nicht behauptet

Keine produktive KI/OCR, E-Mail-, Bank-, Buchhaltungs- oder Handyverbindung. Kein beliebiger Mehrpositions-/Sammellieferungsabgleich. Keine geprüfte Mehrbenutzer-/Offline-Synchronisierung. Kunden-/Auftrags-/Teilkarten in der HTML bleiben gekennzeichnete Testkarten: **Claude muss die bestehenden Endversionskarten anschließen, nicht diese kopieren.**

Produktrepository nur gelesen. V03 und ältere HTMLs unverändert. V04 vor Korrektur gesichert unter `02_ARCHIV/Vernetzung04_vor_Abschlusspruefung_2026-11-07/`. Änderungen bleiben eine Bedienreferenz; Claude entscheidet im vorhandenen Produkt- und Paketrahmen.
