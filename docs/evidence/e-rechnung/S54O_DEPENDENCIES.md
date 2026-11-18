# S54o – PDF-/Schrift-Abhängigkeiten

Freigabe: `_review/pakete/S54o_AUSGANG.md` C11, PL 18.11. 12:03. Dieser technische Nachweis ist keine Projektsteuerung und keine fertige E-Rechnungsabnahme.

- `pdf-lib` **1.17.1**, MIT, exakt gepinnt. [Quelle/Lizenz](https://github.com/Hopding/pdf-lib/tree/v1.17.1). Dient im bestehenden Rechnungsweg dem Hybrid-Container; keine eigene Nummern-, Daten- oder Versandwahrheit.
- `@pdf-lib/fontkit` **1.1.1**, MIT, exakt gepinnt. [Offizielle Paketquelle](https://github.com/Hopding/fontkit). Glyphprüfung/Schrifteinbettung; keine neue Auth-Struktur.
- Liberation Sans **2.1.5**, Regular/Bold, unveränderte offizielle Binärdateien; SIL OFL 1.1 unter `public/pdf/invoice/LIBERATION-OFL.txt`. [Offizieller Release](https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5). Private Familie `KreileInvoiceLiberationSans` betrifft nur die vorhandenen Rechnungs- und Stornodokumente; andere PDF-Renderer bleiben unverändert.
- sRGB-ICC aus Apache FOP (Ressource im offiziellen Mustang-CLI 2.26.0), ZLIB-Lizenz unter `public/pdf/invoice/SRGB-LICENSE-ZLIB.txt`.
- Exakte Asset-SHAs/Quellen unter `public/pdf/invoice/SOURCES.json`.

Upgrade nur mit allen im freigegebenen Schritt-Blatt genannten Abnahmefällen und externem PDF/A-Einzelergebnis. Die Aufnahme der Dateien allein ist weder PDF/A-/ZUGFeRD-PASS noch eine Änderung bereits gespeicherter Rechnungsoriginale. Aufbewahrung und vollständige Verfahrensdokumentation werden mit der tatsächlichen Writer-Anbindung vervollständigt.

## Laufender technischer Nachweis (noch keine S54o-Abnahme)

- A9 hat einen tatsächlichen offenen Font-/Abnahmewiderspruch: U+00B7 ist in Helvetica 278/1000 breit, in unveränderter Liberation Sans 2.1.5 rund 333/1000. An einer echten TEST-Rechnung bleibt eine Seite mit allen Inhalten erhalten, ein Mittelpunkt bricht jedoch anders um. PL-Frage 18.11.12:30:05; keine Metrik-/Layout-/Erwartungsänderung durch Codex.
- C9: Bestehende `contract_version=1`-Originale in `public.invoices` sind durch Update-/Delete-Trigger gegen Überschreiben/Löschen geschützt. Zwei echte SQL-Grenzproben unter service_role an einer über Action/Auth ausgestellten TEST-Rechnung ergeben 23514/INVOICE_IMMUTABLE, alle Versuche zurückgerollt und Original-SHA unverändert. Der aktive BEFORE-TRUNCATE-Trigger wurde gelesen; kein tabellenweites TRUNCATE ausgeführt. Die bestehenden breiten service_role-Grants wurden nicht verändert. Keine neue Migration nötig; dies ist ein TEST-Guard-Nachweis, keine neue Production-/Sicherungs-/GoBD-Abnahme.
- S54o C9 fordert unveränderte Aufbewahrung mindestens acht Jahre ab Ende des Ausstellungsjahres. Es wurde keine automatische Löschung nach Fristablauf ergänzt. Der endgültige Hybrid-Writer, die Aufbewahrung im produktiven Betrieb und die Verfahrensdokumentation bleiben Teil des noch offenen Schritts.
- C15: Derselbe Fontbestand wird zur Zeichenprüfung vor der Nummernvergabe bzw. vor dem neuen Stornobeleg benutzt. Fehlende Zeichen werden nicht als Ersatzzeichen gespeichert. Die endgültigen Feldtexte/Knopfbindungen sind noch offen; der zentrale R8-Schlüssel `invoice.glyph_missing` ist ausdrücklich TODO_PL.
