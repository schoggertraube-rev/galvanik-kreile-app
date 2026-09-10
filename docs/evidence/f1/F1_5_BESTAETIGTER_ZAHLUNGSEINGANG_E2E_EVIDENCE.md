# F1.5-D — bestaetigter Zahlungseingang und Warenausgang im Auftrags-Overlay

Status: `CANDIDATE_LOCAL_PASS` — Exact-SHA-CI und unabhaengiger Review stehen aus. Dieses Dokument behauptet weder Merge noch Production- oder Remote-DB-Ausbringung.

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

Playwright: `e2e/f1-5-goods-out-ui.real.spec.ts`, Projekt `Tablet`, ein Worker: `1 passed` in 8.8 Minuten.

Belegt wurden:

- Vorkasse vor Zahlung gesperrt, nach Vollzahlung `PAYMENT_CONFIRMED_V1` und `ORDER_PICKED_UP_V1` jeweils genau einmal.
- Abholung vor Zahlung gesperrt, danach getrennte Zahlung und Ausgabe, beide Events jeweils genau einmal.
- Rechnung am selben Auftrag `A-2026-0003`: vor Ausgang kein Rechnungsweg und null erfundene Zahlungswerte; danach genau ein `ORDER_PICKED_UP_V2`, genau ein `INVOICE_CREATED_V2` mit Readback `issued/offen` und genau ein `PAYMENT_CONFIRMED_V1` mit Readback `bezahlt`.
- Stale-Version als `CONFLICT` mit echtem Reload und ohne falsches Erfolgs-Receipt.
- Rolle `readonly` als `Denied` ohne erreichbare Payment-/Goods-out-Aktion; fremder Tenant ohne Sitzung.
- Desktop 1440x900 und Tablet 1220x880 fuer Sperre, rechnungslosen Zustand sowie die Rechnungsschritte nach Ausgang, nach Rechnungsstellung und nach Zahlung.

Maschinenlesbares Receipt: `docs/evidence/f1/artifacts/f1-5/f1-5-d-real-browser-receipt.json` (`SHA256 7B05572444746C0E5A775A3DD808705153CB910BA6E61D61637EA6F1D6EF578D`). Es enthaelt die drei synthetischen Auftrags-IDs, sieben persistierte Event-Receipts und die SHA256-Werte aller zwoelf Screenshots.

## Produktions- und Mockwahrheit

- `PRODUCTION_PATH_MOCKS=NONE`
- `ACCEPTANCE_PATH_MOCKS=NONE`
- Synthetische Daten wurden ausschliesslich im frisch zurueckgesetzten lokalen Abnahmesystem angelegt.
- Keine Remote-DB-Migration, kein Production-Deploy und kein Merge wurden in diesem Paket ausgefuehrt.

## Offene Gates

1. Kandidaten-Commit und Draft-PR mit unveraenderlichem Exact-SHA.
2. Quality, Fresh Supabase replay, Ratchet, Agentur-Gates und Vercel Preview am Exact-SHA.
3. Unabhaengiger Review; Autor fuehrt kein Selbstreview und keinen Merge aus.
