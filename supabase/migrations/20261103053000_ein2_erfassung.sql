-- P39: historical inspection is unknown, never invented from an intake event.
-- No default and no backfill; every new intake supplies an explicit boolean.
ALTER TABLE public.orders ADD COLUMN geprueft boolean;
ALTER TABLE private.order_intake_receipts ADD COLUMN geprueft boolean;
ALTER TABLE private.intake_drafts
 ADD COLUMN art text CHECK (art IS NULL OR art IN ('eingang','kunde')),
 ADD COLUMN zuletzt_feld text;
-- D06: only the authenticated server may remove its own draft in the booking transaction.
GRANT DELETE ON TABLE private.intake_drafts TO service_role;
-- X12: one row per capture, any number of drafts per login; originals stay intact.
ALTER TABLE private.intake_drafts DROP CONSTRAINT intake_drafts_tenant_id_actor_id_key;
CREATE INDEX intake_drafts_actor_open_idx ON private.intake_drafts(tenant_id,actor_id,updated_at DESC) WHERE status='open';
COMMENT ON TABLE private.intake_drafts IS 'X12: private capture drafts, scoped to the authenticated tenant and login.';

-- Decision 16/P33: orders.id is the only order reference. Unmatched legacy data aborts.
DO $ref$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.intake_item i
    WHERE i.vorgang_art='auftrag' AND i.vorgang_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.tenant_id=i.tenant_id AND o.id=i.vorgang_id)
      AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.tenant_id=i.tenant_id AND o.order_number=i.vorgang_id)
  ) THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='INTAKE_VORGANG_MIGRATION_TARGET_MISSING'; END IF;
  UPDATE public.intake_item i SET vorgang_id=o.id, version=i.version+1, updated_at=statement_timestamp()
    FROM public.orders o
    WHERE i.tenant_id=o.tenant_id AND i.vorgang_art='auftrag' AND i.vorgang_id=o.order_number
      AND i.vorgang_id IS DISTINCT FROM o.id;
END;
$ref$;

CREATE INDEX intake_event_live_files_idx ON public.intake_event(tenant_id,zeit,id)
  WHERE art IN ('original_gespeichert','erkannt');

-- AP-EIN Teil 2, spec 21d0347a3319: one intake, canonical position keys and scheduling.
-- Local replay only until the planning review authorizes Dev. No business row is deleted.
-- Existing dependent views are recreated atomically with their original security and grants.

