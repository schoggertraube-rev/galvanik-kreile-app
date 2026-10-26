# Abgabe P2 – Tagesstand

Stand: 26.10.2026, 17:32 Uhr (Europe/Berlin)

## Kandidat

- Branch: `kreile/s1-p2-eingang`
- Aktueller Produkt-SHA: `5cb2d56e4eeb17d02681ab9ae78848855dfed127`
- Letzter nachweislich fertiger Preview-SHA: `e828459fc4eb255194ddaf89528657f1d60c6f73`
- Klickbare Preview: <https://galvanik-kreile-werkstatt-4lc7lwaoj.vercel.app> (`Ready`, Preview)
- Aktuelles Deployment für `5cb2d56e`: <https://galvanik-kreile-werkstatt-qmqi196nn.vercel.app> (`Building` um 17:32 Uhr; noch kein Erfolgsclaim)
- Pull Request: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154> (Draft, nicht gemergt)
- Datenbank: Entwicklungsprojekt `syhaigjhsbpjmtnggqka`; Repository und Remote bis Migration `20261026190000_s1_p2_feature_switch.sql`. P2 fügt keine Migration hinzu.

## Umfang

| ID | Stand | Sichtbar / Nachweis |
|---|---|---|
| S04 Stufen-Schalter | gebaut | `/settings` → „Stufen-Schalter“; Stufe 1 an, Stufen 2–4 aus |
| A07 Angebot/KV | gebaut | Anlegen → KV: echte Katalogleistungen, gespeicherter KV, PDF, Zuschlag mit bestätigtem Liefertermin |
| E03 Foto/Dokument | gebaut | Kunden- und Auftragskarte: privater Upload, sicherer Download, echte leere/Fehlerzustände |
| E04 Dokument lesen | gebaut, Zugang offen | Dokument „Auslesen“ → Vorschläge mit Seite, Polygon und Sicherheit; keine Vorauswahl; Übernahme erst nach Auswahl. Ohne Azure-Werte „In Klärung“ |
| E05 Outlook-Mail rein | gebaut, Zugang offen | Kunden-/Auftragskarte: Outlook-Eingang, Mail und unterstützte Datei-Anhänge privat am Vorgang ablegen, aus Mail Kunden- oder KV-Dialog öffnen. Ohne Graph-Werte „In Klärung“ |
| R02 Mail raus | gebaut, Zugang offen | Mail an die beim Kunden gespeicherte Adresse, optional mit echtem KV-PDF; lokale Vorgangskopie erst nach Graph-Annahme. Rechnung/Lieferschein folgen mit deren P4-Dokumenten |
| A08 Anbieter-Register | gebaut | Kunden, Aufträge, Angebote, Rechnungen, Dokumente, Mails und Termine sind als unabhängige Anbieter registriert |

## Neu gemacht

- KV-Positionen stammen aus dem aktiven Leistungskatalog; Oberfläche, Einheit und Nettopreis sind daraus schreibgeschützt übernommen.
- KV-PDF wird aus gespeicherten Firmen-, Kunden- und KV-Daten erzeugt. Ein Zuschlag erzeugt genau einen Auftrag und verlangt einen bestätigten Auftragstermin.
- Dokumente/Fotos liegen privat im bestehenden `scans`-Bucket. Dateityp, Größe, Signatur und SHA-256 werden vor Finalisierung geprüft.
- Graph-Zugang nutzt ausschließlich serverseitige Client-Credentials. Ausgehende Mails werden gegen Doppelversand gesperrt; ein unklarer Ausgang wird nicht still wiederholt.
- PDF-, JPG-, PNG- und WebP-Anhänge eingehender Outlook-Mails werden mit stabiler Quellkennung, Größen-/Hashprüfung und ohne öffentliche Ablage in den bestehenden privaten Dokumentweg übernommen. Inline- und nicht unterstützte Formate werden sichtbar ausgelassen.
- Azure-Ergebnisse werden als Vorschläge mit Fundstelle und Konfidenz gespeichert. Kein Vorschlag ist standardmäßig ausgewählt.
- Die Suche liest Dokumente, lokale Mailkopien und Termine tenantgebunden aus den vorhandenen Tabellen. Die Suchleiste selbst brauchte keine Änderung.

## Abweichungen / nicht geschafft

- Microsoft Graph und Azure sind im Produkt vollständig fail-closed angebunden, aber am aktuellen Preview-SHA noch nicht mit realen Providerwerten belegt. Daher kein Claim für echten Versand, echten Inbox-Inhalt oder echte OCR-Antwort.
- Die reine Vercel-Namensprüfung am 26.10.2026 ergab: Keiner der sechs freigegebenen Graph-/Azure-Variablennamen ist derzeit in Preview angelegt. Es wurden keine Werte gelesen oder ausgegeben; die exakten fehlenden Namen stehen in `OWNER_TODO.md`.
- R02 unterstützt im P2-Stand das vorhandene KV-PDF. Rechnung und Lieferschein werden erst mit den kanonischen P4-Dokumenten auswählbar.
- Der vollständige lokale Commit-Hook überschritt sein Werkzeugzeitfenster. Gezielte Tests, TypeScript, Lint und Modulgrenzen sind grün; der Gesamtlauf erfolgt in GitHub CI.
- Die nicht von Codex stammende Änderung an `_review/DEZEMBER_LISTE.md` blieb ungestaged und unverändert.

## Prüfung am Produkt-SHA

- TypeScript: grün.
- Gezielte Tests: Graph 3/3, Azure 3/3, P2-Suche 33/33 sowie betroffene UI-/Flow-Tests grün.
- ESLint der geänderten Dateien: grün.
- `quality:module-gates`: grün.
- `git diff --check`: grün.
- Vercel für `e828459f`: `Ready`. GitHub `agentur-gate` und Vercel für `5cb2d56e`: um 17:32 Uhr noch laufend.
- Kein Merge nach `main`, kein Production-Deployment, keine Kostenaktivierung und keine Remote-Datenmutation durch diese P2-Produktcommits.
- Der Preview-Anmeldecode wurde nur flüchtig verwendet und nirgends gespeichert.

## Owner-Abnahme (5 Minuten)

1. Preview als Rolf öffnen, einen Kunden und dessen Kundenkarte wählen – erwartet: „Fotos & Dokumente“ und „E-Mail am Vorgang“ sind sichtbar; fehlende Providerwerte zeigen ehrlich „In Klärung“.
2. Ein kleines PDF oder Foto hochladen und danach „Öffnen“ wählen – erwartet: privater Upload wird gelistet und über einen kurzlebigen Download geöffnet.
3. Anlegen → „Auftrag / KV anlegen“, Kunde und Katalogleistung wählen, KV sichern und „KV als PDF“ öffnen – erwartet: echtes PDF mit gespeicherten Daten.
4. Beim gesicherten KV einen Auftragstermin setzen und Zuschlag bestätigen – erwartet: genau ein Auftrag öffnet sich mit diesem Termin.
5. Globale Suche öffnen – erwartet: „Durchsucht“ nennt Kunden, Aufträge, Angebote, Rechnungen, Dokumente, Mails und Termine; Treffer öffnen ihren realen Kunden-/Auftragsbezug.

## Nächster Schritt

Aktuelles Deployment und CI bis zum exakten SHA belegen und die realen Preview-Verbindungen für Graph/Azure prüfen. Anschließend P2-Review am eingefrorenen Kandidaten-SHA; kein Merge ohne Owner-Freigabe.
