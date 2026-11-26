-- Arbeitszeitkorrekturen ergänzen das bestehende Buchungsjournal.
ALTER TABLE public.arbeitszeit_buchung
  ADD COLUMN IF NOT EXISTS client_event_id uuid,
  ADD COLUMN IF NOT EXISTS korrigiert_id uuid,
  ADD COLUMN IF NOT EXISTS korrektur_grund text,
  ADD COLUMN IF NOT EXISTS lauf_id uuid,
  ADD COLUMN IF NOT EXISTS kostensatz_quelle text,
  ALTER COLUMN kostensatz_eur_pro_stunde DROP NOT NULL;

DO $arbeitszeit_vertrag$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.arbeitszeit_buchung'::regclass
      AND conname = 'arbeitszeit_buchung_kostensatz_chk'
  ) THEN
    ALTER TABLE public.arbeitszeit_buchung
    ADD CONSTRAINT arbeitszeit_buchung_kostensatz_chk CHECK (
      (kostensatz_quelle IS NULL OR kostensatz_quelle IN ('person', 'standard', 'fehlt'))
      AND (kostensatz_eur_pro_stunde IS NULL) = (kostensatz_quelle IS NOT DISTINCT FROM 'fehlt')
    ),
    ADD CONSTRAINT arbeitszeit_buchung_mandant_zeile_key UNIQUE (tenant_id, id),
    ADD CONSTRAINT arbeitszeit_buchung_mandant_befehl_key UNIQUE (tenant_id, client_event_id),
    ADD CONSTRAINT arbeitszeit_buchung_korrektur_fk FOREIGN KEY (tenant_id, korrigiert_id)
      REFERENCES public.arbeitszeit_buchung (tenant_id, id) NOT VALID,
    ADD CONSTRAINT arbeitszeit_buchung_dauer_und_korrektur_chk CHECK (
      dauer_minuten <> 0
      AND (dauer_minuten > 0 OR korrigiert_id IS NOT NULL)
      AND (korrigiert_id IS NULL) = (korrektur_grund IS NULL)
      AND (korrektur_grund IS NULL OR btrim(korrektur_grund) <> '')
      AND korrigiert_id IS DISTINCT FROM id
    ) NOT VALID;
  END IF;
END;
$arbeitszeit_vertrag$;

CREATE OR REPLACE FUNCTION private.arbeitszeit_buchung_unveraenderlich()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  RAISE EXCEPTION 'ARBEITSZEIT_BUCHUNG_UNVERAENDERLICH' USING ERRCODE = '23514';
END;
$funktion$;

REVOKE ALL ON FUNCTION private.arbeitszeit_buchung_unveraenderlich() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER arbeitszeit_buchung_unveraenderlich
  BEFORE UPDATE OR DELETE ON public.arbeitszeit_buchung
  FOR EACH ROW EXECUTE FUNCTION private.arbeitszeit_buchung_unveraenderlich();

-- Bisherige Lieferzusagen als Kalendertag übernehmen und danach nur due_date fortschreiben.
DO $liefertermin$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.orders'::regclass AND attname = 'promised_due_date' AND NOT attisdropped
  ) THEN
    UPDATE public.orders
    SET due_date = (promised_due_date AT TIME ZONE 'Europe/Berlin')::date
    WHERE promised_due_date IS NOT NULL
      AND due_date::date IS DISTINCT FROM (promised_due_date AT TIME ZONE 'Europe/Berlin')::date;
  END IF;
  IF to_regprocedure('private.update_order_promised_due_date_v1(text,uuid,uuid,text,date,text)') IS NOT NULL THEN
    ALTER FUNCTION private.update_order_promised_due_date_v1(text, uuid, uuid, text, date, text)
      RENAME TO update_order_delivery_date_v1;
  END IF;
END;
$liefertermin$;

CREATE OR REPLACE FUNCTION private.update_order_delivery_date_v1(
  p_tenant_id text, p_actor_id uuid, p_client_event_id uuid, p_order_id text, p_due_date date, p_reason text
)
RETURNS TABLE(result_code text, result_version integer, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_version integer; v_prior public.events%ROWTYPE;
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
    OR p_due_date IS NULL OR p_reason IS DISTINCT FROM btrim(p_reason) OR length(p_reason) NOT BETWEEN 3 AND 500
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::integer, false; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('s1:promise:' || p_tenant_id || ':' || p_actor_id || ':' || p_client_event_id, 0));
  SELECT event.* INTO v_prior FROM public.events event WHERE event.tenant_id = p_tenant_id AND event.user_id = p_actor_id
    AND event.client_event_id = p_client_event_id AND event.event_type = 'ORDER_PROMISED_DUE_DATE_CHANGED_V1';
  IF FOUND THEN RETURN QUERY SELECT 'OK'::text, v_prior.aggregate_version, true; RETURN; END IF;
  UPDATE public.orders SET due_date = p_due_date, version = version + 1
    WHERE id = p_order_id AND tenant_id = p_tenant_id RETURNING version INTO v_version;
  IF v_version IS NULL THEN RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::integer, false; RETURN; END IF;
  INSERT INTO public.events (id, tenant_id, order_id, event_type, description, notes, payload, status, user_id,
    client_event_id, event_schema_version, correlation_id, aggregate_version, created_at)
  VALUES (gen_random_uuid()::text, p_tenant_id, p_order_id, 'ORDER_PROMISED_DUE_DATE_CHANGED_V1',
    'Liefertermin geändert', p_reason, jsonb_build_object('promisedDueDate', p_due_date), 'success', p_actor_id,
    p_client_event_id, 1, gen_random_uuid(), v_version, statement_timestamp() AT TIME ZONE 'UTC');
  RETURN QUERY SELECT 'OK'::text, v_version, false;