CREATE FUNCTION private.order_position_unit_key(p_value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $fn$
BEGIN
  IF p_value IS NULL OR btrim(p_value)='' THEN RETURN NULL; END IF;
  CASE btrim(p_value)
    WHEN 'Stück' THEN RETURN 'stueck';
    WHEN 'stueck' THEN RETURN 'stueck';
    WHEN 'kg' THEN RETURN 'kg';
    WHEN 'dm²' THEN RETURN 'dm2';
    WHEN 'dm2' THEN RETURN 'dm2';
    WHEN 'Satz' THEN RETURN 'satz';
    WHEN 'satz' THEN RETURN 'satz';
    WHEN 'Std.' THEN RETURN 'stunde';
    WHEN 'stunde' THEN RETURN 'stunde';
    ELSE RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='ORDER_POSITION_UNIT_KEY_UNKNOWN';
  END CASE;
END; $fn$;
REVOKE ALL ON FUNCTION private.order_position_unit_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.order_position_unit_key(text) TO service_role;

CREATE FUNCTION private.order_position_surface_key(p_value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $fn$
BEGIN
  IF p_value IS NULL OR btrim(p_value)='' THEN RETURN NULL; END IF;
  CASE btrim(p_value)
    WHEN 'Verchromen' THEN RETURN 'verchromen';
    WHEN 'verchromen' THEN RETURN 'verchromen';
    WHEN 'Vernickeln' THEN RETURN 'vernickeln';
    WHEN 'vernickeln' THEN RETURN 'vernickeln';
    WHEN 'Verzinken' THEN RETURN 'verzinken';
    WHEN 'verzinken' THEN RETURN 'verzinken';
    WHEN 'Entchromen / prüfen' THEN RETURN 'entchromen_pruefen';
    WHEN 'entchromen_pruefen' THEN RETURN 'entchromen_pruefen';
    WHEN 'noch zu klären' THEN RETURN 'offen';
    WHEN 'offen' THEN RETURN 'offen';
    ELSE RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='ORDER_POSITION_SURFACE_KEY_UNKNOWN';
  END CASE;
END; $fn$;
REVOKE ALL ON FUNCTION private.order_position_surface_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.order_position_surface_key(text) TO service_role;

CREATE FUNCTION private.order_position_quantity_valid(p_quantity numeric,p_unit text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $fn$
  SELECT p_quantity>0 AND p_quantity<=99999
    AND p_quantity*1000=trunc(p_quantity*1000)
    AND (private.order_position_unit_key(p_unit) NOT IN ('stueck','satz') OR p_quantity=trunc(p_quantity))
    AND (p_unit IS NOT NULL OR p_quantity=trunc(p_quantity));
$fn$;
REVOKE ALL ON FUNCTION private.order_position_quantity_valid(numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.order_position_quantity_valid(numeric,text) TO service_role;

DROP VIEW "private"."v_customer_summary_v1";
DROP VIEW "private"."v_invoice_issue_source_v2";
DROP VIEW "private"."v_open_quotes_v1";
DROP VIEW "private"."v_card_search_documents_v1";
DROP VIEW "private"."v_invoice_issue_source_v1";
DROP VIEW "private"."v_operational_station_queue_v1";
DROP VIEW "private"."v_order_intake_receipts_v1";
DROP VIEW "private"."v_quotes_v1";
ALTER TABLE public.items ALTER COLUMN quantity TYPE numeric USING quantity::numeric;
-- KV decimal quantities remain blocked pending the recorded generated-column decision.
-- line_total_cents depends on quantity; no column is dropped or duplicated here.
ALTER TABLE private.quote_positions ADD COLUMN unit text, ADD COLUMN aufwand_min integer;

CREATE VIEW "private"."v_quotes_v1" WITH (security_invoker=true) AS
SELECT quote.id AS quote_id,
    quote.tenant_id,
    quote.quote_number,
    quote.customer_id,
    customer.customer_number,
    COALESCE(NULLIF(customer.company_name, ''::text), customer.name) AS customer_display_name,
    quote.status,
    quote.version,
    quote.currency,
    quote.due_date,
    quote.note,
    quote.total_net_cents,
    quote.linked_order_id,
    quote.created_by,
    creator.full_name AS actor_display_name,
    quote.created_at,
    quote.updated_at,
    quote.converted_at,
    positions.positions,
    customer.id IS NOT NULL AND creator.id IS NOT NULL AND positions.position_count >= 1 AND positions.position_count <= 20 AND positions.calculated_total = quote.total_net_cents AND (quote.valid_until IS NULL AND quote.intake_term_status IS NULL AND quote.intake_source IS NULL OR quote.valid_until IS NOT NULL AND (quote.intake_term_status = ANY (ARRAY['wunsch'::text, 'bestaetigt'::text, 'verschoben'::text, 'gegenvorschlag'::text])) AND (quote.intake_source = ANY (ARRAY['persoenlich'::text, 'versand'::text, 'abholung_firma'::text, 'anfrage_mail'::text, 'anfrage_telefon'::text]))) AND (quote.status = 'draft'::text AND quote.version >= 1 AND quote.linked_order_id IS NULL OR quote.status = 'converted'::text AND quote.version >= 2 AND quote.linked_order_id IS NOT NULL AND (EXISTS ( SELECT 1
           FROM private.quote_conversion_receipts receipt
          WHERE receipt.tenant_id = quote.tenant_id AND receipt.quote_id = quote.id AND receipt.order_id = quote.linked_order_id AND receipt.quote_version = quote.version))) AS integrity_ok,
    quote.valid_until,
    quote.intake_term_status,
    quote.intake_source
   FROM private.quotes quote
     LEFT JOIN customers customer ON customer.tenant_id::text = quote.tenant_id AND customer.id = quote.customer_id
     LEFT JOIN app_users creator ON creator.tenant_id = quote.tenant_id AND creator.id = quote.created_by
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS position_count,
            COALESCE(sum("position".line_total_cents), 0::numeric)::bigint AS calculated_total,
            jsonb_agg(jsonb_build_object('id', "position".id::text, 'position', "position"."position", 'name', "position".name, 'quantity', "position".quantity, 'material', "position".material, 'surfaceRequested', "position".surface_requested, 'unitPriceCents', "position".unit_price_cents, 'lineTotalCents', "position".line_total_cents) ORDER BY "position"."position") AS positions
           FROM private.quote_positions "position"
          WHERE "position".tenant_id = quote.tenant_id AND "position".quote_id = quote.id AND "position".revision = quote.version) positions ON true
  WHERE NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND quote.tenant_id = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text);
REVOKE ALL ON TABLE "private"."v_quotes_v1" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE "private"."v_quotes_v1" TO service_role;

CREATE VIEW "private"."v_order_intake_receipts_v1" WITH (security_invoker=true) AS
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
    receipt.geprueft IS NOT DISTINCT FROM orders.geprueft AND event.id IS NOT NULL AND orders.id IS NOT NULL AND customer.id IS NOT NULL AND actor.id IS NOT NULL AND event.user_id = receipt.actor_id AND event.client_event_id = receipt.client_event_id AND event.correlation_id = receipt.correlation_id AND event.event_type::text = 'ORDER_INTAKE_CREATED_V1'::text AND event.status::text = 'success'::text AND orders.customer_id = receipt.customer_id AND (orders.promised_due_date IS NULL OR orders.due_date::date = orders.promised_due_date::date) AND (COALESCE(orders.promised_due_date, orders.due_date::timestamp with time zone)::date = receipt.due_date OR COALESCE(orders.promised_due_date, orders.due_date::timestamp with time zone)::date::text = (( SELECT due_event.payload ->> 'promisedDueDate'::text
           FROM events due_event
             JOIN app_users due_actor ON due_actor.tenant_id = due_event.tenant_id::text AND due_actor.id = due_event.user_id
          WHERE due_event.tenant_id::text = receipt.tenant_id AND due_event.order_id = receipt.order_id AND due_event.event_type::text = 'ORDER_PROMISED_DUE_DATE_CHANGED_V1'::text AND due_event.event_schema_version = 1 AND due_event.status::text = 'success'::text AND due_event.client_event_id IS NOT NULL AND due_event.correlation_id IS NOT NULL AND due_event.aggregate_version <= orders.version AND due_event.payload ? 'promisedDueDate'::text AND (due_event.payload ->> 'promisedDueDate'::text) ~ '^\d{4}-\d{2}-\d{2}$'::text AND due_event.notes = btrim(due_event.notes) AND length(due_event.notes) >= 3 AND length(due_event.notes) <= 500
          ORDER BY due_event.aggregate_version DESC, due_event.created_at DESC, due_event.id DESC
         LIMIT 1))) AND (receipt.intake_term_status IS NULL OR receipt.intake_term_status = orders.intake_term_status) AND (receipt.intake_source IS NULL OR receipt.intake_source = orders.intake_source) AND (NOT event.payload ? 'handoverMode'::text OR (event.payload ->> 'handoverMode'::text) = orders.handover_mode AND ((event.payload ->> 'paymentMode'::text) = orders.payment_mode OR (EXISTS ( SELECT 1
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
          WHERE line.id IS NULL OR line.name IS DISTINCT FROM (snapshot.item ->> 'name'::text) OR line.quantity IS DISTINCT FROM ((snapshot.item ->> 'quantity'::text)::numeric) OR line.material IS DISTINCT FROM NULLIF(snapshot.item ->> 'material'::text, ''::text) OR line.surface_requested IS DISTINCT FROM private.order_position_surface_key(snapshot.item ->> 'surfaceRequested'::text) OR line.execution_requested IS DISTINCT FROM COALESCE(snapshot.item ->> 'executionRequested'::text, 'offen'::text) OR
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
  WHERE receipt.tenant_id = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text);
REVOKE ALL ON TABLE "private"."v_order_intake_receipts_v1" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE "private"."v_order_intake_receipts_v1" TO service_role;

CREATE VIEW "private"."v_operational_station_queue_v1" WITH (security_invoker=true) AS
SELECT o.id,
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
    o.priority_computed AS risk,
    o.intake_date,
    o.due_date,
    o.created_at,
    c.id IS NOT NULL AND NOT (EXISTS ( SELECT 1
           FROM items corrupt_item
          WHERE corrupt_item.order_id = o.id AND (corrupt_item.tenant_id::text IS DISTINCT FROM o.tenant_id::text OR corrupt_item.customer_id IS DISTINCT FROM o.customer_id))) AS tenant_integrity_ok,
    COALESCE(jsonb_agg(jsonb_build_object('id', i.id, 'tenantId', i.tenant_id, 'orderId', i.order_id, 'customerId', i.customer_id, 'name', i.name, 'quantity', i.quantity, 'currentStationId', i.current_station_id, 'material', i.material, 'surfaceRequested', i.surface_requested, 'photoIds', i.photo_ids, 'photo', i.photo, 'repairTypes', i.repair_types, 'stationSequence', i.station_sequence, 'currentStep', i.current_step, 'internalNotes', i.internal_notes, 'catalogServiceId', i.catalog_service_id, 'standardLeadTimeWorkingDays', catalog.standard_lead_time_working_days, 'createdAt', i.created_at) ORDER BY i.created_at, i.id) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS parts
   FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id AND c.tenant_id::text = o.tenant_id::text
     LEFT JOIN items i ON i.order_id = o.id AND i.tenant_id::text = o.tenant_id::text AND i.customer_id = o.customer_id
     LEFT JOIN catalog_services catalog ON catalog.id = i.catalog_service_id AND catalog.tenant_id = i.tenant_id::text
  WHERE NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND o.tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) AND (COALESCE(o.source, 'manual'::text) <> ALL (ARRAY['seed'::text, 'test'::text, 'demo'::text, 'integration-test'::text])) AND COALESCE(o.order_number, ''::text) !~~* 'A-SEED-%'::text AND COALESCE(o.order_number, ''::text) !~~* '%TEST%'::text
  GROUP BY o.id, o.tenant_id, o.version, o.order_number, o.customer_id, c.id, c.name, o.title, o.task, o.station, o.current_station, o.current_station_id, o.status, o.priority_computed, o.intake_date, o.due_date, o.created_at;
REVOKE ALL ON TABLE "private"."v_operational_station_queue_v1" FROM PUBLIC,anon,authenticated,service_role;

CREATE VIEW "private"."v_invoice_issue_source_v1" WITH (security_invoker=true) AS
SELECT freeze_state.tenant_id,
    freeze_state.order_id,
    freeze_state.freeze_id,
    freeze_state.frozen_at,
    (freeze_state.frozen_at AT TIME ZONE 'Europe/Berlin'::text)::date AS service_date,
    freeze_state.order_version AS freeze_order_version,
    orders.version AS current_order_version,
    orders.order_number,
    orders.title AS order_title,
    orders.station,
    orders.status AS order_status,
    orders.customer_id,
        CASE
            WHEN customer.type::text = 'privat'::text THEN concat_ws(' '::text,
            CASE customer.salutation
                WHEN 'frau'::text THEN 'Frau'::text
                WHEN 'herr'::text THEN 'Herr'::text
                ELSE NULL::text
            END, customer.first_name, customer.last_name)
            ELSE customer.name
        END AS customer_name,
    customer.company_name AS customer_company_name,
        CASE
            WHEN customer.type::text = 'business'::text AND NULLIF(concat_ws(' '::text, customer.first_name, customer.last_name), ''::text) IS NOT NULL THEN 'z. Hd. '::text || concat_ws(' '::text,
            CASE customer.salutation
                WHEN 'frau'::text THEN 'Frau'::text
                WHEN 'herr'::text THEN 'Herr'::text
                ELSE NULL::text
            END, customer.first_name, customer.last_name)
            ELSE NULL::text
        END AS customer_contact_person,
        CASE
            WHEN NULLIF(btrim(customer.street), ''::text) IS NOT NULL THEN NULLIF(btrim(concat_ws(' '::text, customer.street, customer.house_number)), ''::text)
            ELSE NULL::text
        END AS customer_street,
    customer.zip_code AS customer_zip,
    customer.city AS customer_city,
    customer.country AS customer_country,
    company.company_name AS seller_company_name,
    company.street AS seller_street,
    company.zip AS seller_zip,
    company.city AS seller_city,
    company.country AS seller_country,
    company.tax_id AS seller_tax_id,
    company.iban AS seller_iban,
    company.bic AS seller_bic,
    company.bank_name AS seller_bank_name,
    company.invoice_vat_rate_basis_points,
    company.invoice_payment_term_days,
    COALESCE(base_items.base_lines, '[]'::jsonb) AS base_lines,
    COALESCE(base_items.base_line_count, 0) AS base_line_count,
    COALESCE(base_items.base_net_amount_cents, 0::bigint) AS base_net_amount_cents,
    COALESCE(extra_work.lines, '[]'::jsonb) AS extra_work_lines,
    freeze_state.line_count AS extra_work_line_count,
    freeze_state.total_amount_cents AS extra_work_net_amount_cents,
    company.config_count = 1 AND NULLIF(btrim(company.company_name), ''::text) IS NOT NULL AND NULLIF(btrim(company.street), ''::text) IS NOT NULL AND NULLIF(btrim(company.zip), ''::text) IS NOT NULL AND NULLIF(btrim(company.city), ''::text) IS NOT NULL AND NULLIF(btrim(company.country), ''::text) IS NOT NULL AND NULLIF(btrim(company.tax_id), ''::text) IS NOT NULL AND NULLIF(btrim(company.iban), ''::text) IS NOT NULL AND NULLIF(btrim(company.bic), ''::text) IS NOT NULL AND NULLIF(btrim(company.bank_name), ''::text) IS NOT NULL AND company.invoice_payment_term_days IS NOT NULL AS seller_config_complete,
    NULLIF(btrim(COALESCE(customer.company_name, customer.name)), ''::text) IS NOT NULL AND NULLIF(btrim(concat_ws(' '::text, customer.street, customer.house_number)), ''::text) IS NOT NULL AND NULLIF(btrim(customer.zip_code), ''::text) IS NOT NULL AND NULLIF(btrim(customer.city), ''::text) IS NOT NULL AND NULLIF(btrim(customer.country), ''::text) IS NOT NULL AS customer_config_complete,
    COALESCE(base_items.base_line_count, 0) > 0 AND COALESCE(base_items.invalid_price_count, 0) = 0 AS base_prices_complete,
    NOT (EXISTS ( SELECT 1
           FROM invoices existing_invoice
          WHERE existing_invoice.tenant_id = freeze_state.tenant_id AND existing_invoice.order_id = freeze_state.order_id AND existing_invoice.contract_version = 1 AND existing_invoice.status = 'issued'::text)) AS no_active_invoice,
    freeze_state.active = true AND freeze_state.integrity_ok = true AND orders.id IS NOT NULL AND orders.station::text = 'fertig'::text AND customer.id IS NOT NULL AND company.config_count = 1 AND NULLIF(btrim(company.company_name), ''::text) IS NOT NULL AND NULLIF(btrim(company.street), ''::text) IS NOT NULL AND NULLIF(btrim(company.zip), ''::text) IS NOT NULL AND NULLIF(btrim(company.city), ''::text) IS NOT NULL AND NULLIF(btrim(company.country), ''::text) IS NOT NULL AND NULLIF(btrim(company.tax_id), ''::text) IS NOT NULL AND NULLIF(btrim(company.iban), ''::text) IS NOT NULL AND NULLIF(btrim(company.bic), ''::text) IS NOT NULL AND NULLIF(btrim(company.bank_name), ''::text) IS NOT NULL AND company.invoice_payment_term_days IS NOT NULL AND NULLIF(btrim(COALESCE(customer.company_name, customer.name)), ''::text) IS NOT NULL AND NULLIF(btrim(concat_ws(' '::text, customer.street, customer.house_number)), ''::text) IS NOT NULL AND NULLIF(btrim(customer.zip_code), ''::text) IS NOT NULL AND NULLIF(btrim(customer.city), ''::text) IS NOT NULL AND NULLIF(btrim(customer.country), ''::text) IS NOT NULL AND COALESCE(base_items.base_line_count, 0) > 0 AND COALESCE(base_items.invalid_price_count, 0) = 0 AS integrity_ok
   FROM private.v_order_freeze_state_v1 freeze_state
     JOIN orders orders ON orders.id = freeze_state.order_id AND orders.tenant_id::text = freeze_state.tenant_id
     JOIN customers customer ON customer.id = orders.customer_id AND customer.tenant_id::text = orders.tenant_id::text
     LEFT JOIN LATERAL ( SELECT selected.id,
            selected.tenant_id,
            selected.company_name,
            selected.tagline,
            selected.street,
            selected.zip,
            selected.city,
            selected.country,
            selected.phone,
            selected.email,
            selected.website,
            selected.iban,
            selected.bic,
            selected.bank_name,
            selected.tax_id,
            selected.logo_url,
            selected.updated_at,
            selected.email_greeting,
            selected.email_pickup_info,
            selected.email_payment_info,
            selected.email_agb_text,
            selected.email_footer,
            selected.email_additional_notes,
            selected.workflow_templates,
            selected.wochenziel,
            selected.invoice_vat_rate_basis_points,
            selected.invoice_payment_term_days,
            selected.tagesleistung_eur,
            count(*) OVER ()::integer AS config_count
           FROM company_settings selected
          WHERE selected.tenant_id = freeze_state.tenant_id
          ORDER BY selected.updated_at DESC, selected.id
         LIMIT 1) company ON true
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS base_line_count,
            count(*) FILTER (WHERE item.preis_netto IS NULL OR item.preis_netto < 0::numeric)::integer AS invalid_price_count,
            COALESCE(sum(round(round(item.preis_netto * 100::numeric)::bigint * item.quantity)::bigint), 0::numeric)::bigint AS base_net_amount_cents,
            jsonb_agg(jsonb_build_object('itemId', item.id, 'name', item.name, 'quantity', item.quantity, 'unitNetAmountCents', round(item.preis_netto * 100::numeric)::bigint, 'lineNetAmountCents', round(round(item.preis_netto * 100::numeric)::bigint * item.quantity)::bigint) ORDER BY item.id) AS base_lines
           FROM items item
          WHERE item.tenant_id::text = freeze_state.tenant_id AND item.order_id = freeze_state.order_id) base_items ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('itemId', line.item_id, 'catalogPositionId', line.catalog_position_id, 'catalogPositionName', line.catalog_position_name, 'minutes', line.minutes, 'hourlyRateCents', line.hourly_rate_cents, 'amountCents', line.amount_cents) ORDER BY line.item_id, line.catalog_position_name, line.catalog_position_id) AS lines
           FROM private.order_frozen_extra_work_lines line
          WHERE line.tenant_id = freeze_state.tenant_id AND line.freeze_id = freeze_state.freeze_id) extra_work ON true
  WHERE freeze_state.active = true AND NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND freeze_state.tenant_id = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text);
REVOKE ALL ON TABLE "private"."v_invoice_issue_source_v1" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE "private"."v_invoice_issue_source_v1" TO service_role;

CREATE VIEW "private"."v_card_search_documents_v1" WITH (security_invoker=true) AS
WITH order_documents AS (
         SELECT 'ORDER'::text AS document_type,
            orders.id AS record_id,
            orders.tenant_id,
            orders.order_number AS title,
            customer.name AS subtitle,
            orders.status,
            lower(concat_ws(' '::text, orders.order_number, orders.title, orders.task, orders.status, orders.station, customer.name, customer.company_name, intake.note, intake_positions.position_text, live_positions.position_text)) AS search_document,
            customer.id IS NOT NULL AND NOT (EXISTS ( SELECT 1
                   FROM items corrupt_item
                  WHERE corrupt_item.order_id = orders.id AND (corrupt_item.tenant_id::text IS DISTINCT FROM orders.tenant_id::text OR corrupt_item.customer_id IS DISTINCT FROM orders.customer_id))) AS integrity_ok
           FROM orders orders
             LEFT JOIN customers customer ON customer.id = orders.customer_id AND customer.tenant_id::text = orders.tenant_id::text
             LEFT JOIN LATERAL ( SELECT receipt.note,
                    receipt.items_snapshot
                   FROM private.order_intake_receipts receipt
                  WHERE receipt.order_id = orders.id AND receipt.tenant_id = orders.tenant_id::text
                  ORDER BY receipt.created_at DESC, receipt.id
                 LIMIT 1) intake ON true
             LEFT JOIN LATERAL ( SELECT string_agg(concat_ws(' '::text, snapshot.item ->> 'position'::text, snapshot.item ->> 'name'::text, snapshot.item ->> 'quantity'::text, snapshot.item ->> 'material'::text, snapshot.item ->> 'surfaceRequested'::text), ' '::text ORDER BY snapshot.ordinality) AS position_text
                   FROM jsonb_array_elements(COALESCE(intake.items_snapshot, '[]'::jsonb)) WITH ORDINALITY snapshot(item, ordinality)) intake_positions ON true
             LEFT JOIN LATERAL ( SELECT string_agg(concat_ws(' '::text, item.name, item.quantity, item.material, item.surface_requested, item.internal_notes, array_to_string(item.repair_types, ' '::text)), ' '::text ORDER BY item.created_at, item.id) AS position_text
                   FROM items item
                  WHERE item.order_id = orders.id AND item.tenant_id::text = orders.tenant_id::text AND item.customer_id = orders.customer_id) live_positions ON true
          WHERE NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND orders.tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) AND (COALESCE(orders.source, 'manual'::text) <> ALL (ARRAY['seed'::text, 'test'::text, 'demo'::text, 'integration-test'::text])) AND COALESCE(orders.order_number, ''::text) !~~* 'A-SEED-%'::text AND COALESCE(orders.order_number, ''::text) !~~* '%TEST%'::text
        ), customer_documents AS (
         SELECT 'CUSTOMER'::text AS document_type,
            customer.id AS record_id,
            customer.tenant_id,
            customer.name AS title,
            COALESCE(customer.company_name, customer.city, customer.customer_number::text) AS subtitle,
            NULL::text AS status,
            lower(concat_ws(' '::text, customer.customer_number, customer.name, customer.company_name, customer.first_name, customer.last_name, customer.contact_role, customer.city, customer.phone, customer.email, customer.notes, customer.behavior_notes, customer_orders.order_text)) AS search_document,
            NOT (EXISTS ( SELECT 1
                   FROM orders corrupt_order
                  WHERE corrupt_order.customer_id = customer.id AND corrupt_order.tenant_id::text IS DISTINCT FROM customer.tenant_id::text)) AS integrity_ok
           FROM customers customer
             LEFT JOIN LATERAL ( SELECT string_agg(concat_ws(' '::text, orders.order_number, orders.title, orders.task, orders.status), ' '::text ORDER BY orders.created_at, orders.id) AS order_text
                   FROM orders orders
                  WHERE orders.customer_id = customer.id AND orders.tenant_id::text = customer.tenant_id::text AND (COALESCE(orders.source, 'manual'::text) <> ALL (ARRAY['seed'::text, 'test'::text, 'demo'::text, 'integration-test'::text]))) customer_orders ON true
          WHERE NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND customer.tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) AND (COALESCE(customer.source, 'manual'::text) <> ALL (ARRAY['seed'::text, 'test'::text, 'demo'::text, 'integration-test'::text])) AND COALESCE(customer.name, ''::text) !~~ 'Capture%'::text
        )
 SELECT order_documents.document_type,
    order_documents.record_id,
    order_documents.tenant_id,
    order_documents.title,
    order_documents.subtitle,
    order_documents.status,
    order_documents.search_document,
    order_documents.integrity_ok
   FROM order_documents
