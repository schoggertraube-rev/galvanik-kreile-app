# F1.5-D — bestaetigter Zahlungseingang und Warenausgang im Auftrags-Overlay

Status: `CANDIDATE_LOCAL_PASS` — Exact-SHA-CI und unabhaengiger Review stehen aus. Dieses Dokument behauptet weder Merge noch Production- oder Remote-DB-Ausbringung.

## D.1 — Phillip-Werkstattgriff `Ware raus`

- D-UI-F15-004A ist als Kandidat umgesetzt: Der Phillip-V4-Griff oeffnet einen gefuehrten Picker aus der bestehenden tenantgebundenen Stationsquelle.
- Der Modul-Read-Snapshot filtert ausschliesslich `station === "fertig"`; Wareneingang und laufende Galvanik werden nicht angeboten.
- Der wiederverwendbare Kern ruft nur `onOpenGoodsOut(orderId)` auf. Erst `WerkstattAppAdapter` bindet diesen Port an das bestehende `openOrder(orderId)` und damit an das bereits gelieferte OrderOverlay.
- Fehlt ein `fertig`-Kandidat, zeigt derselbe Griff den ehrlichen Leerzustand `Keine fertig gemeldete Ware zur Ausgabe vorhanden.`
- Der normale Auftragspicker mit Scan, Galvanik- und Wareneingangsauftraegen bleibt unveraendert erhalten. Denied, Error und Conflict behalten ihre fail-closed Darstellung ohne Aktionsleiste.

## Gelieferter Kandidatenumfang

- Bestehendes `OrderOverlay`: physischer Zustand und Rechnung/Zahlung sind sichtbar getrennt.
- Vorkasse bleibt bis zur bestaetigten Vollzahlung gesperrt.
- Abholung bestaetigt zuerst die Zahlung ueber `confirmPayment`, danach separat den physischen Warenausgang.
- Rechnung/Stammkunde erlaubt den Ausgang ueber `ORDER_PICKED_UP_V2`, ohne vor Rechnungsstellung Betrag, Zahlungsstatus oder offenen Betrag zu behaupten.
- Erst nach bestaetigtem V2-Ausgang erscheint der kanonische Rechnungsweg; `INVOICE_CREATED_V2` wird als `issued/offen` zurueckgelesen und erst danach ist `confirmPayment` erreichbar. Der sichtbare Hilfetext benennt dabei wahrheitsgemaess den bereits bestaetigten Warenausgang und die separat per Readback dokumentierte spaetere Zahlung; die Vorkasse-/Abholung-Gate-Erklaerung bleibt unveraendert.
- Versand oder Abholung werden explizit gewaehlt. Erfolg erscheint erst nach persistiertem Readback mit Akteur, Zeitpunkt, Receipt und Event-ID.
- `CONFLICT`, fehlende Rolle, fehlende Daten und Read-Fehler bleiben fail-closed.

## Reale lokale Abnahme

Am 2026-09-09 lief nach einem frischen lokalen Supabase-Reset die echte Kette:

`echte Migrationen -> echte Supabase Auth/Session -> echte Intake-/Stations-/Freeze-/Invoice-Commands -> confirmPayment/recordGoodsOut -> persistierte Events -> erneuter serverseitiger Read-Port -> sichtbares Overlay`

Playwright: `e2e/f1-5-goods-out-ui.real.spec.ts`, Projekt `Tablet`, ein Worker: `1 passed` in 7.8 Minuten.

Belegt wurden:

- Vorkasse vor Zahlung gesperrt, nach Vollzahlung `PAYMENT_CONFIRMED_V1` und `ORDER_PICKED_UP_V1` jeweils genau einmal.
- Abholung vor Zahlung gesperrt, danach getrennte Zahlung und Ausgabe, beide Events jeweils genau einmal.
- Rechnung am selben Auftrag `A-2026-0003`: vor Ausgang kein Rechnungsweg und null erfundene Zahlungswerte; danach genau ein `ORDER_PICKED_UP_V2`, genau ein `INVOICE_CREATED_V2` mit Readback `issued/offen` und genau ein `PAYMENT_CONFIRMED_V1` mit Readback `bezahlt`.
- Stale-Version als `CONFLICT` mit echtem Reload und ohne falsches Erfolgs-Receipt.
- Rolle `readonly` als `Denied` ohne erreichbare Payment-/Goods-out-Aktion; fremder Tenant ohne Sitzung.
- Desktop 1440x900 und Tablet 1220x880 fuer Sperre, rechnungslosen Zustand sowie die Rechnungsschritte nach Ausgang, nach Rechnungsstellung und nach Zahlung.
- D.1-Einstieg vom Phillip-Home fuer Vorkasse auf Desktop und Tablet, fuer erfolgreiche Abholung auf Tablet sowie fuer den Rechnungspfad auf Desktop und Tablet.
- Home-Reload nach erfolgreichem Warenausgang belegt auf Desktop fuer Vorkasse und Rechnung sowie auf Tablet fuer Abholung, dass die jeweils ausgegebene Order-ID nicht mehr im `Ware raus`-Picker erscheint.

Maschinenlesbares Receipt: `docs/evidence/f1/artifacts/f1-5/f1-5-d-real-browser-receipt.json` (`SHA256 1D35F28BEAE231E1052148686607C1801967E748FCBB33A7D26ADA9139F3476D`). Es enthaelt die drei synthetischen Auftrags-IDs, sieben persistierte Event-Receipts und die SHA256-Werte aller zwanzig Screenshots, darunter acht neue D.1-Picker-/Home-Readback-Belege.

## Produktions- und Mockwahrheit

- `PRODUCTION_PATH_MOCKS=NONE`
- `ACCEPTANCE_PATH_MOCKS=NONE`
- Synthetische Daten wurden ausschliesslich im frisch zurueckgesetzten lokalen Abnahmesystem angelegt.
- Keine Remote-DB-Migration, kein Production-Deploy und kein Merge wurden in diesem Paket ausgefuehrt.

## Offene Gates

1. D.1-Kandidaten-Commit und Draft-PR mit unveraenderlichem Exact-SHA.
2. Quality, Fresh Supabase replay, Ratchet, Agentur-Gates und Vercel Preview am Exact-SHA.
3. Unabhaengiger Review; Autor fuehrt kein Selbstreview und keinen Merge aus.