END;
$$;

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
      orders.geprueft, orders.due_date, orders.intake_term_status
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
       OR order_row.due_date::date IS DISTINCT FROM (NEW.payload->>'deliveryDate')::date
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

CREATE OR REPLACE VIEW private.v_order_intake_receipts_v1 WITH (security_invoker=true) AS
WITH qualified AS (
SELECT receipt.id AS receipt_id,
    receipt.event_id,
    receipt.tenant_id,
    receipt.order_id,
    receipt.customer_id,
    receipt.actor_id,
    actor.full_name AS actor_display_name,
    receipt.client_event_id,
    receipt.correlation_id,
    receipt.intent_sha256,
    receipt.customer_mode,
    receipt.order_number,
    receipt.customer_display_name,
    receipt.due_date,
    receipt.note,
    receipt.geprueft,
    receipt.items_snapshot,
    receipt.created_at AS recorded_at,
    orders.version AS current_order_version,
    orders.station AS current_station,
    orders.status AS current_status,
    receipt.geprueft IS NOT DISTINCT FROM orders.geprueft AND event.id IS NOT NULL AND orders.id IS NOT NULL AND customer.id IS NOT NULL AND actor.id IS NOT NULL AND event.user_id = receipt.actor_id AND event.client_event_id = receipt.client_event_id AND event.correlation_id = receipt.correlation_id AND event.event_type::text = 'ORDER_INTAKE_CREATED_V1'::text AND event.status::text = 'success'::text AND orders.customer_id = receipt.customer_id AND (orders.due_date::date = receipt.due_date OR orders.due_date::date::text = (( SELECT due_event.payload ->> 'promisedDueDate'::text
           FROM events due_event
             JOIN app_users due_actor ON due_actor.tenant_id = due_event.tenant_id::text AND due_actor.id = due_event.user_id
          WHERE due_event.tenant_id::text = receipt.tenant_id AND due_event.order_id = receipt.order_id AND due_event.event_type::text = 'ORDER_PROMISED_DUE_DATE_CHANGED_V1'::text AND due_event.event_schema_version = 1 AND due_event.status::text = 'success'::text AND due_event.client_event_id IS NOT NULL AND due_event.correlation_id IS NOT NULL AND due_event.aggregate_version <= orders.version AND due_event.payload ? 'promisedDueDate'::text AND (due_event.payload ->> 'promisedDueDate'::text) ~ '^\d{4}-\d{2}-\d{2}$'::text AND due_event.notes = btrim(due_event.notes) AND length(due_event.notes) >= 3 AND length(due_event.notes) <= 500
          ORDER BY due_event.aggregate_version DESC, due_event.created_at DESC, due_event.id DESC
         LIMIT 1))) AND (receipt.intake_term_status IS NULL OR receipt.intake_term_status = orders.intake_term_status) AND (receipt.intake_source IS NULL OR receipt.intake_source = orders.intake_source) AND (NOT event.payload ? 'handoverMode'::text OR orders.handover_mode = COALESCE((
 SELECT bound.mode FROM (
 SELECT handover.payload->'receipt'->>'handoverMode' AS mode,handover.aggregate_version AS version,handover.created_at,handover.id
 FROM public.events handover
 JOIN public.app_users handover_actor ON handover_actor.tenant_id=handover.tenant_id AND handover_actor.id=handover.user_id
 JOIN public.intake_item original ON original.tenant_id=handover.tenant_id AND original.id::text=handover.payload->'receipt'->'mailActor'->>'originalItemId'
 JOIN public.intake_event applied ON applied.tenant_id=handover.tenant_id AND applied.item_id=original.id AND applied.befehl_id=handover.client_event_id AND applied.von=handover.user_id::text
 WHERE handover.tenant_id=receipt.tenant_id AND handover.order_id=receipt.order_id
 AND handover.event_type='ORDER_HANDOVER_MAIL_V1' AND handover.event_schema_version=1 AND handover.status='success'
 AND handover.client_event_id IS NOT NULL AND handover.correlation_id IS NOT NULL
 AND handover.aggregate_version<=orders.version AND handover.payload->>'requestHash' ~ '^[0-9a-f]{64}$'
 AND handover.payload->'receipt'->>'orderId'=receipt.order_id
 AND handover.payload->'receipt'->>'customerId'=receipt.customer_id
 AND handover.payload->'receipt'->>'orderVersion'=handover.aggregate_version::text
 AND handover.payload->'receipt'->>'handoverMode' IN ('pickup','shipping')
 AND handover.payload->'receipt'->>'outcome' IN ('changed','call_customer')
 AND handover.payload->'receipt'->'mailActor'->>'kind'='mail'
 AND handover.payload->'receipt'->'mailActor'->>'sender'=original.absender_adresse
 AND original.kanal='mail'
 AND applied.vorher->>'kunde_id'=receipt.customer_id AND applied.nachher->>'customerId'=receipt.customer_id
 AND applied.art='anliegen' AND applied.vorher->>'version'=handover.payload->'receipt'->'mailActor'->>'originalVersion'
 AND applied.nachher->>'orderId'=receipt.order_id
 AND applied.nachher->>'handoverMode'=handover.payload->'receipt'->>'handoverMode'
 AND applied.nachher->>'action' IN ('auftrag.uebergabe_geaendert','auftrag.uebergabe_klaeren')
 AND EXISTS(SELECT 1 FROM public.intake_file mime JOIN public.intake_event secured ON secured.tenant_id=mime.tenant_id AND secured.item_id=mime.item_id AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=mime.id::text AND secured.nachher->>'sha256'=mime.sha256 WHERE mime.tenant_id=handover.tenant_id AND mime.item_id=original.id AND mime.art='mime' AND mime.sha256=handover.payload->'receipt'->'mailActor'->>'originalSha256')

 UNION ALL
 SELECT manual.payload#>>'{receipt,handoverMode}' AS mode,manual.order_version AS version,manual.created_at,manual.event_id AS id
 FROM private.v_order_handover_manual_source_v1 manual
 WHERE manual.tenant_id=receipt.tenant_id AND manual.order_id=receipt.order_id
  AND manual.payload#>>'{receipt,customerId}'=receipt.customer_id AND manual.integrity_ok
 ) bound ORDER BY bound.version DESC,bound.created_at DESC,bound.id DESC LIMIT 1
 ),event.payload->>'handoverMode') AND ((event.payload ->> 'paymentMode'::text) = orders.payment_mode OR (EXISTS ( SELECT 1
           FROM events payment_event
             JOIN app_users payment_actor ON payment_actor.tenant_id = payment_event.tenant_id::text AND payment_actor.id = payment_event.user_id
          WHERE payment_event.tenant_id::text = receipt.tenant_id AND payment_event.order_id = receipt.order_id AND payment_event.event_type::text = 'PAYMENT_MODE_SET_V1'::text AND payment_event.event_schema_version = 1 AND payment_event.status::text = 'success'::text AND payment_event.station IS NULL AND payment_event.from_station IS NULL AND payment_event.client_event_id IS NOT NULL AND payment_event.correlation_id IS NOT NULL AND payment_event.aggregate_version = orders.payment_mode_version AND (payment_event.payload ->> 'orderId'::text) = receipt.order_id AND (payment_event.payload ->> 'paymentMode'::text) = orders.payment_mode AND (payment_event.payload ->> 'paymentModeVersion'::text) ~ '^[0-9]+$'::text AND ((payment_event.payload ->> 'paymentModeVersion'::text)::integer) = orders.payment_mode_version AND (payment_event.payload ->> 'expectedVersion'::text) ~ '^[0-9]+$'::text AND (((payment_event.payload ->> 'expectedVersion'::text)::integer) + 1) = orders.payment_mode_version AND (payment_event.payload ->> 'receiptId'::text) = ((('payment-mode://'::text || receipt.order_id) || '/'::text) || orders.payment_mode_version::text))))) AND jsonb_typeof(receipt.items_snapshot) = 'array'::text AND jsonb_array_length(receipt.items_snapshot) >= 1 AND jsonb_array_length(receipt.items_snapshot) <= 20 AND NOT (EXISTS ( SELECT 1
           FROM jsonb_array_elements(receipt.items_snapshot) snapshot(item)
             LEFT JOIN items line ON line.id = (snapshot.item ->> 'id'::text) AND line.order_id = receipt.order_id AND line.tenant_id::text = receipt.tenant_id AND line.customer_id = receipt.customer_id
             LEFT JOIN catalog_services service ON service.id =
                CASE
                    WHEN (snapshot.item ->> 'catalogServiceId'::text) IS NOT NULL THEN (snapshot.item ->> 'catalogServiceId'::text)::uuid
                    ELSE NULL::uuid
                END AND service.tenant_id = receipt.tenant_id
          WHERE line.id IS NULL OR line.name IS DISTINCT FROM (snapshot.item ->> 'name'::text) OR line.quantity IS DISTINCT FROM ((snapshot.item ->> 'quantity'::text)::numeric) OR line.material IS DISTINCT FROM NULLIF(snapshot.item ->> 'material'::text, ''::text) OR (NOT (NULLIF(btrim(snapshot.item ->> 'surfaceRequested'::text), ''::text) IS NOT NULL AND private.order_position_surface_read_key(snapshot.item ->> 'surfaceRequested'::text) IS NULL) AND line.surface_requested IS DISTINCT FROM private.order_position_surface_read_key(snapshot.item ->> 'surfaceRequested'::text)) OR line.execution_requested IS DISTINCT FROM COALESCE(snapshot.item ->> 'executionRequested'::text, 'offen'::text) OR
                CASE
                    WHEN (snapshot.item ->> 'catalogServiceId'::text) IS NOT NULL THEN service.id IS NULL OR line.catalog_service_id IS DISTINCT FROM service.id OR line.unit IS DISTINCT FROM private.order_position_unit_key(snapshot.item ->> 'unit'::text) OR round(line.preis_netto * 100::numeric)::integer IS DISTINCT FROM ((snapshot.item ->> 'unitPriceCents'::text)::integer) OR line.vat_rate_basis_points IS DISTINCT FROM ((snapshot.item ->> 'vatRateBasisPoints'::text)::integer)
                    ELSE line.catalog_service_id IS NOT NULL OR line.unit IS DISTINCT FROM private.order_position_unit_key(snapshot.item ->> 'unit'::text) OR line.unit IS NOT NULL AND (line.unit <> ALL (ARRAY['stueck'::text, 'kg'::text, 'dm2'::text, 'satz'::text, 'stunde'::text])) OR CASE WHEN (snapshot.item ->> 'unitPriceCents'::text) IS NOT NULL THEN
                      NOT (coalesce(snapshot.item ->> 'unitPriceCents'::text, '') ~ '^[1-9][0-9]{0,6}$' AND (snapshot.item ->> 'unitPriceCents'::text)::integer <= 9999999)
                      OR (snapshot.item ->> 'vatRateBasisPoints'::text)::integer IS DISTINCT FROM 1900
                      OR line.vat_rate_basis_points IS DISTINCT FROM 1900
                      OR round(line.preis_netto * 100::numeric)::integer IS DISTINCT FROM (snapshot.item ->> 'unitPriceCents'::text)::integer
                    ELSE line.vat_rate_basis_points IS NOT NULL OR NOT (line.preis_netto IS NULL OR (EXISTS ( SELECT 1
                       FROM events price_event
                         CROSS JOIN LATERAL jsonb_array_elements(price_event.payload -> 'prices'::text) price(entry)
                         JOIN app_users price_actor ON price_actor.id = price_event.user_id AND price_actor.tenant_id = price_event.tenant_id::text
                      WHERE price_event.tenant_id::text = receipt.tenant_id AND price_event.order_id = receipt.order_id AND price_event.event_type::text = 'ORDER_INVOICE_PRICES_SET_V1'::text AND price_event.event_schema_version = 1 AND price_event.status::text = 'success'::text AND price_event.aggregate_version <= orders.version AND price_event.payload ? 'requestHash'::text AND jsonb_typeof(price_event.payload -> 'prices'::text) = 'array'::text AND (price.entry ->> 'itemId'::text) = line.id AND COALESCE(price.entry ->> 'unitPriceCents'::text, ''::text) ~ '^[1-9][0-9]{0,8}$'::text AND ((price.entry ->> 'unitPriceCents'::text)::integer) = round(line.preis_netto * 100::numeric)::integer)))
                    END
                END)) AS integrity_ok,
    orders.handover_mode,
    orders.payment_mode,
    receipt.intake_term_status,
    receipt.intake_source
   FROM private.order_intake_receipts receipt
     LEFT JOIN events event ON event.id = receipt.event_id AND event.tenant_id::text = receipt.tenant_id
     LEFT JOIN orders orders ON orders.id = receipt.order_id AND orders.tenant_id::text = receipt.tenant_id
     LEFT JOIN customers customer ON customer.id = receipt.customer_id AND customer.tenant_id::text = receipt.tenant_id
     LEFT JOIN app_users actor ON actor.id = receipt.actor_id AND actor.tenant_id = receipt.tenant_id
  WHERE receipt.tenant_id = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text)
)
SELECT qualified.receipt_id,
    qualified.event_id,
    qualified.tenant_id,
    qualified.order_id,
    qualified.customer_id,
    qualified.actor_id,
    qualified.actor_display_name,
    qualified.client_event_id,
    qualified.correlation_id,
    qualified.intent_sha256,
    qualified.customer_mode,
    qualified.order_number,
    qualified.customer_display_name,
    qualified.due_date,
    qualified.note,
    qualified.geprueft,
    qualified.items_snapshot,
    qualified.recorded_at,
    qualified.current_order_version,
    qualified.current_station,
    qualified.current_status,
    (qualified.integrity_ok AND NOT (EXISTS (SELECT 1 FROM jsonb_array_elements(qualified.items_snapshot) AS item(value) WHERE NULLIF(btrim(item.value->>'surfaceRequested'),'') IS NOT NULL AND private.order_position_surface_read_key(item.value->>'surfaceRequested') IS NULL))) AS integrity_ok,
    qualified.handover_mode,
    qualified.payment_mode,
    qualified.intake_term_status,
    qualified.intake_source,
    qualified.integrity_ok AS surface_mapping_readable
