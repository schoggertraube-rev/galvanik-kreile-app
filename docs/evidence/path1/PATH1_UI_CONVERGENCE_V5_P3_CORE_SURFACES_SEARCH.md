# Path 1 V5 P3 — Kernflächen, Lane-0-Suche und Audit-Repair

Stand: 2026-09-17

Branch: `path1/v5-p3-core-surfaces-search-20260916`

Basis: `70ae0989b7f76a247c34582badc2de3324e27851`

Produkt-SHA des Browserlaufs: `711bd45579424ad6049f87b25ab6fec890c8ce1a`

Status: lokaler Produkt-, Fresh-DB- und Browservertrag bestanden. Exact-SHA-CI, Preview und unabhängige Closure-Prüfung stehen bis zum finalen Evidence-Commit und Push aus. Dies ist kein Gesamt-UI-PASS.

## Kanonische Bindung

- Pointer: `docs/project/linie/ui/CURRENT_DESIGN_REFERENCE.json`
- Aktuelle Ablaufreferenz: `docs/project/linie/ui/KREILE_GESAMTMOCK_V5_2026-09-14.html`
- Pointer- und Datei-SHA-256: `75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA`
- Seitenwahrheit: die vier unveränderten Einzelreferenzen aus `docs/project/linie/00_UI_REFERENZEN_PFADE.md`

## Gelieferter vertikaler Vertrag

1. Orders V8 nutzt eine Kartenwahrheit für Liste, Overlay und teilbaren Deep-Link. Identität, Kunde, Termin/Risiko, Lifecycle, Teile, Verlauf, Zahlung und reale Aktionsgrenzen stammen aus den bestehenden tenantgebundenen Read-Ports.
2. Customers V2 nutzt dieselbe Kundenkarte für Liste, Overlay und Deep-Link. Aktive Aufträge öffnen dieselbe V8-Auftragskarte; Zurück/Schließen erhält den Overlay-Stack.
3. Rolf und Phillip lesen reale öffentliche Projektionen. Priorität und nächste Handlung werden nur aus persistiertem Risiko, Termin, Station und Status abgeleitet; es gibt keine Demo-KPI oder Schattenwahrheit.
4. Die Lane-0-Suche prüft ausschließlich die berechtigten Orders-/Customers-Read-Ports. Sie verursacht keine Modell-, Internet- oder Providerkosten (`metered_cost=0`), nennt Quelle, Trefferfeld, Zusammenhang, Datenstand und Kappung und liefert echte V8-/V2-Deep-Links.
5. Feldübergreifende Suchphrasen werden mit derselben kanonischen Verkettung wie im DB-Port bewiesen. Ein Nullergebnis nennt die tatsächlich geprüften internen Quellen und sichere Suchalternativen. Portinkonsistenz liefert `UNAVAILABLE` ohne Teilresultat; fehlende Session wird verweigert; ein Fremdtenant bleibt leer.
6. Der Systemadministrator-Einstieg ist actor-identisch als Gregor sichtbar und führt in die reale Settings-Komposition. Alltags-Accounting ist capability-gebunden ausschließlich über `/buchhaltung/rechnungen` erreichbar.
7. 60 laut Kanon entfallene oder nicht rendernde Quarantäne-Routen liefern echte 404-Antworten. Darin sind die fünf unratifizierten Standalone-Adminseiten enthalten; Geräteverwaltung und Datenimport bleiben ausschließlich als reale eingebettete Settings-Funktionen erhalten. `/warendurchlauf/galvanik` bleibt als flacher, realer Blackbox-Drilldown bestehen.
8. `/warendurchlauf` und `/warendurchlauf/wareneingang` sind in allen vier Viewports echte, bedienbare Zieloberflächen. Beide öffnen dieselbe GlobalCreate-Erfassung mit Fokus auf dem ersten Feld. `/warendurchlauf/neu` führt in die Wareneingangsfläche; die Direktaufnahme erzeugt genau einen F1.1-Auftrag, der auf der Stationsfläche auch nach Reload gelesen wird.

## Storno- und Zahlungswahrheit

- `cancelInvoice` sperrt Auftrag und Rechnung in derselben Reihenfolge wie die Zahlungsbestätigung und prüft unter dem Rechnungs-Lock Status, Zahlbetrag, offenen Betrag und Zahlungsversion als zusammenhängenden Zustand.
- Nur der eindeutig konsistente, vollständig unbezahlte Zustand darf stornieren. Ein Cent Teilzahlung, Vollzahlung und beschädigte/unklare Zahlungsdaten enden als fachlicher Konflikt ohne Status-, PDF-, Event- oder Zahlungsdatenmutation.
- Der Paralleltest `Storno gegen Zahlungsbestätigung` belegt eine serialisierte zulässige Reihenfolge; ein stornierter Beleg mit bestätigten Zahlungsfakten entsteht nicht.
- Der bestehende unbezahlte Stornopfad, Replay, Original-PDF und Storno-PDF bleiben erhalten.

## Fresh-Supabase- und Browserbeleg

