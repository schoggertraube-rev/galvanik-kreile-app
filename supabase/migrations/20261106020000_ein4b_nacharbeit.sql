-- AP-EIN Teil 4b: the rework order is an ordinary order with one explicit
-- complaint reference.  Existing complaint columns remain legacy read data;
-- the decision workflow below writes only the named Part-4b fields.

ALTER TABLE public.complaints
  ADD CONSTRAINT complaints_tenant_id_identity_key UNIQUE (tenant_id, id);

ALTER TABLE public.orders
  ADD COLUMN nacharbeit_zu text,
  ADD COLUMN hinweis_auftrag text CHECK (hinweis_auftrag IS NULL OR length(btrim(hinweis_auftrag)) BETWEEN 1 AND 2000),
  ADD COLUMN zurueck_grund text CHECK (zurueck_grund IS NULL OR length(btrim(zurueck_grund)) BETWEEN 3 AND 500),
  ADD COLUMN ohne_ware_grund text CHECK (ohne_ware_grund IS NULL OR length(btrim(ohne_ware_grund)) BETWEEN 3 AND 500);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_nacharbeit_zu_tenant_fk
    FOREIGN KEY (tenant_id, nacharbeit_zu)
    REFERENCES public.complaints (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.orders
  DROP CONSTRAINT orders_f15_payment_mode_chk;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_f15_payment_mode_chk
    CHECK (payment_mode IN ('vorkasse', 'abholung', 'rechnung', 'keiner')),
  ADD CONSTRAINT orders_nacharbeit_payment_contract_chk
    CHECK (
      (nacharbeit_zu IS NULL AND payment_mode <> 'keiner')
      OR (nacharbeit_zu IS NOT NULL AND payment_mode = 'keiner')
    );

CREATE UNIQUE INDEX orders_nacharbeit_zu_uidx
  ON public.orders (tenant_id, nacharbeit_zu)
  WHERE nacharbeit_zu IS NOT NULL;

ALTER TABLE public.complaints
  ADD COLUMN nummer text,
  ADD COLUMN client_key uuid,
  ADD COLUMN teile jsonb,
  ADD COLUMN mangel text,
  ADD COLUMN fotos jsonb,
  ADD COLUMN ware_zurueck text,
  ADD COLUMN stand text,
  ADD COLUMN bewertung text,
  ADD COLUMN massnahme text,
  ADD COLUMN begruendung text,
  ADD COLUMN gutschrift_betrag numeric(12,2),
  ADD COLUMN gutschrift_nr text,
  ADD COLUMN nacharbeit_auftrag_id text,
  ADD COLUMN abschluss_art text,
  ADD COLUMN abschluss_notiz text,
  ADD COLUMN abgeschlossen_am timestamptz,
  ADD COLUMN abgeschlossen_von uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  ADD COLUMN erstellt_von uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
  ADD COLUMN erstellt_am timestamptz,
  ADD COLUMN version integer;

ALTER TABLE public.complaints
  ADD CONSTRAINT complaints_rework_parts_chk
    CHECK (teile IS NULL OR jsonb_typeof(teile) = 'array'),
  ADD CONSTRAINT complaints_rework_photos_chk
    CHECK (fotos IS NULL OR jsonb_typeof(fotos) = 'array'),
  ADD CONSTRAINT complaints_rework_ware_chk
    CHECK (ware_zurueck IS NULL OR ware_zurueck IN ('ja', 'nein')),
  ADD CONSTRAINT complaints_rework_state_chk
    CHECK (stand IS NULL OR stand IN ('aufgenommen', 'massnahme_nacharbeit', 'massnahme_gutschrift', 'kunde_informieren', 'abgeschlossen')),
  ADD CONSTRAINT complaints_rework_assessment_chk
    CHECK (bewertung IS NULL OR bewertung IN ('berechtigt', 'kulanz', 'abgelehnt')),
  ADD CONSTRAINT complaints_rework_measure_chk
    CHECK (massnahme IS NULL OR massnahme IN ('nacharbeit', 'gutschrift', 'ablehnen')),
  ADD CONSTRAINT complaints_rework_version_chk
    CHECK (version IS NULL OR version > 0),
  ADD CONSTRAINT complaints_rework_closed_chk
    CHECK (
      (stand IS DISTINCT FROM 'abgeschlossen')
      OR (abschluss_art IS NOT NULL AND abgeschlossen_am IS NOT NULL AND abgeschlossen_von IS NOT NULL)
    );

CREATE UNIQUE INDEX complaints_rework_nummer_uidx
  ON public.complaints (tenant_id, nummer)
  WHERE nummer IS NOT NULL;

CREATE UNIQUE INDEX complaints_rework_client_key_uidx
  ON public.complaints (tenant_id, client_key)
  WHERE client_key IS NOT NULL;

CREATE OR REPLACE VIEW public.v_complaint_rework_context_v1
WITH (security_invoker = true)
AS
SELECT
  complaint.id AS complaint_id,
  complaint.tenant_id,
  complaint.order_id AS source_order_id,
  complaint.customer_id,
  complaint.nummer,
  complaint.teile,
  complaint.mangel,
  complaint.ware_zurueck,
  complaint.stand,
  complaint.bewertung,
  complaint.massnahme,
  complaint.nacharbeit_auftrag_id,
  complaint.abschluss_art,
  complaint.abschluss_notiz,
  complaint.abgeschlossen_am,
  complaint.abgeschlossen_von,
  complaint.version,
  source_order.handover_mode AS source_handover_mode,
  source_order.intake_source AS source_intake_source,
  source_order.order_number AS source_order_number,
  source_order.customer_id AS source_customer_id,
  source_order.ware AS source_ware,
  coalesce(source_items.items, '[]'::jsonb) AS source_items
FROM public.complaints complaint
JOIN public.orders source_order
  ON source_order.tenant_id = complaint.tenant_id
 AND source_order.id = complaint.order_id
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'itemId', item.id,
      'name', item.name,
      'quantity', item.quantity,
      'material', item.material,
      'surfaceRequested', item.surface_requested,
      'executionRequested', item.execution_requested,
      'unit', item.unit
    )
    ORDER BY item.created_at, item.id
  ) AS items
  FROM public.items item
  WHERE item.tenant_id = complaint.tenant_id
    AND item.order_id = complaint.order_id
    AND item.customer_id = complaint.customer_id
) source_items ON true
WHERE complaint.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