FROM qualified;

CREATE OR REPLACE VIEW "public"."v_production_orders" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "order_number",
    "customer_id",
    "title",
    "task",
    "station",
    "current_station_id",
    "status",
    NULL::varchar(50) AS "risk",
    NULL::varchar(50) AS "priority_computed",
    "parts",
    "status_text",
    "delay_reason",
    "recommended_action",
    "intake_date",
    "due_date",
    "created_at",
    "current_station",
    "attachment_url",
    "attachment_urls",
    "inquiry_id",
    "kostenstelle_primaer_id",
    "db_geplant",
    "db_ist",
    "db_letzte_berechnung",
    "priority",
    "due_date" AT TIME ZONE 'Europe/Berlin' AS "promised_due_date",
    "completed_date",
    "payment_status",
    "delivery_method",
    "source",
    "source_ref",
    "freetext_original",
    "is_quote",
    "quote_status",
    "quote_converted_order_id",
    erste_zusage.termin AS erster_zugesagter_termin
   FROM "public"."orders"
   LEFT JOIN LATERAL (
     SELECT beleg.termin FROM (
       SELECT annahme.due_date AS termin, annahme.created_at AS erfasst_am, annahme.event_id AS beleg_id
       FROM private.order_intake_receipts annahme
       JOIN public.events eingang ON eingang.id = annahme.event_id
         AND eingang.tenant_id = annahme.tenant_id AND eingang.order_id = annahme.order_id
         AND eingang.user_id = annahme.actor_id AND eingang.client_event_id = annahme.client_event_id
         AND eingang.event_type = 'ORDER_INTAKE_CREATED_V1' AND eingang.status = 'success'
       WHERE annahme.tenant_id = orders.tenant_id AND annahme.order_id = orders.id
         AND annahme.geprueft IS TRUE AND annahme.intake_term_status = 'bestaetigt'
         AND annahme.due_date IS NOT NULL
       UNION ALL
       SELECT CASE WHEN pg_input_is_valid(aenderung.payload->>'promisedDueDate', 'date')
                THEN (aenderung.payload->>'promisedDueDate')::date END,
         aenderung.created_at AT TIME ZONE 'UTC', aenderung.id
       FROM public.events aenderung
       JOIN public.app_users akteur ON akteur.tenant_id = aenderung.tenant_id AND akteur.id = aenderung.user_id
       WHERE aenderung.tenant_id = orders.tenant_id AND aenderung.order_id = orders.id
         AND aenderung.event_type = 'ORDER_PROMISED_DUE_DATE_CHANGED_V1'
         AND aenderung.event_schema_version = 1 AND aenderung.status = 'success'
         AND aenderung.client_event_id IS NOT NULL AND aenderung.correlation_id IS NOT NULL
         AND aenderung.aggregate_version BETWEEN 1 AND orders.version
         AND aenderung.payload->>'promisedDueDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         AND aenderung.notes = btrim(aenderung.notes) AND length(aenderung.notes) BETWEEN 3 AND 500
     ) beleg
     WHERE beleg.termin IS NOT NULL
     ORDER BY beleg.erfasst_am, beleg.beleg_id
     LIMIT 1
   ) erste_zusage ON true
  WHERE ((("tenant_id")::"text" = 'galvanik-kreile'::"text") AND (COALESCE("source", ''::"text") <> ALL (ARRAY['seed'::"text", 'test'::"text", 'integration-test'::"text"])) AND ("customer_id" IS NOT NULL) AND (TRIM(BOTH FROM "customer_id") <> ''::"text") AND ("order_number" IS NOT NULL) AND (TRIM(BOTH FROM "order_number") <> ''::"text") AND ("order_number" !~* '^A-SEED-'::"text") AND ("order_number" !~* 'TEST'::"text") AND ((COALESCE(TRIM(BOTH FROM "title"), ''::"text") <> ''::"text") OR (COALESCE(TRIM(BOTH FROM "task"), ''::"text") <> ''::"text")) AND (NOT (((COALESCE("title", ''::"text") <> ''::"text") AND (TRIM(BOTH FROM "title") <> ''::"text") AND (("length"(TRIM(BOTH FROM "title")) < 3) OR (TRIM(BOTH FROM "title") ~* '^[bcdfghjklmnpqrstvwxyz]{5,}'::"text") OR (TRIM(BOTH FROM "title") ~* 'asd|sdf|dfg|fgh|ghj|hjk|jkl|yxc|xcv|cvb|vbn|bnm'::"text") OR (TRIM(BOTH FROM "title") ~* '^([a-z])\1+'::"text") OR ("lower"(TRIM(BOTH FROM "title")) = ANY (ARRAY['gjgvvh'::"text", 'sfdghgjklji'::"text"])) OR ("lower"(TRIM(BOTH FROM "title")) ~~ '%auftrag per scan test e2e%'::"text") OR ("lower"(TRIM(BOTH FROM "title")) ~~ '%test order%'::"text") OR ("lower"(TRIM(BOTH FROM "title")) ~~ '%test stoÃŸstange kundenakte%'::"text"))) OR ((COALESCE("task", ''::"text") <> ''::"text") AND (TRIM(BOTH FROM "task") <> ''::"text") AND (("length"(TRIM(BOTH FROM "task")) < 3) OR (TRIM(BOTH FROM "task") ~* '^[bcdfghjklmnpqrstvwxyz]{5,}'::"text") OR (TRIM(BOTH FROM "task") ~* 'asd|sdf|dfg|fgh|ghj|hjk|jkl|yxc|xcv|cvb|vbn|bnm'::"text") OR (TRIM(BOTH FROM "task") ~* '^([a-z])\1+'::"text") OR ("lower"(TRIM(BOTH FROM "task")) = ANY (ARRAY['gjgvvh'::"text", 'sfdghgjklji'::"text"])) OR ("lower"(TRIM(BOTH FROM "task")) ~~ '%auftrag per scan test e2e%'::"text") OR ("lower"(TRIM(BOTH FROM "task")) ~~ '%test order%'::"text") OR ("lower"(TRIM(BOTH FROM "task")) ~~ '%test stoÃŸstange kundenakte%'::"text"))))) AND (NOT ((COALESCE("order_number", ''::"text") ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'::"text") OR (COALESCE("title", ''::"text") ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'::"text") OR (COALESCE("task", ''::"text") ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'::"text"))));

CREATE OR REPLACE VIEW private.v_operational_station_queue_v1
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.tenant_id,
  o.version,
  o.order_number,
  o.customer_id,
  c.name AS customer_name,
  o.title,
  o.task,
  o.station,
  o.current_station,
  o.current_station_id,
  o.status,
  NULL::varchar(50) AS risk,
  o.intake_date,
  o.due_date,
  o.created_at,
  (
    c.id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.items corrupt_item
      WHERE corrupt_item.order_id = o.id
        AND (
          corrupt_item.tenant_id IS DISTINCT FROM o.tenant_id
          OR corrupt_item.customer_id IS DISTINCT FROM o.customer_id
        )
    )
  ) AS tenant_integrity_ok,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'tenantId', i.tenant_id,
        'orderId', i.order_id,
        'customerId', i.customer_id,
        'name', i.name,
        'quantity', i.quantity,
        'currentStationId', i.current_station_id,
        'material', i.material,
        'surfaceRequested', i.surface_requested,
        'photoIds', i.photo_ids,
        'photo', i.photo,
        'repairTypes', i.repair_types,
        'stationSequence', i.station_sequence,
        'currentStep', i.current_step,
        'internalNotes', i.internal_notes,
        'catalogServiceId', i.catalog_service_id,
        'standardLeadTimeWorkingDays', catalog.standard_lead_time_working_days,
        'createdAt', i.created_at
      )
      ORDER BY i.created_at, i.id
    ) FILTER (WHERE i.id IS NOT NULL),
    '[]'::jsonb
  ) AS parts,
  private.order_release_allowed_v1(o.tenant_id,o.id) AS ausgabe_frei,
  o.handover_mode
