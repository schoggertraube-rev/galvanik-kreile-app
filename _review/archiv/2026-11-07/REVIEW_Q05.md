# Review Q05 · Zahlungsart und Übergabe aus dem Eingang

Prüfer: Claude · 27.10.2026 11:27 Berlin (10:27 UTC)
Branch: kreile/s1-p2-eingang · Commit a6b844f2 · Abgabe-Status „PRÜFLAUF“

## Urteil: keine Blocker, **kein PASS** (Abgabe unvollständig)

Fehlt für PASS (kein FAIL, nur Abschluss): Preview-Klicktest mit TEST-Auftrag „Bar bei Abholung“, SQL-Beleg `payment_mode = abholung`, Ware raus vor Zahlung, Produkt-SHA, Preview-Link, Owner-Abnahme.

Code-Sicht ohne Blocker:
- Eingang übergibt `paymentMode`/`handoverMode` explizit (GlobalCreateFlow.tsx ~Z. 1086); Kundenupdate übergibt alle Pflichtfelder einzeln (Name, Firma, Ansprechpartner, Telefon, E-Mail, Anschrift, Zahlungsbedingung).
- Migration 20261027113000 additiv (`handover_mode` + Check); zwei Event-Constraints werden ersetzt (DROP + ADD derselben Namen), keine Daten gelöscht. Remote angewandt.
- Ware raus bei `abholung` vor Zahlung (recordGoodsOutCommand.ts Z. 320, paymentContract.ts Z. 241) – Vorkasse bleibt gesperrt.
- P3-Migration 20261026200000 jetzt im Branch, identisch mit Remote-Stand.

Zweite Prüfung: nur Vervollständigung der Abgabe prüfen.


## Nachtrag 27.10. 12:28 Berlin (11:28 UTC) · Amend 73232179

Amend ändert nur ABGABE_Q05.md + Screenshot (kein src-Unterschied zu a6b844f2). Preview gj5xfjho1 (dpl_9uXjHYpi96qKimEaiJ2fr14UHs3y, Ready), Klicktest Rolle Rolf mit TEST-Auftrag A-2026-0005 belegt. **Urteil: PASS.**
