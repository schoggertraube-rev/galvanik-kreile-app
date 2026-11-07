# Review H7 – neue Aufträge wieder öffnen

Abgabe: docs/delivery/ABGABE_H7.md · Commit a7145390 · Branch kreile/s1-p2-eingang · Prüfung 28.10. 11:32 UTC

Urteil: **PASS** (Owner-Klick offen: A-2026-0008 und 0001–0007 öffnen, danach neuen Auftrag anlegen → sofort öffnen).

- Ursache benannt: `ORDER_CARD_INTAKE_ITEM_SHAPE_INVALID` in `mapOrderCardIntakeItems` (Positionsform mit `executionRequested` aus 20261028002500 nicht zugelassen).
- Fix `src/lib/server/orderCardRead.ts` (+12/−4): zusätzliche versionierte Form, nur die 6 Werte des Schreibvertrags, unbekannte Schlüssel bleiben fail-closed. Kein Datenpatch, keine Migration, keine Oberfläche.
- Neue Spalten aus 20261028115500 (intake_term_status/intake_source) sind Spalten, keine Positionsschlüssel → kein zweiter Bruch derselben Art erkennbar.
- Kein verbotener Pfad. Preview a7145390: c7ayyeoe2 READY; Kopf ab571095: on638odmt READY.