UNION ALL
 SELECT customer_documents.document_type,
    customer_documents.record_id,
    customer_documents.tenant_id,
    customer_documents.title,
    customer_documents.subtitle,
    customer_documents.status,
    customer_documents.search_document,
    customer_documents.integrity_ok
   FROM customer_documents;
REVOKE ALL ON TABLE "private"."v_card_search_documents_v1" FROM PUBLIC,anon,authenticated,service_role;

CREATE VIEW "private"."v_open_quotes_v1" WITH (security_invoker=true) AS
SELECT quote_id,
    tenant_id,
    quote_number,
    customer_id,
    customer_number,
    customer_display_name,
    status,
    version,
    currency,
    due_date,
    note,
    total_net_cents,
    linked_order_id,
    created_by,
    actor_display_name,
    created_at,
    updated_at,
    converted_at,
    positions,
    integrity_ok,
    valid_until,
    intake_term_status,
    intake_source
   FROM private.v_quotes_v1
  WHERE status = 'draft'::text;
REVOKE ALL ON TABLE "private"."v_open_quotes_v1" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE "private"."v_open_quotes_v1" TO service_role;

CREATE VIEW "private"."v_invoice_issue_source_v2" WITH (security_invoker=true) AS
SELECT source.tenant_id,
    source.order_id,
    source.freeze_id,
    source.frozen_at,
    source.service_date,
    source.freeze_order_version,
    source.current_order_version,
    source.order_number,
    source.order_title,
    source.station,
    source.order_status,
    source.customer_id,
    source.customer_name,
    source.customer_company_name,
    source.customer_contact_person,
    source.customer_street,
    source.customer_zip,
    source.customer_city,
    source.customer_country,
    source.seller_company_name,
    source.seller_street,
    source.seller_zip,
    source.seller_city,
    source.seller_country,
    source.seller_tax_id,
    source.seller_iban,
    source.seller_bic,
    source.seller_bank_name,
    source.invoice_vat_rate_basis_points,
    source.invoice_payment_term_days,
    source.base_lines,
    source.base_line_count,
    source.base_net_amount_cents,
    source.extra_work_lines,
    source.extra_work_line_count,
    source.extra_work_net_amount_cents,
    source.seller_config_complete,
    source.customer_config_complete,
    source.base_prices_complete,
    source.no_active_invoice,
    source.integrity_ok,
    COALESCE(eligibility.post_goods_out_invoice_eligible, false) AS post_goods_out_invoice_eligible,
    source.integrity_ok OR COALESCE(eligibility.post_goods_out_invoice_eligible, false) AS effective_integrity_ok
   FROM private.v_invoice_issue_source_v1 source
     LEFT JOIN LATERAL ( SELECT count(*) = 1 AND bool_and(receipt.integrity_ok) AND orders.payment_mode = 'rechnung'::text AND orders.station::text = 'abgeholt'::text AND orders.status::text = 'abgeholt'::text AND freeze_state.active = true AND freeze_state.integrity_ok = true AND source.seller_config_complete AND source.customer_config_complete AND source.base_prices_complete AS post_goods_out_invoice_eligible
           FROM orders orders
             JOIN private.v_order_freeze_state_v1 freeze_state ON freeze_state.tenant_id = orders.tenant_id::text AND freeze_state.order_id = orders.id AND freeze_state.freeze_id = source.freeze_id
             JOIN private.v_goods_out_receipt_v2 receipt ON receipt.tenant_id::text = orders.tenant_id::text AND receipt.order_id = orders.id AND receipt.order_version = orders.version
          WHERE orders.tenant_id::text = source.tenant_id AND orders.id = source.order_id
          GROUP BY orders.payment_mode, orders.station, orders.status, freeze_state.active, freeze_state.integrity_ok) eligibility ON true;