- Umgebung: ausschließlich lokaler Loopback-Stack `127.0.0.1:54321/54322`, Fresh-Reset durch alle 28 Repository-Migrationen, keine Remote-Verbindung oder Remote-Mutation.
- Testdaten: klar synthetischer Tenant `galvanik-kreile`; Rolf-Actor `11111111-1111-4111-8111-111111111111`, Phillip-Actor `22222222-2222-4222-8222-222222222222`, Gregor-Actor `33333333-3333-4333-8333-333333333333`.
- Reale F1.1-Aufnahme: exakt ein Auftrag `A-2026-0001`, zugesagter Termin `2026-10-23`, `exactlyOne=1`.
- Klickpfade: Rolf → Direktaufnahme → Auftrag; Orders → Auftrag → Kunde → Auftrag → zurück; direkte V8-/V2-Deep-Links; Suche → V8/V2; Rolf → Geld & Rechnungen; Rolf → Werkstatt-Hub → Wareneingang → dieselbe Erfassung → Werkstatt-Hub; `/warendurchlauf/neu` → `/warendurchlauf/wareneingang`; Gregor → E-Mail-Login → Einstellungen → Start → Einstellungen; Phillip-Home.
- Viewports: `1914x917`, `1220x880`, `768x1024`, `390x844`.
- Alle 28 PNGs sind neu auf dem Produkt-SHA erzeugt, vollständig gerendert, nicht leer und hashgebunden. Acht zusätzliche Aufnahmen belegen Werkstatt-Hub und Wareneingang bei `1914x917`, `1220x880`, `768x1024` und `390x844`. Die gespeicherten Pixelmaße entsprechen dem zweifachen Device-Pixel-Ratio der logischen Viewports.
- P3-Browservertrag: 1/1 PASS in 2,8 Minuten, keine feste Wartezeit, keine Dev-Overlays, strikte Fehlerliste der aktiven Zieloberflächen leer.
- Negative Routematrix: 60/60 echte 404; die erwarteten 404-Konsoleffekte laufen auf einer getrennten authentifizierten Prüfseite und können echte Zieloberflächenfehler nicht verdecken.
- Customer/KV→Order-Real-DB auf demselben Produktstand: 11/11 PASS; Wiederaufnahme, Version, Zuschlag und genau ein bestehender F1.1-Auftrag bleiben einschließlich Readback erhalten.
- Receipt: `docs/evidence/path1/artifacts/p3-core-surfaces-search/p3-browser-receipt.json`
- Receipt-SHA-256: `f8fabc21e9b91c84384f79238ff3d507adebdb2fd952f15838120b4d7e73a9b9`
- Das Receipt bindet Produkt-SHA, Tenant, drei Actor-IDs, 60 Route-Ergebnisse sowie Dateiname, Zustand, Viewport und SHA-256 aller 28 Bilder.

## Lokale Abnahme

| Gate | Ergebnis |
| --- | --- |
| Erweiterte Fokustests | PASS — Route-/Settings-Vertrag 3 Dateien, 92/92 Tests |
| Vollständige Unit-Suite | PASS — 112 Dateien, 932/932 Tests |
| TypeScript | PASS — `tsc --noEmit --incremental false` |
| ESLint full | PASS |
| ESLint Ratchet | PASS — 0 Fehler, 0 Warnungen, 0 Debt-Dateien |
| Modul-Gates | PASS — Manifest, Fassaden, Daten- und UI-Nähte |
| Authority-Gate | PASS — einschließlich Selftest 27/27 |
| No-Fake | PASS — einschließlich Selftest |
| Dokumentwahrheit | PASS — Repo-Check sowie 5 negative und 5 positive Selftest-Fälle |
| Supabase-Clientgrenze | PASS — 684 Dateien geprüft |
| Migrationsledger | PASS — 28 aktive Migrationen |
| W4-Anker | PASS — unveränderter Test-Blob `923988f0bd489ccb0730e5b08b6e4066f3cb6283`, exakter 14-Migrations-Replay und 14/14 Tests |
| F1.4/F1.5 Fresh-DB | PASS — 5 Dateien, 16/16 Tests inklusive Storno-/Zahlungskonkurrenz |
| F1.3 Live Card + P3 Search Fresh-DB | PASS — 2 Dateien, 10/10 Tests; Treffer, Session, Fremdtenant und inkonsistenter Port |
| Customer + KV→Order Fresh-DB | PASS — 2 Dateien, 11/11 Tests |
| Production-Build | PASS — Next.js 16.2.12, 26 Generierungseinheiten; die fünf entfallenen Adminseiten werden nicht gebaut |
| Diff-/Scope-Check | PASS — Produktcommit mit exakt 12 Pfaden ohne vorzeitige Evidence; Evidence separat an `711bd455…` gebunden |

## Offene Gates und Scope-Grenzen

1. Die bekannten Audit-Ursachen sind im Produkt-SHA lokal durch Positiv- und Negativbelege abgedeckt. Das unabhängige Closure-Urteil wird hier ausdrücklich nicht vorweggenommen.
2. Persistente Assistant-Threads, KI-/Providerkombination, Accounting/Analyse jenseits des realen Rechnungswegs, OCR, M365, Mollie, Bank und Kalender wurden nicht begonnen und bleiben außerhalb dieses Pakets.
3. Exact-SHA-CI, Preview und genau eine unabhängige Prüfung bleiben Pflicht. Bis zu deren Abschluss bleibt der Gesamtstatus `NO_UI_PASS`.