REVOKE ALL ON TABLE public.v_complaint_rework_context_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.v_complaint_rework_context_v1 TO service_role;

CREATE OR REPLACE FUNCTION private.apply_complaint_rework_decision_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  current_tenant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
  persisted_version integer;
  persisted_closed_at timestamptz;
BEGIN
  IF current_tenant IS NULL OR OLD.tenant_id <> current_tenant THEN
    RAISE EXCEPTION 'COMPLAINT_REWORK_TENANT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NEW.complaint_id IS DISTINCT FROM OLD.complaint_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.source_order_id IS DISTINCT FROM OLD.source_order_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.nummer IS DISTINCT FROM OLD.nummer
     OR NEW.teile IS DISTINCT FROM OLD.teile
     OR NEW.mangel IS DISTINCT FROM OLD.mangel
     OR NEW.ware_zurueck IS DISTINCT FROM OLD.ware_zurueck
     OR NEW.source_handover_mode IS DISTINCT FROM OLD.source_handover_mode
     OR NEW.source_intake_source IS DISTINCT FROM OLD.source_intake_source
     OR NEW.source_order_number IS DISTINCT FROM OLD.source_order_number
     OR NEW.source_customer_id IS DISTINCT FROM OLD.source_customer_id
     OR NEW.source_ware IS DISTINCT FROM OLD.source_ware
     OR NEW.source_items IS DISTINCT FROM OLD.source_items THEN
    RAISE EXCEPTION 'COMPLAINT_REWORK_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;

  IF OLD.stand = 'aufgenommen'
     AND NEW.stand = 'massnahme_nacharbeit'
     AND NEW.bewertung IN ('berechtigt', 'kulanz')
     AND NEW.massnahme = 'nacharbeit'
     AND NEW.nacharbeit_auftrag_id IS NOT NULL
     AND NEW.version = OLD.version + 1
     AND NEW.abschluss_art IS NULL
     AND NEW.abschluss_notiz IS NULL
     AND NEW.abgeschlossen_am IS NULL
     AND NEW.abgeschlossen_von IS NULL THEN
    UPDATE public.complaints
    SET stand = NEW.stand,
        bewertung = NEW.bewertung,
        massnahme = NEW.massnahme,
        nacharbeit_auftrag_id = NEW.nacharbeit_auftrag_id,
        version = NEW.version
    WHERE tenant_id = OLD.tenant_id
      AND id = OLD.complaint_id
      AND stand = OLD.stand
      AND version = OLD.version
    RETURNING version INTO persisted_version;
    IF NOT FOUND THEN RETURN NULL; END IF;
    NEW.version := persisted_version;
    RETURN NEW;
  END IF;

  IF OLD.stand = 'massnahme_nacharbeit'
     AND NEW.stand = 'abgeschlossen'
     AND NEW.abschluss_art = 'nacharbeit_raus'
     AND NEW.abschluss_notiz IS NULL
     AND NEW.abgeschlossen_am IS NOT NULL
     AND NEW.abgeschlossen_von IS NOT NULL
     AND NEW.version = OLD.version + 1
     AND NEW.bewertung IS NOT DISTINCT FROM OLD.bewertung
     AND NEW.massnahme IS NOT DISTINCT FROM OLD.massnahme
     AND NEW.nacharbeit_auftrag_id IS NOT DISTINCT FROM OLD.nacharbeit_auftrag_id THEN
    UPDATE public.complaints
    SET stand = NEW.stand,
        abschluss_art = NEW.abschluss_art,
        abschluss_notiz = NULL,
        abgeschlossen_am = NEW.abgeschlossen_am,
        abgeschlossen_von = NEW.abgeschlossen_von,
        version = NEW.version
    WHERE tenant_id = OLD.tenant_id
      AND id = OLD.complaint_id
      AND stand = OLD.stand
      AND version = OLD.version
    RETURNING version, abgeschlossen_am INTO persisted_version, persisted_closed_at;
    IF NOT FOUND THEN RETURN NULL; END IF;
    NEW.version := persisted_version;
    NEW.abgeschlossen_am := persisted_closed_at;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'COMPLAINT_REWORK_TRANSITION_INVALID' USING ERRCODE = '23514';