REVOKE ALL ON TABLE "private"."v_invoice_issue_source_v2" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE "private"."v_invoice_issue_source_v2" TO service_role;

CREATE VIEW "private"."v_customer_summary_v1" WITH (security_invoker=true) AS
SELECT customer.id,
    customer.tenant_id,
    customer.customer_number,
    customer.name,
    customer.company_name,
    customer.type,
    NULL::text AS contact_person,
    customer.email,
    customer.phone,
    customer.street,
    concat_ws(' '::text, customer.street, customer.house_number) AS address,
    customer.zip_code,
    customer.city,
    customer.country,
    customer.payment_preference,
    customer.vat_id,
    customer.classification,
    customer.notes AS internal_notes,
    customer.tags,
    customer.created_at,
    customer.updated_at,
    count(order_row.id)::integer AS order_count,
    count(order_row.id) FILTER (WHERE order_row.status::text = ANY (ARRAY['angenommen'::character varying, 'galvanik'::character varying, 'fertig'::character varying]::text[]))::integer AS ware_im_haus_count,
    count(order_row.id) FILTER (WHERE order_row.status::text = ANY (ARRAY['angenommen'::character varying, 'galvanik'::character varying, 'fertig'::character varying]::text[])) > 0 AS ware_im_haus,
    COALESCE(jsonb_agg(jsonb_build_object('id', order_row.id, 'orderNumber', order_row.order_number, 'title', order_row.title, 'station', order_row.station, 'status', order_row.status, 'version', order_row.version, 'dueAt', order_row.due_date) ORDER BY order_row.created_at DESC, order_row.id) FILTER (WHERE order_row.id IS NOT NULL), '[]'::jsonb) AS orders,
    customer.id = btrim(customer.id) AND length(customer.id) >= 1 AND length(customer.id) <= 128 AND customer.name = btrim(customer.name) AND length(customer.name) >= 1 AND length(customer.name) <= 200 AND COALESCE(bool_and(order_row.tenant_integrity_ok), true) AS integrity_ok
   FROM customers customer
     LEFT JOIN private.v_operational_station_queue_v1 order_row ON order_row.customer_id = customer.id AND order_row.tenant_id::text = customer.tenant_id::text
  WHERE customer.tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) AND (COALESCE(customer.source, ''::text) <> ALL (ARRAY['seed'::text, 'test'::text, 'demo'::text, 'integration-test'::text])) AND COALESCE(customer.name, ''::text) !~~ 'Capture%'::text
  GROUP BY customer.id, customer.tenant_id, customer.customer_number, customer.name, customer.company_name, customer.type, NULL::text, customer.email, customer.phone, customer.street, customer.house_number, customer.zip_code, customer.city, customer.country, customer.payment_preference, customer.vat_id, customer.classification, customer.notes, customer.tags, customer.created_at, customer.updated_at;
