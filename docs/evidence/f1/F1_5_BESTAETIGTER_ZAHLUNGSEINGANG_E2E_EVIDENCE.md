# F1.5-D — bestaetigter Zahlungseingang und Warenausgang im Auftrags-Overlay

Status: `CANDIDATE_LOCAL_PASS` — Exact-SHA-CI und unabhaengiger Review stehen aus. Dieses Dokument behauptet weder Merge noch Production- oder Remote-DB-Ausbringung.

## Gelieferter Kandidatenumfang

- Bestehendes `OrderOverlay`: physischer Zustand und Rechnung/Zahlung sind sichtbar getrennt.
- Vorkasse bleibt bis zur bestaetigten Vollzahlung gesperrt.
- Abholung bestaetigt zuerst die Zahlung ueber `confirmPayment`, danach separat den physischen Warenausgang.
- Rechnung/Stammkunde erlaubt den Ausgang ueber `ORDER_PICKED_UP_V2`, ohne vor Rechnungsstellung Betrag, Zahlungsstatus oder offenen Betrag zu behaupten.
- Versand oder Abholung werden explizit gewaehlt. Erfolg erscheint erst nach persistiertem Readback mit Akteur, Zeitpunkt, Receipt und Event-ID.
- `CONFLICT`, fehlende Rolle, fehlende Daten und Read-Fehler bleiben fail-closed.

## Reale lokale Abnahme

Am 2026-09-09 lief nach einem frischen lokalen Supabase-Reset die echte Kette:

`echte Migrationen -> echte Supabase Auth/Session -> echte Intake-/Stations-/Freeze-/Invoice-Commands -> confirmPayment/recordGoodsOut -> persistierte Events -> erneuter serverseitiger Read-Port -> sichtbares Overlay`

Playwright: `e2e/f1-5-goods-out-ui.real.spec.ts`, Projekt `Tablet`, ein Worker: `1 passed` in 9.4 Minuten.

Belegt wurden:

- Vorkasse vor Zahlung gesperrt, nach Vollzahlung `PAYMENT_CONFIRMED_V1` und `ORDER_PICKED_UP_V1` jeweils genau einmal.
- Abholung vor Zahlung gesperrt, danach getrennte Zahlung und Ausgabe, beide Events jeweils genau einmal.
- Rechnung ohne ausgestellte Rechnung mit null erfundenen Zahlungswerten und genau einem `ORDER_PICKED_UP_V2`.
- Stale-Version als `CONFLICT` mit echtem Reload und ohne falsches Erfolgs-Receipt.
- Rolle `readonly` als `Denied` ohne erreichbare Payment-/Goods-out-Aktion; fremder Tenant ohne Sitzung.
- Desktop 1440x900 und Tablet 1220x880 fuer Sperre, Erfolg und rechnungslosen Zustand.

Maschinenlesbares Receipt: `docs/evidence/f1/artifacts/f1-5/f1-5-d-real-browser-receipt.json` (`SHA256 A47C1CD9464003C467A9D2008578F4084F0D450A1E66E8AAB5B1A9DC492291E8`). Es enthaelt die drei synthetischen Auftrags-IDs, fuenf persistierte Event-Receipts und die SHA256-Werte aller sechs Screenshots.

## Produktions- und Mockwahrheit

- `PRODUCTION_PATH_MOCKS=NONE`
- `ACCEPTANCE_PATH_MOCKS=NONE`
- Synthetische Daten wurden ausschliesslich im frisch zurueckgesetzten lokalen Abnahmesystem angelegt.
- Keine Remote-DB-Migration, kein Production-Deploy und kein Merge wurden in diesem Paket ausgefuehrt.

## Offene Gates

1. Kandidaten-Commit und Draft-PR mit unveraenderlichem Exact-SHA.
2. Quality, Fresh Supabase replay, Ratchet, Agentur-Gates und Vercel Preview am Exact-SHA.
3. Unabhaengiger Review; Autor fuehrt kein Selbstreview und keinen Merge aus.
