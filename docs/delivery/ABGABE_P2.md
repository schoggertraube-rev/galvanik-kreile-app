# Abgabe P2 – erster sichtbarer Stand

Stand: 26.10.2026, 16:17 Uhr (Europe/Berlin)

## Kandidat

- Branch: `kreile/s1-p2-eingang`
- Exakter Produkt-SHA: `8e194f4c2a42c4e5d071d37dfa5bc72b75031516`
- Pull Request: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154> (Draft, nicht gemergt)
- Preview: <https://galvanik-kreile-werkstatt-dvelkzhv3.vercel.app>
- Vercel-Deployment: `dpl_n9vkg7jsDaC4WZsZuPLwr6LQutNv`, Status `Ready`, Funktionen in `fra1`
- Datenbank: Entwicklungsprojekt `syhaigjhsbpjmtnggqka`; Repository und Remote stehen auf Migration `20261026190000_s1_p2_feature_switch.sql`. Kein Reset, keine Löschung und keine Änderung an einer Produktionsdatenbank.

## Umfang

| ID | Stand | Sichtbar / Nachweis |
|---|---|---|
| S04 Stufen-Schalter | gebaut | `/settings` → „Stufen-Schalter“; Stufe 1 standardmäßig an, Stufen 2–4 aus |
| A08 Anbieter-Register | teilweise | Suche nimmt neue Anbieter ohne Änderung des Dialogs auf; Kunden, Aufträge, offene KVs und Rechnungen sind real angebunden |
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

## Abweichungen und offene Belege

- P2 ist noch nicht vollständig. A07, E03, E04, E05 und R02 sowie die A08-Anbieter für Dokumente, Mails und Termine sind offen. Der Angebotsanbieter umfasst derzeit den real vorhandenen offenen KV-Bestand.
- Die Standard-Schalter der Stufe 1 stehen gemäß Owner-Entscheid auf „An“, auch wenn das zugehörige P2–P5-Paket noch nicht abgenommen ist. Ein Schalter allein macht keine Funktion fertig.
- Der im Auftrag genannte Rolf-Code war in der Ausführung nur als maskiertes `[CODE]` verfügbar und wurde nicht gespeichert. Deshalb wurde die authentifizierte P2-Preview nicht als Rolf geklickt.
- Der geschützte Login wurde am exakten SHA mit kurzlebigem Vercel-OIDC-Zugang geprüft. Der erste Kaltaufruf bis zur sichtbaren Rollenauswahl dauerte 4,333 s, der direkte Wiederholungsaufruf 0,719 s. Die 2-s-Vorgabe ist warm erfüllt, kalt noch nicht.
- Screenshots der Rollenauswahl in 1914×917, 1220×880 und 390×844 liegen lokal unter `output/playwright/p2-8e194f4c/`. Authentifizierte Einstellungs-Screenshots folgen mit verfügbarem Produktzugang.
- Der lokale Commit-Hook überschritt zweimal das Werkzeugzeitfenster, ohne einen Abschluss auszugeben. Der exakte SHA wurde danach durch GitHub vollständig geprüft.

## Prüfstand am exakten SHA

- P2-Zieltests für S04: 45/45 grün; A08-Ausbau: 37/37 betroffene Tests grün.
- GitHub `agentur-gate`: grün; TypeScript, Delivery-Verträge und 1.021 Unit-Tests bestanden.
- Vercel: `Ready`; Funktionen in `fra1`.
- `git diff --check`: grün.
- Entwicklungsdatenbank: Migrationen lokal/remote identisch bis `20261026190000`.
- Kein Merge nach `main`, kein Production-Deployment.

## Owner-Abnahme (5 Minuten)

1. Preview öffnen und als **Gregor** anmelden – erwartet: Rollen-Home erscheint, `/settings` ist erreichbar.
2. **Einstellungen → Stufen-Schalter** öffnen – erwartet: Stufe 1 steht auf „An“, Stufen 2–4 auf „Aus“.
3. Einen Schalter der Stufe 2 kurz aktivieren, speichern und wieder deaktivieren – erwartet: beide Änderungen werden bestätigt und nach Neuladen korrekt gelesen.
4. Die globale Suche öffnen und nach einem vorhandenen Kunden, Auftrag, offenen KV oder einer Rechnung suchen – erwartet: Treffer öffnen die echte Zielansicht; „Durchsucht“ nennt nur die tatsächlich abgefragten Quellen.
5. Nach einem unbekannten Begriff suchen – erwartet: ehrlicher Leerzustand, keine erfundenen Treffer und kein Claim zu noch nicht angebundenen Quellen.

## Nächster Schritt

A08 erhält als Nächstes den Dokumentanbieter und später die realen Mail-/Termin-Anbieter. Parallel folgen A07 und E03. E04, E05 und R02 werden erst mit belegtem Azure-/Graph-Zugang verbunden; der Bau läuft bis dahin an den unabhängigen P2-Teilen weiter.
