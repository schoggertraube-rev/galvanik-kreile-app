# S54o – PDF-/Schrift-Abhängigkeiten

Freigabe: `_review/pakete/S54o_AUSGANG.md` C11, PL 18.11. 12:03. Dieser technische Nachweis ist keine Projektsteuerung und keine fertige E-Rechnungsabnahme.

- `pdf-lib` **1.17.1**, MIT, exakt gepinnt. [Quelle/Lizenz](https://github.com/Hopding/pdf-lib/tree/v1.17.1). Dient im bestehenden Rechnungsweg dem Hybrid-Container; keine eigene Nummern-, Daten- oder Versandwahrheit.
- `@pdf-lib/fontkit` **1.1.1**, MIT, exakt gepinnt. [Offizielle Paketquelle](https://github.com/Hopding/fontkit). Glyphprüfung/Schrifteinbettung; keine neue Auth-Struktur.
- Liberation Sans **2.1.5**, Regular/Bold, unveränderte offizielle Binärdateien; SIL OFL 1.1 unter `public/pdf/invoice/LIBERATION-OFL.txt`. [Offizieller Release](https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5). Private Familie `KreileInvoiceLiberationSans` betrifft nur die vorhandenen Rechnungs- und Stornodokumente; andere PDF-Renderer bleiben unverändert.
- sRGB-ICC aus Apache FOP (Ressource im offiziellen Mustang-CLI 2.26.0), ZLIB-Lizenz unter `public/pdf/invoice/SRGB-LICENSE-ZLIB.txt`.
- Exakte Asset-SHAs/Quellen unter `public/pdf/invoice/SOURCES.json`.

Upgrade nur mit allen im freigegebenen Schritt-Blatt genannten Abnahmefällen und externem PDF/A-Einzelergebnis. Die Aufnahme der Dateien allein ist weder PDF/A-/ZUGFeRD-PASS noch eine Änderung bereits gespeicherter Rechnungsoriginale. Aufbewahrung und vollständige Verfahrensdokumentation werden mit der tatsächlichen Writer-Anbindung vervollständigt.
