-- KR-03B1: finaler, rein lesender G04-Termintreuevertrag.
--
-- Beide Views sind direkte Projektionen ueber bestehende public-Tabellen. Sie
-- aendern weder Daten noch RLS/Policies und liefern ohne eine nichtleere
-- app.tenant_id-GUC keine Zeile. public ist hier nur der moduluebergreifende
-- Namensraum: SELECT bleibt auf service_role beschraenkt.

CREATE VIEW public.v_order_timeliness_orders_v1
WITH (security_invoker = true)
AS
SELECT
  orders.id,
  orders.tenant_id,
  orders.order_number,
  orders.status,
  orders.version,
  orders.due_date,
  orders.completed_date,
  CASE
    WHEN orders.due_date IS NULL AND orders.promised_due_date IS NULL THEN 'gleich'
    WHEN orders.due_date IS NOT NULL AND orders.promised_due_date IS NULL THEN 'nur_due_date'
    WHEN orders.due_date IS NULL AND orders.promised_due_date IS NOT NULL THEN 'nur_promised'
    WHEN orders.due_date::date
      = (orders.promised_due_date AT TIME ZONE 'Europe/Berlin')::date THEN 'gleich'
    ELSE 'widerspruechlich'
  END AS promised_date_legacy_class
FROM public.orders orders
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW public.v_order_timeliness_orders_v1 IS
  'G04 tenantgebundene Termintreue-Auftragsfakten. due_date bleibt die einzige Terminwahrheit; promised_date_legacy_class ist nur read-only Diagnose (gleich | nur_due_date | nur_promised | widerspruechlich) anhand des Europe/Berlin-Kalendertags und exponiert keinen zweiten Datumswert.';

REVOKE ALL ON TABLE public.v_order_timeliness_orders_v1
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_order_timeliness_orders_v1 TO service_role;

-- Jede V1/V2-Basiszeile wird anhand event_id genau einmal projiziert. Es gibt
-- bewusst keinen Join, keine Aggregation und keine Deduplizierung: mehrere
-- valide Abholereignisse muessen fuer die fail-closed Domaene sichtbar bleiben.
-- Der rohe payload sowie V1-Finanzfelder paymentStatus/openAmountCents bleiben
-- ausgeschlossen; falsche JSON-Typen werden als NULL statt als View-Fehler
-- projiziert.
CREATE VIEW public.v_order_timeliness_pickup_events_v1
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
      THEN (events.payload ->> 'gateAllowed')::boolean
  END AS payload_gate_allowed,
  events.created_at
FROM public.events events
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND events.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND events.event_type IN ('ORDER_PICKED_UP_V1', 'ORDER_PICKED_UP_V2');

COMMENT ON VIEW public.v_order_timeliness_pickup_events_v1 IS
  'G04 tenantgebundene direkte Abholereignisprojektion fuer ORDER_PICKED_UP_V1 und V2. Eine Viewzeile je event_id, ohne Join/Aggregation, ohne raw payload und ohne paymentStatus/openAmountCents.';

REVOKE ALL ON TABLE public.v_order_timeliness_pickup_events_v1
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_order_timeliness_pickup_events_v1 TO service_role;
