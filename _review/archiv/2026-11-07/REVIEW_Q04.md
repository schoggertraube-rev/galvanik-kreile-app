# Review Q04 · Rechnung → PDF → Zahlung → Ware raus

Prüfer: Claude · 27.10.2026 11:27 Berlin (10:27 UTC)
Branch: kreile/s1-p2-eingang · Commit 1cb4385d (Amend, ersetzt e90ea2f1) · Abgabe-Produkt-SHA 0b024bcc

## Urteil: **PASS**

Keine Blocker.

- Preispflicht: preislose Freitextposition wird bei der Rechnung inline abgefragt (`invoiceItemPriceCommand.ts`): Rollen buero/meister/admin/developer, tenant-gebunden, `expectedVersion`-Prüfung, Advisory-Lock + clientEventId (idempotent). Kein Datenverlust.
- Kernweg TEST-Auftrag A-2026-0004 bis `abgeholt` laut Abgabe + DB-Nachweis (invoices ≥1, payments 1, goods_out 1); Prüfer-Notiz in AKTUELLE_ANWEISUNG (10:55) bestätigt.
- Migrationen 20261027095000 / 20261027101500 additiv, remote angewandt. Drop nur `DROP TRIGGER IF EXISTS` vor Neuanlage (Immutability-Trigger).
- Keine Hex-/rgb-Farben in neuen src-Zeilen, keine verbotenen Pfade.

Nicht-Blocker → DEZEMBER_LISTE.
