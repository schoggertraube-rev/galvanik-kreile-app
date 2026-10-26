# Abgabe P2 – erster sichtbarer Stand

Stand: 26.10.2026, 16:52 Uhr (Europe/Berlin)

## Kandidat

- Branch: `kreile/s1-p2-eingang`
- Exakter Produkt-SHA: `2256d9b1b7d748c46c861edbb7af7336b6b43dc1`
- Pull Request: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154> (Draft, nicht gemergt)
- Preview: <https://galvanik-kreile-werkstatt-iij4008sb.vercel.app>
- Vercel-Deployment: `dpl_6k4gz5WWsFjkhHZ8myWSVdJD9whD`, Status `Ready`, Funktionen in `fra1`
- Datenbank: Entwicklungsprojekt `syhaigjhsbpjmtnggqka`; Repository und Remote stehen auf Migration `20261026190000_s1_p2_feature_switch.sql`. Kein Reset, keine Löschung und keine Änderung an einer Produktionsdatenbank.

## Umfang

| ID | Stand | Sichtbar / Nachweis |
|---|---|---|
| S04 Stufen-Schalter | gebaut | `/settings` → „Stufen-Schalter“; Stufe 1 standardmäßig an, Stufen 2–4 aus |
| A08 Anbieter-Register | teilweise | Sichtbarer Sucheinstieg und Strg K in der aktiven Shell; Kunden, Aufträge, offene KVs und Rechnungen sind real angebunden |
| A07 Angebot/KV | nein | noch kein Katalog-/PDF-/Zuschlagsausbau in P2 |
| E03 Foto/Dokument | nein | noch nicht an Kunde und Auftrag angebunden |
| E04 OCR | nein | kein belegter Azure-Zugang; keine simulierte Erkennung |
| E05 Outlook-Mail rein | nein | kein belegter Graph-Zugang; keine simulierte Mailquelle |
| R02 Mail raus | nein | kein belegter Graph-Zugang; kein Versandclaim |

## Gebaut

- `public.tenant_features` ist tenantgebunden, per RLS abgesichert und enthält alle IDs des Bauumfangs.
- Rolf (`meister`), Gregor (`admin`) und `developer` dürfen die Stufen-Schalter rollenbasiert pflegen.
- Die ausgegrauten V8-Anschlussstellen „Zahlen“ und „Material & Einkauf“ lesen den Schalter fail-closed. Sie bleiben ohne gebaute Zielroute deaktiviert und werden nicht als fertige Funktion ausgegeben.
- Die Suche besitzt ein validiertes, erweiterbares Anbieter-Register. Fehlerhafte oder ausfallende Anbieter liefern keine Teilwahrheit.
- Die Suchoberfläche zeigt „Durchsucht: …“ ausschließlich für echte, im jeweiligen Aufruf ausgeführte Quellen. Aktuell sind Kundenstamm, Auftragsbestand, offene Angebote und – rollenabhängig – Rechnungen angebunden.
- Rolf erreicht `/settings` auch dann, wenn noch keine Firmendatenzeile gespeichert ist. Das Formular zeigt dann einen ehrlichen leeren Entwurf; erst bewusstes Speichern legt den Datensatz an.
- Der Stundensatz für Mehrarbeit ist in den Firmeneinstellungen pflegbar. Eine Zahlung wird erst nach Auswahl von Bar, Überweisung oder Karte gebucht; das Antippen der Ortskette bucht nicht mehr still als Überweisung.

## Abweichungen und offene Belege

- P2 ist noch nicht vollständig. A07, E03, E04, E05 und R02 sowie die A08-Anbieter für Dokumente, Mails und Termine sind offen. Der Angebotsanbieter umfasst derzeit den real vorhandenen offenen KV-Bestand.
- Die Standard-Schalter der Stufe 1 stehen gemäß Owner-Entscheid auf „An“, auch wenn das zugehörige P2–P5-Paket noch nicht abgenommen ist. Ein Schalter allein macht keine Funktion fertig.
- Der Rolf-Zugang wurde ausschließlich flüchtig im geschützten Browserlauf verwendet und weder im Repository noch in der Abgabe gespeichert.
- Am exakten SHA wurden gemessen: `/start` bis Rollenauswahl 0,456 s, Rolf-Login bis Rollen-Home 0,992 s, Klick auf Einstellungen bis sichtbare Seite 0,264 s. Alle drei Messungen liegen unter 2 s.
- Authentifizierte Screenshots für Rollen-Home und Stufen-Schalter in 1914×917, 1220×880 und 390×844, Such-Leerzustand, realen Treffer und geöffnete Zielkarte liegen lokal unter `output/playwright/p2-2256d9b1/rolf/`.
- Der Rolf-Weg wurde am exakten SHA vollständig geklickt: Login, Einstellungen, R06 aktivieren, R06 deaktivieren, Reload mit R06 = Aus, Strg K, Suche ohne Treffer sowie Suche nach einem vorhandenen Namen mit zwei realen Treffern und geöffneter Auftragskarte. Alle Prüfpunkte sind `PASS`; keine Teständerung blieb aktiv.
- Der lokale Commit-Hook überschritt das Werkzeugzeitfenster, ohne einen Abschluss auszugeben. Der exakte SHA wurde danach durch GitHub vollständig geprüft.

## Prüfstand am exakten SHA

- Gezielter Prüfstand: 85/85 Tests grün, einschließlich realer Modulgrenzen; TypeScript grün.
- GitHub `agentur-gate` am exakten Produkt-SHA ist grün; TypeScript, Delivery-Verträge und 1.025/1.025 Unit-Tests bestanden.
- Vercel: `Ready`; Funktionen in `fra1`.
- `git diff --check`: grün.
- Entwicklungsdatenbank: Migrationen lokal/remote identisch bis `20261026190000`.
- Kein Merge nach `main`, kein Production-Deployment.

## Owner-Abnahme (5 Minuten)

1. Preview öffnen und als **Rolf** anmelden – erwartet: Rollen-Home erscheint, `/settings` ist erreichbar.
2. **Einstellungen → Stufen-Schalter** öffnen – erwartet: Stufe 1 steht auf „An“, Stufen 2–4 auf „Aus“.
3. Einen Schalter der Stufe 2 kurz aktivieren, speichern und wieder deaktivieren – erwartet: beide Änderungen werden bestätigt und nach Neuladen korrekt gelesen.
4. Die globale Suche öffnen und nach einem vorhandenen Kunden, Auftrag, offenen KV oder einer Rechnung suchen – erwartet: Treffer öffnen die echte Zielansicht; „Durchsucht“ nennt nur die tatsächlich abgefragten Quellen.
5. Nach einem unbekannten Begriff suchen – erwartet: ehrlicher Leerzustand, keine erfundenen Treffer und kein Claim zu noch nicht angebundenen Quellen.

## Nächster Schritt

A08 erhält als Nächstes den Dokumentanbieter und später die realen Mail-/Termin-Anbieter. Parallel folgen A07 und E03. E04, E05 und R02 werden erst mit belegtem Azure-/Graph-Zugang verbunden; der Bau läuft bis dahin an den unabhängigen P2-Teilen weiter.