END;
$fn$;

REVOKE ALL ON FUNCTION private.apply_complaint_rework_decision_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.apply_complaint_rework_decision_v1() TO service_role;

CREATE TRIGGER complaint_rework_context_update
  INSTEAD OF UPDATE ON public.v_complaint_rework_context_v1
  FOR EACH ROW EXECUTE FUNCTION private.apply_complaint_rework_decision_v1();

CREATE OR REPLACE FUNCTION private.guard_f1_5_order_payment_mode_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.payment_mode_version = 0
     AND (
       NEW.payment_mode = 'vorkasse'
       OR (
         NEW.source = 'F1_ORDER_INTAKE'
         AND NEW.payment_mode IN ('vorkasse', 'abholung', 'rechnung')
         AND NEW.handover_mode IN ('pickup', 'shipping')
       )
       OR (
         NEW.source = 'REKLAMATION_NACHARBEIT'
         AND NEW.payment_mode = 'keiner'
         AND NEW.handover_mode IN ('pickup', 'shipping')
         AND NEW.nacharbeit_zu IS NOT NULL
         AND current_setting('app.rework_order_command', true) = 'v1'
       )
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ORDER_PAYMENT_MODE_INTAKE_VALUE_REQUIRED' USING ERRCODE = '23514';
END;
$fn$;

REVOKE ALL ON FUNCTION private.guard_f1_5_order_payment_mode_insert() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.refresh_order_ausgabe_frei(p_tenant text, p_order text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  v_allowed boolean;
BEGIN
  SELECT
    orders.station::text = 'fertig'
    AND orders.status::text = 'fertig'
    AND EXISTS (
      SELECT 1
      FROM private.v_order_freeze_state_v1 freeze_state
      WHERE freeze_state.tenant_id = p_tenant
        AND freeze_state.order_id = orders.id
        AND freeze_state.active
        AND freeze_state.integrity_ok
    )
    AND (
      (orders.payment_mode = 'keiner' AND orders.nacharbeit_zu IS NOT NULL)
      OR orders.payment_mode = 'abholung'
      OR orders.payment_mode = 'rechnung'
      OR EXISTS (
        SELECT 1
        FROM private.v_payment_summary_v1 payment
        WHERE payment.tenant_id = p_tenant
          AND payment.order_id = orders.id
          AND payment.integrity_ok
          AND payment.payment_status = 'bezahlt'
          AND payment.payment_open_amount_cents = 0
      )
    )
  INTO v_allowed
  FROM public.orders orders
  WHERE orders.tenant_id = p_tenant
    AND orders.id = p_order;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.orders
  SET ausgabe_frei = v_allowed
  WHERE tenant_id = p_tenant
    AND id = p_order
    AND ausgabe_frei IS DISTINCT FROM v_allowed;
END;
$fn$;

REVOKE ALL ON FUNCTION private.refresh_order_ausgabe_frei(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.refresh_order_ausgabe_frei(text, text) TO service_role;

CREATE OR REPLACE FUNCTION private.sync_order_ausgabe_frei()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    IF TG_OP = 'UPDATE'
       AND NEW.station IS NOT DISTINCT FROM OLD.station
       AND NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.payment_mode IS NOT DISTINCT FROM OLD.payment_mode
       AND NEW.nacharbeit_zu IS NOT DISTINCT FROM OLD.nacharbeit_zu THEN
      RETURN NULL;
    END IF;
    PERFORM private.refresh_order_ausgabe_frei(NEW.tenant_id, NEW.id);
  ELSIF NEW.order_id IS NOT NULL THEN
    PERFORM private.refresh_order_ausgabe_frei(NEW.tenant_id, NEW.order_id);
  END IF;
  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION private.sync_order_ausgabe_frei() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.sync_order_ausgabe_frei() TO service_role;

-- Apply the corrected, receipt-backed release rule to already frozen orders as
-- well. This preserves their immutable receipts and only recalculates the
-- derived release fact; it is the same bounded pattern as Teil 6.
DO $backfill$
DECLARE
  candidate record;
  previous_tenant text := current_setting('app.tenant_id', true);
BEGIN
  FOR candidate IN
    SELECT tenant_id, id
    FROM public.orders
    WHERE station::text = 'fertig'
  LOOP
    PERFORM set_config('app.tenant_id', candidate.tenant_id, true);
    PERFORM private.refresh_order_ausgabe_frei(candidate.tenant_id, candidate.id);
  END LOOP;
  PERFORM set_config('app.tenant_id', coalesce(previous_tenant, ''), true);
END;
$backfill$;

ALTER TABLE public.events
  ADD CONSTRAINT events_order_rework_created_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_REWORK_CREATED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND correlation_id IS NOT NULL
      AND event_schema_version = 1
      AND aggregate_version = 1
      AND from_station IS NULL
      AND station = 'wareneingang'
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'complaintId', payload->'complaintId',
        'deliveryDate', payload->'deliveryDate',
        'orderId', payload->'orderId',
        'paymentMode', payload->'paymentMode',
        'previousState', payload->'previousState',
        'sourceOrderId', payload->'sourceOrderId',
        'state', payload->'state'
      )
      AND payload->>'orderId' = order_id
      AND payload->>'paymentMode' = 'keiner'
      AND payload->>'previousState' = 'aufgenommen'
      AND payload->>'state' = 'massnahme_nacharbeit'
      AND payload->>'deliveryDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND length(coalesce(payload->>'complaintId', '')) BETWEEN 1 AND 128
      AND length(coalesce(payload->>'sourceOrderId', '')) BETWEEN 1 AND 128
    ), false)
  ) NOT VALID,
  ADD CONSTRAINT events_order_picked_up_v4_contract_chk
  CHECK (
    event_type <> 'ORDER_PICKED_UP_V4'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND correlation_id IS NOT NULL
      AND event_schema_version = 4
      AND aggregate_version > 0
      AND from_station = 'fertig'
      AND station = 'abgeholt'
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'complaintStateAfter', payload->'complaintStateAfter',
        'complaintStateBefore', payload->'complaintStateBefore',
        'gateAllowed', payload->'gateAllowed',
        'invoiceState', payload->'invoiceState',
        'mode', payload->'mode',
        'orderId', payload->'orderId',
        'orderVersion', payload->'orderVersion',
        'paymentMode', payload->'paymentMode',
        'reworkComplaintId', payload->'reworkComplaintId'
      )
      AND payload->>'orderId' = order_id
      AND payload->>'paymentMode' = 'keiner'
      AND payload->>'invoiceState' = 'not_issued'
      AND payload->>'complaintStateBefore' = 'massnahme_nacharbeit'
      AND payload->>'complaintStateAfter' = 'abgeschlossen'
      AND payload->>'mode' IN ('versand', 'abholung')
      AND payload->>'gateAllowed' = 'true'
      AND (payload->>'orderVersion') ~ '^[1-9][0-9]*$'
      AND (payload->>'orderVersion')::integer = aggregate_version
      AND length(coalesce(payload->>'reworkComplaintId', '')) BETWEEN 1 AND 128
    ), false)
  ) NOT VALID;

