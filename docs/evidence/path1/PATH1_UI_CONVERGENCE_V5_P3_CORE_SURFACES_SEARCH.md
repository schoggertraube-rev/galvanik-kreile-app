# Path 1 V5 P3 — Kernflächen und Lane-0-Suche

Stand: 2026-09-16

Branch: `path1/v5-p3-core-surfaces-search-20260916`

Basis: `70ae0989b7f76a247c34582badc2de3324e27851`

Status: lokaler Produkt-, Fresh-DB- und Browservertrag bestanden; Exact-SHA-CI, Preview und unabhängige Prüfung stehen bis zum Push aus. Dies ist kein Gesamt-UI-PASS.

## Kanonische Bindung

- Pointer: `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json`
- Aktuelle Ablaufreferenz: `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`
- Pointer- und Datei-SHA-256: `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`
- Seitenwahrheit: die vier unveränderten Einzelreferenzen aus `docs/project/linie/00_UI_REFERENZEN_PFADE.md`

## Gelieferter vertikaler Vertrag

1. Orders V8 nutzt eine Kartenwahrheit für Liste, Overlay und Deep-Link. Identität, Kunde, Termin/Risiko, Lifecycle, Teile, Verlauf und reale Aktionsgrenzen stammen aus dem bestehenden tenantgebundenen Read-Port.
2. Customers V2 nutzt dieselbe Kundenkarte für Liste, Overlay und Deep-Link. Aktive Aufträge öffnen dieselbe V8-Auftragskarte; Zurück/Schließen erhält den Overlay-Stack.
3. Rolf und Phillip lesen reale öffentliche Projektionen. Priorität und nächste Handlung werden nur aus persistiertem Risiko, Termin, Station und Status abgeleitet; es gibt keine Demo-KPI oder Schattenwahrheit.
4. Die Lane-0-Suche prüft ausschließlich die berechtigten Orders-/Customers-Read-Ports. Sie verursacht keine Modell-, Internet- oder Providerkosten (`metered_cost=0`), nennt Quelle, Trefferfeld, Zusammenhang und Datenstand und öffnet die V8-/V2-Karten im vorhandenen Backstack.
5. Ein Nullergebnis beschreibt die tatsächlich geprüften internen Quellen und sichere Suchalternativen. Portinkonsistenz liefert `UNAVAILABLE` ohne Teilresultat; fehlende Session wird verweigert; ein Fremdtenant bleibt leer.

## Fresh-Supabase- und Browserbeleg

- Umgebung: ausschließlich lokaler Loopback-Stack `127.0.0.1:54321/54322`, Reset durch alle 28 Repository-Migrationen, keine Remote-Verbindung oder Remote-Mutation.
- Testdaten: klar synthetischer Tenant `galvanik-kreile`; Rolf-Actor `11111111-1111-4111-8111-111111111111`, Phillip-Actor `22222222-2222-4222-8222-222222222222`.
- Reale F1.1-Aufnahme: exakt ein Auftrag `A-2026-0001`, zugesagter Termin `2026-10-23`, `exactlyOne=1`.
- Klickpfade: Rolf → Direktaufnahme → Auftrag; Orders → Auftrag → Kunde → Auftrag → zurück; direkte V8-/V2-Deep-Links; Suche → V8/V2; Phillip-Home.
- Viewports: `1914x917`, `1220x880`, `768x1024`, `390x844`.
- Alle 20 PNGs sind vollständig gerendert, nicht leer, ohne horizontalen Overflow; mobile Zurück-/Schließen- und Quick-Action-Ziele liegen vollständig im Viewport.
- Browservertrag: 1/1 PASS in 1,3 Minuten, keine feste Wartezeit, keine Dev-Overlays, strikte Browserfehlerliste leer.
- Receipt: `docs/evidence/path1/artifacts/p3-core-surfaces-search/p3-browser-receipt.json`
- Receipt-SHA-256: `5FDC58C4F92324AFAB84DA6C2164970B619849D264908D6DBC4244E82F48E3E4`
- Das Receipt enthält für jedes der 20 Bilder Dateiname, Zustand, Viewport und SHA-256.

## Lokale Abnahme

| Gate | Ergebnis |
| --- | --- |
| P3-Fokustests | PASS — 13 Dateien, 76/76 Tests |
| Vollständige Unit-Suite | PASS — 110 Dateien, 876/876 Tests |
| TypeScript | PASS — `tsc --noEmit --incremental false` |
| ESLint full | PASS |
| ESLint Ratchet | PASS — 0 Fehler, 0 Warnungen, 0 Debt-Dateien |
| Modul-Gates | PASS — Manifest, Fassaden, Daten- und UI-Nähte |
| Authority-Gate | PASS — 7 Wahrheitsarten, 4 UI-Referenzen |
| Authority-Selftest | PASS — 2 gültige Zustände, 27/27 Negativfälle |
| No-Fake | PASS — 0 erreichbare Produktionsmocks, 0 nicht registrierte sichtbare Fähigkeiten |
| No-Fake-Selftest | PASS |
| W4-Read-Port-Inventar | PASS — 611 Dateien, 25 Read-Ports; Selftest 10/10 |
| W4 eingefrorener Realvertrag | PASS — 14/14 Tests auf dem gebundenen 14-Migrationen-Stand |
| P3 Search Fresh-DB | PASS — 1/1; Treffer, Session, Fremdtenant und inkonsistenter Port |
| Dokumentwahrheit | PASS — Repo-Check sowie 5 negative und 5 positive Selftest-Fälle |
| Supabase-Clientgrenze | PASS — 735 Dateien geprüft |
| Production-Build | PASS — Next.js 16.2.12, 55 statische Seiten vollständig erzeugt |
| Diff-Check | PASS |

## Abweichungen und offene Gates

1. Keine offene P0/P1-Abweichung in diesem P3-Slice nach dem vollständigen Browserlauf.
2. Persistente Assistant-Threads, KI-/Providerkombination, Accounting/Analyse, OCR, M365, Mollie, Bank und Kalender wurden nicht begonnen und bleiben außerhalb dieses Pakets.
3. Draft-PR, Exact-SHA-CI, Preview und genau eine unabhängige Prüfung sind weiterhin Pflicht. Bis dahin bleibt der Gesamtstatus `NO_UI_PASS`.