REVOKE ALL ON TABLE "private"."v_customer_summary_v1" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE "private"."v_customer_summary_v1" TO service_role;

-- Unknown non-empty legacy values abort the transaction instead of disappearing or becoming defaults.
-- Decision 19 / P34: the known legacy value is migrated, never accepted on new input.
UPDATE public.items SET unit=private.order_position_unit_key(unit),surface_requested=private.order_position_surface_key(
  CASE WHEN btrim(surface_requested)='chrom' THEN 'verchromen' ELSE surface_requested END);
UPDATE public.catalog_services SET unit=private.order_position_unit_key(unit),surface=private.order_position_surface_key(surface);
-- Only the authorized key migration may rewrite these columns. The append-only
-- runtime protection is restored inside this same atomic block; receipts stay intact.
DO $quote_keys$
BEGIN
  ALTER TABLE private.quote_positions DISABLE TRIGGER quote_positions_update_immutable;
  UPDATE private.quote_positions SET surface_requested=private.order_position_surface_key(surface_requested)
    WHERE surface_requested IS DISTINCT FROM private.order_position_surface_key(surface_requested);
  ALTER TABLE private.quote_positions ENABLE TRIGGER quote_positions_update_immutable;
END;
$quote_keys$;

ALTER TABLE public.items ADD CONSTRAINT items_position_unit_key_chk CHECK (unit IS NULL OR unit IN ('stueck','kg','dm2','satz','stunde'));
ALTER TABLE public.items ADD CONSTRAINT items_position_surface_key_chk CHECK (surface_requested IS NULL OR surface_requested IN ('verchromen','vernickeln','verzinken','entchromen_pruefen','offen'));
ALTER TABLE public.items ADD CONSTRAINT items_position_quantity_chk CHECK (private.order_position_quantity_valid(quantity,unit));
ALTER TABLE public.catalog_services ADD CONSTRAINT catalog_position_unit_key_chk CHECK (unit IS NULL OR unit IN ('stueck','kg','dm2','satz','stunde'));
ALTER TABLE public.catalog_services ADD CONSTRAINT catalog_position_surface_key_chk CHECK (surface IS NULL OR surface IN ('verchromen','vernickeln','verzinken','entchromen_pruefen','offen'));
ALTER TABLE private.quote_positions ADD CONSTRAINT quote_position_surface_key_chk CHECK (surface_requested IN ('verchromen','vernickeln','verzinken','entchromen_pruefen','offen'));
ALTER TABLE private.quote_positions ADD CONSTRAINT quote_position_unit_key_chk CHECK (unit IS NULL OR unit IN ('stueck','kg','dm2','satz','stunde'));