CREATE UNIQUE INDEX events_order_rework_created_order_uidx
  ON public.events (tenant_id, order_id)
  WHERE event_type = 'ORDER_REWORK_CREATED_V1';

CREATE UNIQUE INDEX events_order_rework_created_complaint_uidx
  ON public.events (tenant_id, (payload->>'complaintId'))
  WHERE event_type = 'ORDER_REWORK_CREATED_V1';

CREATE UNIQUE INDEX events_goods_out_v4_order_version_uidx
  ON public.events (tenant_id, order_id, aggregate_version)
  WHERE event_type = 'ORDER_PICKED_UP_V4';

CREATE OR REPLACE FUNCTION private.guard_ein4b_rework_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  order_row record;
  complaint_row record;
BEGIN
  IF NEW.event_type = 'ORDER_REWORK_CREATED_V1' THEN
    SELECT orders.id, orders.tenant_id, orders.customer_id, orders.payment_mode,
      orders.nacharbeit_zu, orders.handover_mode, orders.intake_source, orders.ware,
      orders.geprueft, orders.promised_due_date, orders.intake_term_status
    INTO order_row
    FROM public.orders orders
    WHERE orders.id = NEW.order_id
      AND orders.tenant_id = NEW.tenant_id;

    SELECT complaint.id, complaint.order_id, complaint.customer_id, complaint.stand,
      complaint.massnahme, complaint.nacharbeit_auftrag_id
    INTO complaint_row
    FROM public.complaints complaint
    WHERE complaint.id = NEW.payload->>'complaintId'
      AND complaint.tenant_id = NEW.tenant_id;

    IF NOT FOUND
       OR order_row.id IS NULL
       OR order_row.payment_mode <> 'keiner'
       OR order_row.nacharbeit_zu IS DISTINCT FROM complaint_row.id
       OR order_row.customer_id IS DISTINCT FROM complaint_row.customer_id
       OR order_row.handover_mode IS NULL
       OR order_row.intake_source IS NULL
       OR order_row.ware <> 'erwartet'
       OR order_row.geprueft IS DISTINCT FROM false
       OR order_row.promised_due_date::date IS DISTINCT FROM (NEW.payload->>'deliveryDate')::date
       OR order_row.intake_term_status <> 'wunsch'
       OR complaint_row.order_id IS DISTINCT FROM NEW.payload->>'sourceOrderId'
       OR complaint_row.stand <> 'massnahme_nacharbeit'
       OR complaint_row.massnahme <> 'nacharbeit'
       OR complaint_row.nacharbeit_auftrag_id IS DISTINCT FROM NEW.order_id THEN
      RAISE EXCEPTION 'REWORK_ORDER_EVENT_CONTRACT_INVALID' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.event_type = 'ORDER_PICKED_UP_V4' THEN
    SELECT orders.id, orders.tenant_id, orders.payment_mode, orders.nacharbeit_zu,
      orders.station, orders.current_station, orders.current_station_id, orders.status,
      orders.ausgabe_frei
    INTO order_row
    FROM public.orders orders
    WHERE orders.id = NEW.order_id
      AND orders.tenant_id = NEW.tenant_id;

    SELECT complaint.id, complaint.stand, complaint.nacharbeit_auftrag_id
    INTO complaint_row
    FROM public.complaints complaint
    WHERE complaint.id = NEW.payload->>'reworkComplaintId'
      AND complaint.tenant_id = NEW.tenant_id;

    IF NOT FOUND
       OR order_row.id IS NULL
       OR order_row.payment_mode <> 'keiner'
       OR order_row.nacharbeit_zu IS DISTINCT FROM complaint_row.id
       OR complaint_row.nacharbeit_auftrag_id IS DISTINCT FROM NEW.order_id
       OR complaint_row.stand <> 'massnahme_nacharbeit'
       OR order_row.station <> 'abgeholt'
       OR order_row.current_station <> 'abgeholt'
       OR order_row.current_station_id <> 'abgeholt'
       OR order_row.status <> 'abgeholt'
       OR order_row.ausgabe_frei IS DISTINCT FROM true
       OR EXISTS (
         SELECT 1 FROM public.invoices invoice
         WHERE invoice.tenant_id = NEW.tenant_id
           AND invoice.order_id = NEW.order_id
           AND invoice.status = 'issued'
       ) THEN
      RAISE EXCEPTION 'REWORK_GOODS_OUT_EVENT_CONTRACT_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION private.guard_ein4b_rework_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.guard_ein4b_rework_events() TO service_role;

