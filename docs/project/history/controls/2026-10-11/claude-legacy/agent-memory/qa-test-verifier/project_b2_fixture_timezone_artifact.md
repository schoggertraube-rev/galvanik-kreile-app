---
name: b2-fixture-timezone-artifact
description: Der frueher unter TZ=Europe/Berlin rote B2-Termintreue-Integrationstest ist seit dem Z-Suffix-Fixture-Fix unter BEIDEN Zonen gruen (16/16); der TZ-Hinweis ist erledigt, die Mechanik-Erklaerung bleibt als Wissen relevant.
metadata:
  type: project
---

`src/test/b2_order_timeliness_read_contract.integration.test.ts`.

**Stand 2026-09-28 (Runde 10, unabhaengig nachgemessen):** ERLEDIGT. Beide Laeufe
gruen, je 16/16, Exit 0 — `TZ=UTC` und `TZ=Europe/Berlin`. Die Domain-Unit-Tests
`src/modules/orders/__tests__/orderTimelinessFacts.test.ts` ebenfalls 26/26 unter
beiden Zonen. Der frueher gemeldete 3-Fehler-Zustand unter Berlin (Tenant-A-Isolation
plus beide Bereichsgrenzen-Tests) ist nicht mehr reproduzierbar.

Ursache war NIE der Lesevertrag, sondern der Fixture-Schreibweg: `public.orders.due_date`
ist `timestamp without time zone`, und der postgres.js-Roundtrip verschob den Wert um
den Prozess-TZ-Offset (`'2026-07-10T00:00:00'::timestamp` landete unter TZ=Europe/Berlin
als `2026-07-09 22:00:00`). Mechanik im Treiber: `node_modules/postgres/src/types.js`
registriert fuer OID 1082/1114/1184 den Serializer
`(x instanceof Date ? x : new Date(x)).toISOString()`; `connection.js` waehlt ihn NACH
der `ParameterDescription` des Servers. Der Fix (inzwischen committet) gibt jedem
Fixture-Wert ein `Z`-Suffix und bindet `due_date` als `::text::timestamptz AT TIME ZONE 'UTC'`
— `$1::text` erzwingt OID 25 und schaltet den Date-Serializer strukturell ab.

**Sichtbarer Rest:** im lokalen Dev-Postgres liegen Alt-Zeilen aus Vor-Fix-Laeufen mit
`due_date::time = '22:00:00'` (Ordnernummern `*-OTF-*`). Der Test laesst die drei
Auftraege MIT Abhol-Ereignis bewusst stehen (GoBD append-only), es kommen pro Lauf drei
hinzu. Reine lokale Hygiene — der Produktions-Schreibweg
`src/lib/server/commands/orderIntakeCommand.ts` schreibt `${normalized.dueDate}::date`
und damit immer Mitternacht.

**Why:** Der alte Merksatz "diesen Test nur mit TZ=UTC fahren" ist jetzt falsch und
wuerde einen echten Zonenregress verdecken — die Berlin-Zonenregel der View
(`20260928110000`) ist genau das, was unter Berlin mitgeprueft werden muss.

**How to apply:** Test unter BEIDEN Zonen fahren und beide Ergebnisse protokollieren.
In CI (`quality.yml`, B2-Schritt) ist KEIN `TZ` gesetzt, der Schritt erbt UTC vom
Runner — die Berlin-Zusage ist damit nur lokal belegt und kann still regressieren.
Randnotiz fuer angrenzende Pakete: `toDateOnly` in
`src/lib/server/commands/immutableInvoiceCommand.ts` macht
`value.toISOString().slice(0,10)` auf einem aus `timestamp without time zone`
geparsten Date — dieselbe Klasse latenter TZ-Abhaengigkeit, vorbestehend, ausserhalb B2.
Siehe [[manifest-migrations-field-not-gate-read]].