CREATE FUNCTION private.normalise_position_columns() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
  NEW.unit:=private.order_position_unit_key(NEW.unit);
  IF TG_TABLE_NAME='catalog_services' THEN NEW.surface:=private.order_position_surface_key(NEW.surface);
  ELSE NEW.surface_requested:=private.order_position_surface_key(NEW.surface_requested); END IF;
  RETURN NEW;
END; $fn$;
REVOKE ALL ON FUNCTION private.normalise_position_columns() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.normalise_position_columns() TO service_role;
CREATE TRIGGER items_position_keys BEFORE INSERT OR UPDATE OF unit,surface_requested ON public.items FOR EACH ROW EXECUTE FUNCTION private.normalise_position_columns();
CREATE TRIGGER catalog_position_keys BEFORE INSERT OR UPDATE OF unit,surface ON public.catalog_services FOR EACH ROW EXECUTE FUNCTION private.normalise_position_columns();
CREATE TRIGGER quote_position_keys BEFORE INSERT OR UPDATE OF unit,surface_requested ON private.quote_positions FOR EACH ROW EXECUTE FUNCTION private.normalise_position_columns();

ALTER TABLE public.company_settings
 ADD COLUMN oeffnungszeiten text,
 ADD COLUMN uebergabepuffer_tage integer NOT NULL DEFAULT 1 CHECK (uebergabepuffer_tage BETWEEN 0 AND 10),
 ADD COLUMN auslastung_passt_pct integer NOT NULL DEFAULT 80 CHECK (auslastung_passt_pct BETWEEN 10 AND 100),
 ADD COLUMN auslastung_knapp_pct integer NOT NULL DEFAULT 100 CHECK (auslastung_knapp_pct BETWEEN auslastung_passt_pct AND 150),
 ADD COLUMN auslastung_wenig_pct integer NOT NULL DEFAULT 50 CHECK (auslastung_wenig_pct BETWEEN 0 AND 80),
 ADD COLUMN auslastung_vorrang_pct integer NOT NULL DEFAULT 110 CHECK (auslastung_vorrang_pct BETWEEN auslastung_knapp_pct AND 200);