CREATE TRIGGER events_ein4b_rework_guard
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION private.guard_ein4b_rework_events();

CREATE OR REPLACE VIEW private.v_goods_out_ui_state_v1
WITH (security_invoker = true)
AS
SELECT
  orders.id AS order_id,
  orders.tenant_id,
  orders.order_number,
  orders.version AS order_version,
  orders.station,
  orders.current_station,
  orders.current_station_id,
  orders.status AS order_status,
  orders.payment_mode,
  orders.payment_mode_version,
  CASE WHEN invoice_state.active_invoice_count = 0 THEN 'not_issued' ELSE 'issued' END AS invoice_state,
  invoice_state.active_invoice_count,
  payment.invoice_id,
  payment.invoice_number,
  payment.total_amount_cents,
  payment.payment_contract_version,
  payment.payment_status,
  payment.payment_open_amount_cents,
  payment.payment_paid_amount_cents,
  payment.payment_currency,
  payment.payment_method,
  payment.payment_paid_at,
  payment.payment_receipt_id,
  payment.payment_event_id,
  payment.payment_correlation_id,
  payment.payment_version,
  payment.goods_out_allowed AS payment_goods_out_allowed,
  payment.integrity_ok AS payment_integrity_ok,
  payment_actor.user_id AS payment_actor_id,
  coalesce(goods_out.event_count, 0) AS goods_out_event_count,
  goods_out.event_id AS goods_out_event_id,
  goods_out.client_event_id AS goods_out_client_event_id,
  goods_out.correlation_id AS goods_out_correlation_id,
  goods_out.event_schema_version AS goods_out_event_schema_version,
  goods_out.aggregate_version AS goods_out_order_version,
  goods_out.user_id AS goods_out_actor_id,
  to_char(goods_out.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS goods_out_occurred_at,
  goods_out.payload->>'mode' AS goods_out_mode,
  (
    orders.station = 'fertig'
    AND orders.current_station = 'fertig'
    AND orders.current_station_id = 'fertig'
    AND orders.status = 'fertig'
    AND (
      (
        orders.payment_mode = 'keiner'
        AND orders.nacharbeit_zu IS NOT NULL
        AND invoice_state.active_invoice_count = 0
      )
      OR (invoice_state.active_invoice_count = 0 AND orders.payment_mode = 'rechnung')
      OR (invoice_state.active_invoice_count = 1 AND payment.goods_out_allowed = true)
    )
  ) AS goods_out_allowed,
  coalesce(
    orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND orders.payment_mode_version >= 0
    AND orders.station = orders.current_station
    AND orders.station = orders.current_station_id
    AND orders.station = orders.status
    AND invoice_state.active_invoice_count IN (0, 1)
    AND (
      (
        orders.payment_mode = 'keiner'
        AND orders.nacharbeit_zu IS NOT NULL
        AND invoice_state.active_invoice_count = 0
        AND payment.invoice_id IS NULL
      )
      OR (
        orders.payment_mode IN ('vorkasse', 'abholung', 'rechnung')
        AND (
          (invoice_state.active_invoice_count = 0 AND payment.invoice_id IS NULL)
          OR (
            invoice_state.active_invoice_count = 1
            AND payment.invoice_id IS NOT NULL
            AND payment.integrity_ok = true
            AND payment.payment_mode = orders.payment_mode
            AND payment.payment_mode_version = orders.payment_mode_version
            AND (payment_actor.user_id IS NOT NULL OR payment.payment_event_id IS NULL)
          )
        )
      )
    )
    AND (
      coalesce(goods_out.event_count, 0) = 0
      OR (
        goods_out.event_count = 1
        AND goods_out.event_id IS NOT NULL
        AND goods_out.user_id IS NOT NULL
        AND goods_out.aggregate_version = orders.version
        AND goods_out.payload->>'orderId' = orders.id
        AND goods_out.payload->>'orderVersion' = orders.version::text
        AND goods_out.payload->>'mode' IN ('versand', 'abholung')
        AND (
          (goods_out.event_type IN ('ORDER_PICKED_UP_V1', 'ORDER_PICKED_UP_V2', 'ORDER_PICKED_UP_V3') AND goods_out.payload->>'paymentMode' = orders.payment_mode)
          OR (
            goods_out.event_type = 'ORDER_PICKED_UP_V4'
            AND orders.payment_mode = 'keiner'
            AND goods_out.payload->>'paymentMode' = 'keiner'
            AND goods_out.payload->>'reworkComplaintId' = orders.nacharbeit_zu
          )
        )
      )
    )
  , false) AS integrity_ok,
  orders.nacharbeit_zu AS rework_complaint_id
FROM public.orders orders
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS active_invoice_count
  FROM public.invoices invoice
  WHERE invoice.tenant_id = orders.tenant_id
    AND invoice.order_id = orders.id
    AND invoice.status = 'issued'
) invoice_state ON true
LEFT JOIN private.v_payment_summary_v1 payment
  ON payment.tenant_id = orders.tenant_id AND payment.order_id = orders.id
LEFT JOIN public.events payment_actor
  ON payment_actor.tenant_id = orders.tenant_id
 AND payment_actor.order_id = orders.id
 AND payment_actor.id = payment.payment_event_id
 AND payment_actor.event_type = 'PAYMENT_CONFIRMED_V1'
LEFT JOIN LATERAL (
  SELECT count(*) OVER ()::integer AS event_count,
    event.id AS event_id, event.client_event_id, event.correlation_id,
    event.event_schema_version, event.aggregate_version, event.user_id,
    event.created_at, event.payload, event.event_type
  FROM public.events event
  WHERE event.tenant_id = orders.tenant_id
    AND event.order_id = orders.id
    AND event.event_type IN ('ORDER_PICKED_UP_V1', 'ORDER_PICKED_UP_V2', 'ORDER_PICKED_UP_V3', 'ORDER_PICKED_UP_V4')
    AND event.status = 'success'
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT 1
) goods_out ON true
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

REVOKE ALL ON TABLE private.v_goods_out_ui_state_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_goods_out_ui_state_v1 TO service_role;
