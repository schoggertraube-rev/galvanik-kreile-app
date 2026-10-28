# ABGABE H14 · Eine Rechnungswahrheit

Stand: 28.10.2026

Branch: `kreile/s1-p2-eingang` · PR #154

Produkt-Commits: `c0b12f79` (Umsatz/Offene Posten), `99999a82` (Zahlstatus)

## Befund und Änderung

- Der Altbestand las Kundenumsatz und Offene Posten aus `ausgangsrechnung`, während die tatsächlich ausgestellten Rechnungen und Zahlungen in `public.invoices`/`public.payments` stehen. Die kanonische Lesekette ist jetzt `src/lib/server/invoiceTruthRead.ts:92` → Actions/Analysen → Oberfläche.
- Die Kundenkarte aggregiert Umsatz und offenen Betrag direkt aus `public.invoices` (`src/lib/server/customerSummaryRead.ts:211`) und zeigt beide Werte (`src/modules/customers/ui/CustomerCardView.tsx:208`).
- Der Zahlstatus einer Auftragskarte kommt nur noch über `getPaymentState(authorization, orderId)` (`src/lib/server/paymentSummaryRead.ts:69`) und die eine Server-Action (`src/app/actions/payments.actions.ts:72`). Die zugrunde liegende View bildet die Rechnungs-/Zahlungswahrheit ab; `orders.payment_status` wird von keiner Produktanzeige gelesen.
- Schreibpfade auf `orders.payment_status` wurden gemäß H14.2 nicht verändert.
- H14 brauchte keine Migration und hat keine Daten geändert.

## Inventur der sieben Produktdateien mit Altbezug

| Datei | Alter Bezug | Ergebnis |
|---|---|---|
| `src/app/actions/customers.actions.ts` | direkter Umsatzleser | auf `readInvoiceTruth` umgestellt |
| `src/app/buchhaltung/actions.ts` | Rechnungslisten, OP und Cockpit | auf `readInvoiceTruth` umgestellt |
| `src/app/buchhaltung/analysis.actions.ts` | UStVA, OP, BWA und Kraftstoffquote | auf `readInvoiceTruth` umgestellt |
| `src/lib/search/aiAggregation.ts` | Rechnungsanzahl, Umsatz, Top-Kunden | auf `readInvoiceTruth` umgestellt |
| `src/app/performance/actions.ts` | direkter Tabellenleser | verbleibt ausschließlich bis H15; die gesamte kaputte Route `/performance` wird dort entfernt |
| `src/app/buchhaltung/components/OffenePostenKachel.tsx` | historischer Textwert `belegart: "ausgangsrechnung"` | kein Tabellenleser; die OP-Daten kommen jetzt über die umgestellte `getOffenePostenAnalysisAction` |
| `src/lib/buchhaltung/types.ts` | optionaler Legacy-Feldname `ausgangsrechnungId` | reiner Typ, kein Datenleser und keine Umsatz-/OP-Wahrheit |

Direkte produktive Leser der Alttabelle nach H14: genau einer (`src/app/performance/actions.ts:15`), ausdrücklich zur vollständigen Entfernung mit H15. Die Tabelle selbst bleibt bestehen.

## Dev-DB · Vorher/Nachher A-2026-0001 bis A-2026-0008

Der Vorher-Wert ist `orders.payment_status`; der Nachher-Wert stammt aus der aktiven Rechnung und deren Zahlungsaggregat.

| Auftrag | vorher | nachher in der Anzeige | Begründung |
|---|---|---|---|
| A-2026-0001 | `unpaid` | Rechnung noch nicht ausgestellt | keine aktive Rechnung |
| A-2026-0002 | `unpaid` | Rechnung noch nicht ausgestellt | keine aktive Rechnung |
| A-2026-0003 | `unpaid` | offen | R-2026-0001, 5.058 Cent offen |
| A-2026-0004 | `unpaid` | bezahlt | R-2026-0002, 8.925 Cent bezahlt, 0 Cent offen; `payments` = 8.925 Cent |
| A-2026-0005 | `unpaid` | offen | R-2026-0003, 8.925 Cent offen |
| A-2026-0006 | `unpaid` | Rechnung noch nicht ausgestellt | keine aktive Rechnung |
| A-2026-0007 | `unpaid` | Rechnung noch nicht ausgestellt | keine aktive Rechnung |
| A-2026-0008 | `unpaid` | Rechnung noch nicht ausgestellt | keine aktive Rechnung |

SQL-Grundlage:

```sql
select o.order_number,
       o.payment_status as status_vorher,
       i.invoice_number,
       i.payment_status as status_nachher,
       i.gross_amount_cents,
       i.payment_paid_amount_cents,
       i.payment_open_amount_cents,
       coalesce(sum(p.amount_eur * 100), 0)::bigint as payments_table_cents
from public.orders o
left join public.invoices i
  on i.tenant_id = o.tenant_id and i.order_id = o.id and i.status = 'issued'
left join public.payments p
  on p.tenant_id = i.tenant_id and p.invoice_id = i.id and p.status = 'confirmed'
where o.order_number between 'A-2026-0001' and 'A-2026-0008'
group by o.order_number, o.payment_status, i.invoice_number, i.payment_status,
         i.gross_amount_cents, i.payment_paid_amount_cents, i.payment_open_amount_cents
order by o.order_number;
```

## DB-Soll K-2026-0010

```text
customer_number = K-2026-0010
revenue_cents   = 17850
open_cents      = 8925
issued_count    = 2
```

Die Kundenkarte muss damit `178,50 €` Umsatz und `89,25 €` Offene Posten zeigen.

## Prüfergebnis

- fokussiert H14.1: 3 Testdateien, 9/9 Tests grün
- fokussiert H14.2: 1 Testdatei, 10/10 Tests grün
- beide Commit-Hooks: 138/138 Testdateien, 1.127/1.127 Tests grün
- TypeScript, ESLint, `quality:module-gates` und `quality:no-fake-production`: grün
- Suche nach direktem `orders.payment_status`-Leser in Produktcode: 0
- Datenbankmigrationen: keine; Dev-DB blieb unverändert

## Owner-Abnahme (max. 5 Minuten)

Rolle: Rolf · aktuelle Preview von PR #154

1. Anmelden und **Kunden** öffnen; die Liste muss ohne Fehlermeldung laden.
2. Kunde **K-2026-0010** öffnen; im Block **Kundenstand** muss `Umsatz aus Rechnungen 178,50 €` stehen.
3. Im selben Block muss `Offene Posten 89,25 €` stehen.
4. Auftrag **A-2026-0004** öffnen; im Rechnungsblock muss der Zahlstatus **Bezahlt** und der offene Betrag `0,00 €` erscheinen.

Erwartete DB-Zeilen nach dem Klick: unverändert die oben belegten zwei ausgestellten Rechnungen für K-2026-0010 (`17850` Cent gesamt, `8925` Cent offen) sowie A-2026-0004 mit `payment_status = 'bezahlt'`, `payment_paid_amount_cents = 8925`, `payment_open_amount_cents = 0` und bestätigten Zahlungen über zusammen `8925` Cent.