FROM public.orders o
LEFT JOIN public.customers c
  ON c.id = o.customer_id
 AND c.tenant_id = o.tenant_id
LEFT JOIN public.items i
  ON i.order_id = o.id
 AND i.tenant_id = o.tenant_id
 AND i.customer_id = o.customer_id
LEFT JOIN public.catalog_services catalog
  ON catalog.id = i.catalog_service_id
 AND catalog.tenant_id = i.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND o.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND coalesce(o.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
  AND coalesce(o.order_number, '') NOT ILIKE 'A-SEED-%'
  AND coalesce(o.order_number, '') NOT ILIKE '%TEST%'
GROUP BY
  o.id,
  o.tenant_id,
  o.version,
  o.order_number,
  o.customer_id,
  c.id,
  c.name,
  o.title,
  o.task,
  o.station,
  o.current_station,
  o.current_station_id,
  o.status,
  o.intake_date,
  o.due_date,
  o.created_at,
  o.handover_mode;

-- Termintreue misst gegen den ersten belegten Liefertermin.
CREATE OR REPLACE VIEW "public"."v_analyse_kunden_kpi" WITH ("security_invoker"='true') AS
 SELECT "id" AS "customer_id",
    COALESCE("company_name", "name") AS "kunde",
    "classification",
    "created_at" AS "kunde_seit",
    COALESCE(( SELECT "sum"("ar"."brutto") AS "sum"
           FROM ("public"."ausgangsrechnung" "ar"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "ar"."order_id")))
          WHERE (("o"."customer_id" = "c"."id") AND ("ar"."status" <> 'storniert'::"text") AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))), (0)::numeric) AS "umsatz_ltv",
    ((COALESCE(( SELECT "sum"("i"."preis_netto") AS "sum"
           FROM ("public"."items" "i"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "i"."order_id")))
          WHERE (("o"."customer_id" = "c"."id") AND (("i"."tenant_id")::"text" = 'galvanik-kreile'::"text"))), (0)::numeric) - COALESCE(( SELECT "sum"(("cu"."quantity" * "cu"."unit_cost_eur")) AS "sum"
           FROM ("public"."consumable_uses" "cu"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "cu"."order_id")))
          WHERE (("o"."customer_id" = "c"."id") AND ("cu"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric)) - COALESCE(( SELECT "sum"(((("az"."dauer_minuten")::numeric / 60.0) * "az"."kostensatz_eur_pro_stunde")) AS "sum"
           FROM ("public"."arbeitszeit_buchung" "az"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "az"."auftrag_id")))
          WHERE (("o"."customer_id" = "c"."id") AND ("az"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric)) AS "gewinn_ltv",
    COALESCE(( SELECT "sum"("ar"."brutto") AS "sum"
           FROM ("public"."ausgangsrechnung" "ar"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "ar"."order_id")))
          WHERE (("o"."customer_id" = "c"."id") AND ("ar"."bezahlt_am" IS NULL) AND ("ar"."status" <> ALL (ARRAY['storniert'::"text", 'bezahlt'::"text"])) AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))), (0)::numeric) AS "offene_posten",
    ( SELECT "count"(*) AS "count"
           FROM "public"."v_production_orders" "o"
          WHERE (("o"."customer_id" = "c"."id") AND (("o"."status")::"text" <> ALL ((ARRAY['abgeschlossen'::character varying, 'storniert'::character varying])::"text"[])))) AS "aktive_auftraege",
        CASE
            WHEN (( SELECT "count"(*) AS "count"
               FROM "public"."v_production_orders" "o"
              WHERE (("o"."customer_id" = "c"."id") AND ("o"."completed_date" IS NOT NULL) AND ("o".erster_zugesagter_termin IS NOT NULL))) > 0) THEN "round"((((( SELECT "count"(*) AS "count"
               FROM "public"."v_production_orders" "o"
              WHERE (("o"."customer_id" = "c"."id") AND (("o"."completed_date" AT TIME ZONE 'Europe/Berlin')::date <= "o".erster_zugesagter_termin) AND ("o"."completed_date" IS NOT NULL) AND ("o".erster_zugesagter_termin IS NOT NULL))))::numeric * 100.0) / (( SELECT "count"(*) AS "count"
               FROM "public"."v_production_orders" "o"
              WHERE (("o"."customer_id" = "c"."id") AND ("o"."completed_date" IS NOT NULL) AND ("o".erster_zugesagter_termin IS NOT NULL))))::numeric), 1)
            ELSE NULL::numeric
        END AS "puenklichkeit_pct",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM ("public"."complaints" "co"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "co"."order_id")))
          WHERE (("o"."customer_id" = "c"."id") AND ("co"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::bigint) AS "reklamationen"
   FROM "public"."customers" "c"
  WHERE (("tenant_id")::"text" = 'galvanik-kreile'::"text");

CREATE OR REPLACE VIEW "public"."v_analyse_termintreue" WITH ("security_invoker"='true') AS
 SELECT "count"(*) FILTER (WHERE (("completed_date" IS NOT NULL) AND (erster_zugesagter_termin IS NOT NULL) AND (("completed_date" AT TIME ZONE 'Europe/Berlin')::date <= erster_zugesagter_termin))) AS "puenktlich",
    "count"(*) FILTER (WHERE (("completed_date" IS NOT NULL) AND (erster_zugesagter_termin IS NOT NULL))) AS "nenner",
        CASE
            WHEN ("count"(*) FILTER (WHERE (("completed_date" IS NOT NULL) AND (erster_zugesagter_termin IS NOT NULL))) > 0) THEN "round"(((("count"(*) FILTER (WHERE ((("completed_date" AT TIME ZONE 'Europe/Berlin')::date <= erster_zugesagter_termin) AND ("completed_date" IS NOT NULL) AND (erster_zugesagter_termin IS NOT NULL))))::numeric * 100.0) / ("count"(*) FILTER (WHERE (("completed_date" IS NOT NULL) AND (erster_zugesagter_termin IS NOT NULL))))::numeric), 1)
            ELSE NULL::numeric
        END AS "termintreue_pct",
    "count"(*) FILTER (WHERE ((erster_zugesagter_termin IS NULL) AND (("status")::"text" <> 'storniert'::"text"))) AS "ohne_zusagetermin"
   FROM "public"."v_production_orders"
  WHERE ("created_at" >= "date_trunc"('week'::"text", "now"()));

-- Die Diagnose- und Stationssichten behalten ihre Spaltenform. Der Auftrag hat nur einen Liefertermin.
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS promised_due_date,
  DROP COLUMN IF EXISTS risk,
  DROP COLUMN IF EXISTS priority_computed;

CREATE INDEX IF NOT EXISTS orders_spur_d_offene_zusage_idx
  ON public.orders (tenant_id, due_date)
  WHERE completed_date IS NULL;

-- Werkstatt-Ereignisse in der vorhandenen Quellenzuordnung für Dein Tag.
CREATE OR REPLACE FUNCTION private.today_event_scope_v1(event_type text)
RETURNS text LANGUAGE sql IMMUTABLE CALLED ON NULL INPUT PARALLEL SAFE SET search_path=pg_catalog AS $scope$
 SELECT CASE
  WHEN event_type IN (
   'ORDER_CANCELLED_V1',
   'ORDER_COLLECTION_ATTACH_PENDING_V1',
   'ORDER_COLLECTION_ATTACH_REPAIRED_V1',
   'ORDER_COLLECTION_CALL_CREATED_V1',
   'ORDER_COLLECTION_CALL_RESULT_V1',
   'ORDER_COLLECTION_CALL_UPDATED_V1',
   'ORDER_COLLECTION_MEMBER_REMOVED_V1',
   'ORDER_COLLECTION_PLANNED_V1',
   'ORDER_COLLECTION_REMINDER_PREPARED_V1',
   'ORDER_COLLECTION_REMINDER_SENT_V1',
   'ORDER_COLLECTION_REPLY_RECORDED_V1',
   'ORDER_COLLECTION_TASK_ENDED_FOR_APPOINTMENT_V1',
   'ORDER_COLLECTION_TASK_ENDED_FOR_REPLY_V1',
   'ORDER_CONTENT_CHANGED_V1',
   'ORDER_CUSTOMER_INFORMED_V1',
   'ORDER_FREEZE_CORRECTED_V1',
   'ORDER_FROZEN_V1',
   'ORDER_GOODS_OUT_DEBT_OVERRIDE_V1',
   'ORDER_HANDOVER_CHANGED_V1',
   'ORDER_HANDOVER_MAIL_V1',
   'ORDER_INTAKE_CREATED_V1',
   'ORDER_INTAKE_ORIGINAL_V1',
   'ORDER_INVOICE_PRICES_SET_V1',
   'ORDER_ITEM_EXTRA_WORK_CHANGED_V1',
   'ORDER_ITEM_FINISHED_CHANGED_V1',
   'ORDER_EXTRA_WORK_APPROVED_V1',
   'ORDER_ITEM_SCRAP_REPORTED_V1',
   'ORDER_PICKED_UP_V1',
   'ORDER_PICKED_UP_V2',
   'ORDER_PICKED_UP_V3',
   'ORDER_PICKED_UP_V4',
   'ORDER_PICKUP_APPOINTMENT_SET_V1',
   'ORDER_PICKUP_NOTICE_CHANGED_V1',
   'ORDER_PRINT_JOBS_QUEUED_V1',
   'ORDER_PRINT_JOBS_RETIRED_V1',
   'ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1',
   'ORDER_PROMISED_DUE_DATE_CHANGED_V1',
   'ORDER_REWORK_CREATED_V1',
   'ORDER_STATION_CORRECTED_V1',
   'ORDER_STATION_MOVED_V1',
   'ORDER_STORAGE_FINAL_TASK_CLOSED_V1',
   'ORDER_STORAGE_FINAL_TASK_CREATED_V1',
   'ORDER_STORAGE_FINAL_TASK_UPDATED_V1',
   'ORDER_STORAGE_LETTER_VOIDED_V1',
   'ORDER_TASK_ASSIGNED_V1',
   'ORDER_TASK_HANDED_BACK_V1',
   'PAYMENT_MODE_SET_V1',
   'SHIPMENT_GROUP_HANDED_OVER_V1',
   'SHIPMENT_HANDED_OVER_V1',
   'SHIPMENT_MANUAL_TRACKING_SET_V1') THEN 'order'
  WHEN event_type IN (
   'COMMUNICATION_COLLECTION_EFFECT_RETRY_REQUIRED_V1',
   'COMMUNICATION_COMPLAINT_EFFECT_RETRY_REQUIRED_V1',
   'COMMUNICATION_DELIVERY_FAILED_V1',
   'COMMUNICATION_DOCUMENT_EFFECTS_APPLIED_V1',
   'COMMUNICATION_DOCUMENT_EFFECT_RETRY_REQUIRED_V1',
   'COMMUNICATION_DOCUMENT_PREPARED_V1',
   'COMMUNICATION_DOCUMENT_SENT_V1',
   'COMMUNICATION_INVOICE_HANDED_OVER_V1',
   'COMMUNICATION_INVOICE_TASK_CREATED_V1',
   'COMMUNICATION_MAIL_PREPARED_V1',
   'COMMUNICATION_MAIL_RESEND_CONFIRMED_V1',
   'COMMUNICATION_MAIL_SENT_V1',
   'CUSTOMER_AGREEMENT_REVOKED_V1',
   'CUSTOMER_AGREEMENT_SAVED_V1',
   'CUSTOMER_CREATED_V1',
   'CUSTOMER_CREDIT_PAYOUT_V1',
   'CUSTOMER_INVOICE_TERMS_ENABLED_V1',
   'CUSTOMER_UPDATED_V1') THEN 'customer'
  WHEN event_type IN (
   'INVOICE_CANCELLED_V1',
   'INVOICE_CREATED_V1',
   'INVOICE_CREATED_V2',
   'INVOICE_CREATED_V3',
   'INVOICE_MAIL_REMAINDER_PENDING_V1',
   'INVOICE_MAIL_REQUEST_SNAPSHOT_V1',
   'PAYMENT_CONFIRMED_V1') THEN 'invoice'
  WHEN event_type IN (
   'QUOTE_AWARDED_V1',
   'QUOTE_CALCULATION_V04',
   'QUOTE_COMPLAINT_LINKED_V1',
   'QUOTE_CONVERSION_REVERSED_V04',
   'QUOTE_CREATED_V1',
   'QUOTE_FOLLOWUP_COMPLETED_V1',
   'QUOTE_LIFECYCLE_V04',
   'QUOTE_MINUTES_FROM_TOTAL_V1',
   'QUOTE_ONSITE_PHASE_V04',
   'QUOTE_ONSITE_REQUESTED_V04',
   'QUOTE_ORDER_TASK_V1',
   'QUOTE_SETTINGS_UPDATED_V04',
   'QUOTE_SHIPPING_INCLUDED_SET_V1',
   'QUOTE_UPDATED_V1',
   'QUOTE_VAT_FROM_COMPANY_V1') THEN 'quote'
  WHEN event_type IN (
   'GOODS_RECEIPT_SAVED_V1',
   'INTAKE_DRAFT_DISCARDED_V1',
   'INTAKE_DRAFT_SAVED_V1') THEN 'intake'
  WHEN event_type IN (
   'USER_LAST_SEEN_RECORDED_V1') THEN 'none'
  WHEN event_type IN (
   'COMPLAINT_CHANGED_V1',
   'CUSTOMER_COMMERCIAL_UPDATED_V1',
   'CUSTOMER_NOTE_CHANGED_V1',
   'DELIVERY_NOTE_ORIGINAL_V1',
   'DELIVERY_NOTE_REQUESTED_V1',
   'DISPATCH_REPLY_RETRY_REQUIRED_V1',
   'EMAIL_TEMPLATE_UPDATED_V1',
   'EXTRA_WORK_CATALOG_CONFIGURED_V1',
   'EXTRA_WORK_RATE_SET_V1',
   'GALVANIK_HANDOFF_ORIGINAL_V1',
   'OFFLINE_NOTE_CONFLICT_TASK_V1',
   'OFFLINE_NOTE_CONFLICT_V1',
   'OFFLINE_WORKSHOP_REJECTED_TASK_V1',
   'OFFLINE_WORKSHOP_REJECTED_V1',
   'LAGER_STAMMBEFEHL_V1',
   'LAGER_ARTIKEL_AUFGABE_V1',
   'ORDER_BUNDLE_RUN_STARTED_V1',
   'ORDER_BUNDLE_RUN_COMPLETED_V1') THEN 'tenant'
  ELSE 'tenant' END
$scope$;

DO $mehrarbeit_vertrag$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass
      AND conname = 'events_extra_work_approval_v1_contract_chk'
  ) THEN
    ALTER TABLE public.events ADD CONSTRAINT events_extra_work_approval_v1_contract_chk
  CHECK (
    CASE WHEN event_type = 'ORDER_EXTRA_WORK_APPROVED_V1' THEN
      coalesce(
        nullif(btrim(tenant_id), '') IS NOT NULL
        AND nullif(btrim(order_id), '') IS NOT NULL
        AND user_id IS NOT NULL
        AND jsonb_typeof(payload) = 'object'
        AND jsonb_typeof(payload->'approvedNetAmountCents') = 'number'
        AND (payload->>'approvedNetAmountCents') ~ '^(0|[1-9][0-9]*)$'
        AND (payload->'approvedNetAmountCents') <= '9007199254740991'::jsonb
        AND jsonb_typeof(payload->'positions') = 'array'
        AND (payload->'positions') <> '[]'::jsonb
        AND jsonb_path_query_array(payload, $positions$
          $.positions[*] ? (@.type() == "object"
            && @.lineId.type() == "string"
            && @.lineId like_regex "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
            && @.lineVersion.type() == "number"
            && @.lineVersion.floor() == @.lineVersion
            && @.lineVersion >= 1 && @.lineVersion <= 2147483647)
        $positions$) = payload->'positions'
        AND CASE payload->>'channel'
          WHEN 'mail' THEN jsonb_typeof(payload->'intakeItemId') = 'string'
            AND (payload->>'intakeItemId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          WHEN 'telefon' THEN NOT (payload ? 'intakeItemId')
          ELSE false
        END
        AND jsonb_typeof(payload->'approvedAt') = 'string'
        AND (payload->>'approvedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
        AND pg_input_is_valid(payload->>'approvedAt', 'timestamptz')
        AND jsonb_typeof(payload->'approvedBy') = 'string'
        AND nullif(btrim(payload->>'approvedBy'), '') IS NOT NULL
        AND jsonb_typeof(payload->'confirmationText') = 'string'
        AND nullif(btrim(payload->>'confirmationText'), '') IS NOT NULL,
        false
      )
    ELSE true END
  );
  END IF;
END;
$mehrarbeit_vertrag$;

CREATE OR REPLACE TRIGGER events_extra_work_approval_update_immutable
BEFORE UPDATE ON public.events FOR EACH ROW
WHEN (OLD.event_type = 'ORDER_EXTRA_WORK_APPROVED_V1' OR NEW.event_type = 'ORDER_EXTRA_WORK_APPROVED_V1')
EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE OR REPLACE TRIGGER events_extra_work_approval_delete_immutable
BEFORE DELETE ON public.events FOR EACH ROW
WHEN (OLD.event_type = 'ORDER_EXTRA_WORK_APPROVED_V1')
EXECUTE FUNCTION public.prevent_audit_mutation();