-- Physical order identifiers are text in the canonical existing table.
ALTER TABLE public.orders ADD CONSTRAINT orders_tenant_id_identity_key UNIQUE(tenant_id,id);
CREATE TABLE public.outbox_mails (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id text NOT NULL,objekt text NOT NULL,
 vorlage text NOT NULL CHECK (vorlage='auftragsbestaetigung'),an text NOT NULL,
 status text NOT NULL CHECK (status IN ('wartet','gesendet','fehler')),fehler_code text,
 erstellt_am timestamptz NOT NULL DEFAULT statement_timestamp(),gesendet_am timestamptz,
 FOREIGN KEY (tenant_id,objekt) REFERENCES public.orders(tenant_id,id) ON DELETE RESTRICT,
 CHECK ((status='fehler')=(fehler_code IS NOT NULL)),CHECK (status<>'gesendet' OR gesendet_am IS NOT NULL)
);
CREATE UNIQUE INDEX outbox_confirmation_once ON public.outbox_mails(tenant_id,objekt) WHERE vorlage='auftragsbestaetigung';
CREATE INDEX outbox_waiting_tenant ON public.outbox_mails(tenant_id,erstellt_am) WHERE status='wartet';
ALTER TABLE public.outbox_mails ENABLE ROW LEVEL SECURITY;
CREATE POLICY outbox_mails_tenant_isolation ON public.outbox_mails USING (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'')) WITH CHECK (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
REVOKE ALL ON TABLE public.outbox_mails FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.outbox_mails TO service_role;

ALTER TABLE public.orders
 ADD COLUMN ware text NOT NULL DEFAULT 'da' CHECK (ware IN ('erwartet','teilweise','da','abweichung','zurueck','storniert')),
 ADD COLUMN ware_seit timestamptz,
 ADD COLUMN wunschtermin date,
 ADD COLUMN termin_herkunft text CHECK (termin_herkunft IS NULL OR termin_herkunft IN ('wunsch_passt','wunsch_knapp','ueber_auslastung','vorschlag','gegenvorschlag','wunsch_kv')),
 ADD COLUMN terminstatus_seit timestamptz,
 ADD COLUMN processing_weeks integer CHECK (processing_weeks IS NULL OR processing_weeks IN (1,2,3,5));
ALTER TABLE public.items ADD COLUMN aufwand_min integer CHECK (aufwand_min IS NULL OR (aufwand_min BETWEEN 0 AND 6000 AND aufwand_min%5=0));

ALTER TABLE public.intake_item
 ADD CONSTRAINT intake_item_tenant_id_key UNIQUE (tenant_id,id),
 ADD COLUMN absender_telefon text,
 ADD COLUMN absender_bestaetigt boolean NOT NULL DEFAULT false,
 ADD COLUMN an text[] NOT NULL DEFAULT '{}',
 ADD COLUMN cc text[] NOT NULL DEFAULT '{}',
 ADD COLUMN gruppe_adresse text,
 ADD COLUMN kennzeichen text[] NOT NULL DEFAULT '{}',
 ADD COLUMN zuordnung_regel text,
 ADD COLUMN anliegen text[] NOT NULL DEFAULT '{}',
 ADD COLUMN anliegen_abgewaehlt text[] NOT NULL DEFAULT '{}',
 ADD COLUMN anliegen_haupt text,
 ADD COLUMN anliegen_offen text[] NOT NULL DEFAULT '{}',
 ADD COLUMN teil_von uuid,
 ADD COLUMN verweis_item uuid,
 ADD COLUMN einsatz_aktion text,
 ADD COLUMN einsatz_vermerk text,
 ADD COLUMN einsatz_am timestamptz,
 ADD COLUMN einsatz_von uuid,
 ADD COLUMN wartet_seit timestamptz,
 ADD COLUMN graph_message_id text,
 ADD COLUMN internet_message_id text,
 ADD COLUMN conversation_id text,
 ADD COLUMN in_reply_to text,
 ADD COLUMN "references" text[] NOT NULL DEFAULT '{}',
 ADD COLUMN antwort_auf_item uuid,
 ADD COLUMN sendestatus text CHECK (sendestatus IS NULL OR sendestatus IN ('entwurf','sendet','gesendet','fehler','unklar','verworfen')),
 ADD COLUMN sendefehler text,
 ADD COLUMN gesendet_am timestamptz,
 ADD COLUMN aussortiert text CHECK (aussortiert IS NULL OR aussortiert IN ('newsletter','junk','gelernt')),
 ADD COLUMN info_automatisch boolean NOT NULL DEFAULT false;
ALTER TABLE public.intake_item ADD CONSTRAINT intake_item_parent_tenant_fk FOREIGN KEY (tenant_id,teil_von) REFERENCES public.intake_item(tenant_id,id) ON DELETE RESTRICT;
ALTER TABLE public.intake_item ADD CONSTRAINT intake_item_reference_tenant_fk FOREIGN KEY (tenant_id,verweis_item) REFERENCES public.intake_item(tenant_id,id) ON DELETE RESTRICT;
ALTER TABLE public.intake_item ADD CONSTRAINT intake_item_reply_tenant_fk FOREIGN KEY (tenant_id,antwort_auf_item) REFERENCES public.intake_item(tenant_id,id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX intake_graph_id_once ON public.intake_item(tenant_id,graph_message_id) WHERE graph_message_id IS NOT NULL;
CREATE UNIQUE INDEX intake_message_id_once ON public.intake_item(tenant_id,internet_message_id) WHERE internet_message_id IS NOT NULL;
CREATE UNIQUE INDEX intake_reply_proposal_once ON public.intake_item(tenant_id,antwort_auf_item,anliegen) WHERE antwort_auf_item IS NOT NULL AND sendestatus<>'verworfen';
CREATE INDEX intake_parent_tenant ON public.intake_item(tenant_id,teil_von);
CREATE INDEX intake_reference_tenant ON public.intake_item(tenant_id,verweis_item);
CREATE INDEX intake_open_assignment ON public.intake_item(tenant_id,erstellt_am) WHERE zuordnung='offen';

CREATE TABLE public.intake_file (
 id uuid PRIMARY KEY,tenant_id text NOT NULL,item_id uuid NOT NULL,client_key text NOT NULL,
 art text NOT NULL CHECK (art IN ('mime','anhang','foto','scan','scan_pdf','xml','pdf','app_pdf')),
 abgeleitet_von text[] NOT NULL DEFAULT '{}',
 foto_art text CHECK (foto_art IS NULL OR foto_art IN ('etikett','uebersicht','teile','abweichung','beleg','seite','sonst')),
 dateiname text NOT NULL,mime text NOT NULL,bytes bigint NOT NULL CHECK (bytes BETWEEN 1 AND 157286400),
 sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),speicherpfad text NOT NULL,
 vorschau_pfad text,aufgenommen_am timestamptz NOT NULL,aufgenommen_von uuid NOT NULL,aufgenommen_auf text,
 reihenfolge integer NOT NULL CHECK (reihenfolge>0),lesbar boolean NOT NULL,
 erkennung_status text NOT NULL CHECK (erkennung_status IN ('wartet','laeuft','fertig','fehler')),
 erkannter_text text,sprache text,geoeffnet boolean NOT NULL,
 UNIQUE (tenant_id,id),UNIQUE (tenant_id,client_key),
 FOREIGN KEY (tenant_id,item_id) REFERENCES public.intake_item(tenant_id,id) ON DELETE RESTRICT,
 CHECK (speicherpfad=tenant_id||'/'||sha256)
);
CREATE INDEX intake_file_item_tenant ON public.intake_file(tenant_id,item_id,reihenfolge);

CREATE FUNCTION private.protect_intake_original() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF ROW(NEW.id,NEW.tenant_id,NEW.item_id,NEW.client_key,NEW.art,NEW.abgeleitet_von,NEW.foto_art,NEW.dateiname,NEW.mime,NEW.bytes,NEW.sha256,NEW.speicherpfad,NEW.aufgenommen_am,NEW.aufgenommen_von,NEW.aufgenommen_auf,NEW.reihenfolge)
  IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.item_id,OLD.client_key,OLD.art,OLD.abgeleitet_von,OLD.foto_art,OLD.dateiname,OLD.mime,OLD.bytes,OLD.sha256,OLD.speicherpfad,OLD.aufgenommen_am,OLD.aufgenommen_von,OLD.aufgenommen_auf,OLD.reihenfolge)
 THEN RAISE EXCEPTION 'INTAKE_ORIGINAL_IMMUTABLE' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $fn$;
