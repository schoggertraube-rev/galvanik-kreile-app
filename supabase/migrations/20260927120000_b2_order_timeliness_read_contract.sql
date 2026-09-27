-- Paket B2, Review PR #115 Runde 2 (P1-1): deklarierter Readvertrag fuer den
-- G04-Termintreue-Port. Bis hierher las src/modules/orders/server/getOrderTimelinessFacts.ts
-- die Auftrags- und Ereigniszeilen direkt ueber Drizzle-Tabellenobjekte und umging damit
-- Naht 4 (ARCHITEKTUR_MODULE_PATH1.md): Fremdfakten duerfen nur ueber deklarierte
-- v_*-Views laufen. Diese Migration stellt genau zwei Lesevertraege bereit; das
-- Modul-Manifest src/modules/orders/orders.manifest.json deklariert sie in viewsFunctions.
--
-- Schema private, nicht public: der einzige im Dossier vorgesehene Fremdkonsument (M02,
-- _MODULDOSSIERS/G04_AUFTRAEGE/04_SCHNITTSTELLEN_DATEN.md Z.14) hat Status SPEZ, existiert
-- nicht im Code und wuerde den Port server-public#getOrderTimelinessFacts konsumieren, nicht
-- die View. Eine public-View wuerde die Leserschaft ohne Gegenwert auf jedes Modul
-- verbreitern. Naht 4 verlangt fuer private.v_* exklusiven Ein-Modul-Besitz: genau ein
-- Manifest (orders) deklariert diese beiden Referenzen. Precedent ist
-- private.v_goods_out_ui_state_v1 / private.v_payment_summary_v1.
--
-- Bewusst KEINE Aggregation und KEIN Join der beiden Views (kein MIN, kein DISTINCT ON):
-- die Anomalie "mehr als ein ORDER_PICKED_UP_V2 je Auftrag" wird in
-- src/modules/orders/domain/orderTimelinessFacts.ts erkannt und braucht dafuer alle
-- Ereigniszeilen. Der Unique-Index events_goods_out_order_version_v2_uidx deckt
-- (tenant_id, order_id, aggregate_version) ab und laesst mehrere V2-Ereignisse je Auftrag
-- ausdruecklich zu; eine aggregierende View wuerde die Anomalie in einen stillen Erstwert
-- verwandeln.
--
-- Tenantbindung fail-closed als ZEILENFILTER. Das Muster stammt von
-- private.v_payment_summary_v1 (20260905201850) und ist gegen leere beziehungsweise
-- gepolsterte GUC-Werte gehaertet. Bewusst NICHT das LEFT-JOIN-/GROUP-BY-Muster der
-- Aggregat-View public.v_werkstatt_kpis_v1: dieses liefert bei fehlender GUC eine
-- NULL-Zeile, also einen stillen Fehlfakt, statt eines sicheren Leerzustands. Ohne
-- gesetzte GUC app.tenant_id geben beide Views hier ein leeres Resultset zurueck.
-- Kein SECURITY DEFINER; security_invoker = true laesst die RLS des Aufrufers wirken.
-- tenant_id bleibt Vertragsspalte, weil die Domaene die Tenantbindung jeder Zeile ein
-- zweites Mal selbst prueft (Defense in Depth).
--
-- Der rohe payload bleibt aus dem Vertrag heraus: ORDER_PICKED_UP_V1-Payloads tragen laut
-- events_order_picked_up_v1_contract_chk (20260905100000) die Felder paymentStatus und
-- openAmountCents, also Finanzfakten, die auf der Auftragstabelle bewusst hinter
-- private.current_user_can_view_finance() gattern. Ein durchgereichtes jsonb wuerde diese
-- Fachgatterung ueber den neuen Vertrag umgehen. Projiziert werden deshalb nur die fuenf
-- Skalarfelder, die die Domaene fuer die Gueltigkeit eines Abholereignisses prueft.
-- Die jsonb_typeof-Huellen halten die Projektion ausnahmefrei: ein Feld mit falschem
-- JSON-Typ kommt als NULL an und ist damit ungueltig, statt die View zu sprengen.

CREATE VIEW private.v_order_timeliness_orders_v1
WITH (security_invoker = true)
AS
SELECT
  orders.id,
  orders.tenant_id,
  orders.order_number,
  orders.status,
  orders.version,
  orders.due_date,
  orders.completed_date
FROM public.orders orders
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_order_timeliness_orders_v1 IS
  'G04 Termintreue-Readvertrag v1: tenantgebundene Auftragszeilen (bestaetigter Termin, Fertigzeit, Lebenszyklusstatus, Aggregatversion) ohne Aggregation und ohne Historisierung; completed_date ist immer der aktuelle Wert.';

REVOKE ALL ON TABLE private.v_order_timeliness_orders_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_order_timeliness_orders_v1 TO service_role;

CREATE VIEW private.v_order_timeliness_pickup_events_v1
WITH (security_invoker = true)
AS
SELECT
  events.id AS event_id,
  events.order_id,
  events.tenant_id,
  events.event_type,
  events.status,
  events.station,
  events.from_station,
  events.event_schema_version,
  events.aggregate_version,
  CASE
    WHEN jsonb_typeof(events.payload -> 'orderId') = 'string'
      THEN events.payload ->> 'orderId'
  END AS payload_order_id,
  CASE
    WHEN jsonb_typeof(events.payload -> 'mode') = 'string'
      THEN events.payload ->> 'mode'
  END AS payload_mode,
  CASE
    WHEN jsonb_typeof(events.payload -> 'paymentMode') = 'string'
      THEN events.payload ->> 'paymentMode'
  END AS payload_payment_mode,
  CASE
    WHEN jsonb_typeof(events.payload -> 'invoiceState') = 'string'
      THEN events.payload ->> 'invoiceState'
  END AS payload_invoice_state,
  CASE
    WHEN jsonb_typeof(events.payload -> 'gateAllowed') = 'boolean'
      THEN (events.payload -> 'gateAllowed')::boolean
  END AS payload_gate_allowed,
  events.created_at
FROM public.events events
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND events.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND events.event_type IN ('ORDER_PICKED_UP_V1', 'ORDER_PICKED_UP_V2');

COMMENT ON VIEW private.v_order_timeliness_pickup_events_v1 IS
  'G04 Termintreue-Readvertrag v1: tenantgebundene Abholereignisse (ORDER_PICKED_UP_V1/V2) mit Provenienzfeldern und den fuenf geprueften payload-Skalaren; keine Aggregation, kein rohes payload, damit keine Finanzfelder aus dem V1-Payload den Vertrag verlassen.';

REVOKE ALL ON TABLE private.v_order_timeliness_pickup_events_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_order_timeliness_pickup_events_v1 TO service_role;
