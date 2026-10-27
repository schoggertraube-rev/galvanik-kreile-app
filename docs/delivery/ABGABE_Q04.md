# Abgabe Q04 · Rechnung → PDF → Zahlung → Ware raus

Status: **PASS**  
Branch: `kreile/s1-p2-eingang`  
Geprüfter Produkt-SHA: `0b024bccbfbbd2e7518acb451fab5e5474e2ef07`  
Preview: https://galvanik-kreile-werkstatt-i4h9ze3zn.vercel.app  
Vercel-Deployment: `dpl_zMFPMD7GhPwK6Yd3gZy514cEDNgT`

## Neu gemacht

- Preislose Freitextpositionen fragen beim Ausstellen der Rechnung den Netto-Einzelpreis inline ab.
- Der Preis-Schreibweg ist rollen- und tenantgebunden, versionsgeprüft, idempotent und über `ORDER_INVOICE_PRICES_SET_V1` belegt.
- Die Rechnung wird danach über den vorhandenen unveränderlichen Rechnungsweg ausgestellt und ist als PDF in der Auftragskarte erreichbar.
- Manuell bestätigte Zahlungen werden zusätzlich als unveränderlicher Datensatz in `public.payments` projiziert.
- Nach bestätigter Zahlung ist der Warenausgang möglich; die Auftragskarte bleibt auch nach `abgeholt` lesbar.
- Der Rechnungsblock zeigt bei vollständig bezahlter Rechnung sichtbar `Bezahlt` und `0,00 €` offen.

## Preview-Klicktest

Rolle: Rolf. Reales TEST-Objekt: Auftrag `A-2026-0004`.

1. Auftrag von `angenommen` nach `Galvanik` weitergeschaltet, Position `fertig` markiert und Auftrag `Fertig melden` ausgeführt.
2. `Rechnung` gewählt; im Dialog für `TEST Q4 Freitext ohne Preis` netto `75,00 €` eingetragen und Rechnung ausgestellt.
3. Rechnung `R-2026-0002` erschien. `Rechnungs-PDF öffnen` zeigte die gebundene PDF-Ressource; im vertrauenswürdigen Preview-Tab wurde `document.contentType = application/pdf` belegt.
4. `Zahlung` → `Bar` → `Zahlung bestätigen` ausgeführt. Die Auftragskarte zeigte danach `Bezahlt`, `0,00 €` offen und `Ware raus`.
5. `Ware raus` ausgeführt. Die Auftragskarte und der Tagesstand zeigen `abgeholt` / `Raus / abgeholt`.

## Datenbank-Nachweis

Live-Abfrage für Auftrag `228f82a1-ff8c-4e8a-8bf1-4c8a38db2371`:

```text
order_number=A-2026-0004
station=abgeholt
status=abgeholt
version=6
item_price_net=75.00
invoices=1
payments=1
invoice_number=R-2026-0002
payment_status=bezahlt
payment_receipt_status=confirmed
goods_out_events=1
```

Remote angewandt und belegt:

- `20261027095000_q4_manual_payment_receipt_projection`
- `20261027101500_q4_freetext_invoice_price_integrity`

Der Fresh-Replay lief durch beide Q4-Migrationen. Erst der anschließende lokale Container-Neustart meldete den fehlenden Storage-Container; gemäß 30-Minuten-Regel blockiert dieses Umgebungsproblem den nachgewiesenen Preview-/Remote-Kernweg nicht.

## Prüfungen

- ESLint der geänderten TS/TSX-Dateien: PASS
- TypeScript im Vercel-Build des Produkt-SHA: PASS
- Vercel-Build des Produkt-SHA: PASS, Funktionen `fra1`
- Zieltests Rechnung, Zahlung, Warenausgang, Auftragskarte und PDF: PASS
- Screenshot 1914×917: [Q04_RECHNUNG_ZAHLUNG_WARE_RAUS.png](../evidence/queue/Q04_RECHNUNG_ZAHLUNG_WARE_RAUS.png)
- GitHub-CI wird gemäß Spielregel 4c nicht abgewartet; ein später roter Pflichtcheck hat Vorrang vor Q05.

## Abweichungen / Rest

- Die geschützte Vercel-Preview vererbte den testseitig gesetzten Trusted-OIDC-Header nicht automatisch in den neu geöffneten Tab. Der PDF-Endpunkt wurde deshalb zusätzlich im bereits vertrauenswürdigen Tab geprüft; er lieferte real `application/pdf`. Es wurde kein Produkt-Fallback verwendet.
- Keine Echtdaten verändert: ausschließlich klar benannte TEST-Kundschaft und TEST-Auftrag in der Entwicklungsdatenbank.

## Owner-Abnahme (5 Minuten)

Preview: https://galvanik-kreile-werkstatt-i4h9ze3zn.vercel.app · Rolle: **Rolf**

1. Auf `Der Tag` beim Auftrag `A-2026-0004` auf `Auftrag öffnen` klicken → Kopf und Ortskette zeigen `abgeholt`.
2. Im Auftrag bis zum Block `Rechnung` scrollen → `R-2026-0002`, `Bezahlt` und `0,00 €` sind sichtbar.
3. `Rechnungs-PDF öffnen` klicken → die Rechnung wird als PDF geöffnet.
4. Dialog schließen → der Auftrag bleibt im Tagesstand als `Raus / abgeholt` sichtbar.