REVOKE ALL ON FUNCTION private.protect_intake_original() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.protect_intake_original() TO service_role;
CREATE TRIGGER intake_file_original_immutable BEFORE UPDATE ON public.intake_file FOR EACH ROW EXECUTE FUNCTION private.protect_intake_original();

CREATE TABLE public.intake_suggestion (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id text NOT NULL,item_id uuid NOT NULL,file_id uuid,order_id text,
 feld text NOT NULL,wert jsonb NOT NULL,sicherheit text NOT NULL CHECK (sicherheit IN ('sicher','vorschlag','unsicher')),
 regel text,grund text,fundstelle jsonb,status text NOT NULL CHECK (status IN ('offen','uebernommen','verworfen')),
 entschieden_von text,entschieden_am timestamptz,geprueft_von uuid,geprueft_am timestamptz,
 FOREIGN KEY (tenant_id,item_id) REFERENCES public.intake_item(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (tenant_id,file_id) REFERENCES public.intake_file(tenant_id,id) ON DELETE RESTRICT
 ,FOREIGN KEY (tenant_id,order_id) REFERENCES public.orders(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX intake_suggestion_item_tenant ON public.intake_suggestion(tenant_id,item_id,status);
CREATE INDEX intake_suggestion_file_tenant ON public.intake_suggestion(tenant_id,file_id);

CREATE TABLE public.device_request (
 id uuid PRIMARY KEY,tenant_id text NOT NULL,login_id uuid NOT NULL,item_id uuid NOT NULL,
 zweck text NOT NULL CHECK (zweck='fotos'),kontext jsonb,token_hash text NOT NULL,token_sitzung text NOT NULL,
 status text NOT NULL CHECK (status IN ('angefordert','angenommen','fotos_da','beendet','abgelaufen')),
 beendet_art text CHECK (beendet_art IS NULL OR beendet_art IN ('fertig','abgebrochen','geschlossen')),
 angenommen_auf text[] NOT NULL DEFAULT '{}',fertig_auf text[] NOT NULL DEFAULT '{}',
 erstellt_am timestamptz NOT NULL DEFAULT statement_timestamp(),ablauf_am timestamptz NOT NULL,
 FOREIGN KEY (tenant_id,item_id) REFERENCES public.intake_item(tenant_id,id) ON DELETE RESTRICT,
 CHECK (ablauf_am>erstellt_am AND ablauf_am<=erstellt_am+interval '10 minutes')
);
CREATE INDEX device_request_item_tenant ON public.device_request(tenant_id,item_id);
CREATE INDEX device_request_login_expiry ON public.device_request(tenant_id,login_id,ablauf_am);

-- AP-EIN originals include spreadsheets and other intentionally unreadable formats.
-- Existing private bucket and provider; upload grants remain server-authorized, never public.
UPDATE storage.buckets SET file_size_limit=157286400,allowed_mime_types=NULL WHERE id='scans';

-- Decision 3: existing typed device notes use the same internal direction as new notes.
UPDATE public.intake_item SET richtung='intern',version=version+1,updated_at=statement_timestamp()
WHERE kanal='notiz' AND quelle='geraet' AND richtung='rein';

ALTER TABLE public.intake_file ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_suggestion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY intake_file_tenant_isolation ON public.intake_file USING (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'')) WITH CHECK (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
CREATE POLICY intake_suggestion_tenant_isolation ON public.intake_suggestion USING (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'')) WITH CHECK (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
CREATE POLICY device_request_tenant_isolation ON public.device_request USING (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'')) WITH CHECK (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
REVOKE ALL ON TABLE public.intake_file,public.intake_suggestion,public.device_request FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.intake_file,public.intake_suggestion,public.device_request TO service_role;

-- AP-EIN scheduling: a counter-proposal is a first-class existing term status.
ALTER TABLE public.orders DROP CONSTRAINT orders_intake_term_status_chk;
ALTER TABLE public.orders ADD CONSTRAINT orders_intake_term_status_chk CHECK (intake_term_status IS NULL OR intake_term_status IN ('wunsch','bestaetigt','verschoben','gegenvorschlag'));
ALTER TABLE private.order_intake_receipts DROP CONSTRAINT order_intake_receipts_term_status_chk;
ALTER TABLE private.order_intake_receipts ADD CONSTRAINT order_intake_receipts_term_status_chk CHECK (intake_term_status IS NULL OR intake_term_status IN ('wunsch','bestaetigt','verschoben','gegenvorschlag'));
