-- AP-KV-V04 Server A; additive content editions and exact line totals (PL 07.11. 20:05).
-- Existing quote writers, receipts and historical revisions remain the sole write path.
ALTER TABLE private.quotes
 ADD COLUMN fassung integer NOT NULL DEFAULT 1 CHECK (fassung >= 1),
 ADD COLUMN kalk_stunden numeric(14,4) CHECK (kalk_stunden >= 0),
 ADD COLUMN stundensatz_cents bigint CHECK (stundensatz_cents > 0),
 ADD COLUMN ruest_cents bigint CHECK (ruest_cents >= 0),
 ADD COLUMN material_cents bigint CHECK (material_cents >= 0),
 ADD COLUMN lieferzeit_wochen integer CHECK (lieferzeit_wochen > 0),
 ADD COLUMN gesendet_fassung integer CHECK (gesendet_fassung BETWEEN 1 AND fassung),
 ADD COLUMN gesendet_am timestamptz,
 ADD COLUMN gesendet_kanal text CHECK (gesendet_kanal IN ('mail','druck')),
 ADD COLUMN zugesagt_fassung integer CHECK (zugesagt_fassung BETWEEN 1 AND fassung),
 ADD COLUMN zugesagt_am timestamptz,
 ADD COLUMN zusage_nachweis text CHECK (zusage_nachweis IS NULL OR length(btrim(zusage_nachweis)) BETWEEN 1 AND 4000),
 ADD COLUMN abgesagt_am timestamptz,
 ADD COLUMN absage_grund text CHECK (absage_grund IS NULL OR length(btrim(absage_grund)) BETWEEN 1 AND 2000),
 ADD COLUMN nachfass_am date,
 ADD COLUMN quelle_intake_item_id uuid,
 ADD COLUMN quelle_nachricht_id uuid,
 ADD COLUMN sonderwuensche text CHECK (sonderwuensche IS NULL OR length(sonderwuensche) <= 4000),
 ADD CONSTRAINT quotes_v04_source_item_fk FOREIGN KEY (tenant_id,quelle_intake_item_id) REFERENCES public.intake_item(tenant_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT quotes_v04_source_message_fk FOREIGN KEY (tenant_id,quelle_nachricht_id) REFERENCES public.intake_item(tenant_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT quotes_v04_one_source CHECK (quelle_intake_item_id IS NULL OR quelle_nachricht_id IS NULL OR quelle_intake_item_id=quelle_nachricht_id),
 ADD CONSTRAINT quotes_v04_sent_proof CHECK ((gesendet_fassung IS NULL AND gesendet_am IS NULL AND gesendet_kanal IS NULL) OR (gesendet_fassung IS NOT NULL AND gesendet_am IS NOT NULL AND gesendet_kanal IS NOT NULL)),
 ADD CONSTRAINT quotes_v04_acceptance_proof CHECK ((zugesagt_fassung IS NULL AND zugesagt_am IS NULL AND zusage_nachweis IS NULL) OR (zugesagt_fassung IS NOT NULL AND zugesagt_am IS NOT NULL AND zusage_nachweis IS NOT NULL));

-- NULL means this historical row still uses its original quantity x unit price contract.
-- New calculations use the explicit exact total; no rounding the aggregate to a unit price.
ALTER TABLE private.quote_positions ADD COLUMN zeilen_gesamt_cents bigint CHECK (zeilen_gesamt_cents BETWEEN 0 AND 999999999999);
ALTER TABLE public.company_settings
 ADD COLUMN kv_ruest_cents bigint CHECK (kv_ruest_cents >= 0),
 ADD COLUMN kv_material_cents bigint CHECK (kv_material_cents >= 0),
 ADD COLUMN kv_nachfass_tage integer CHECK (kv_nachfass_tage > 0),
 ADD COLUMN kv_gueltigkeit_tage integer CHECK (kv_gueltigkeit_tage > 0);
-- Hourly rate remains private.extra_work_hourly_rates; no second current rate.

CREATE OR REPLACE FUNCTION private.create_quote_v1(p_tenant_id text, p_actor_id uuid, p_client_event_id uuid, p_intent_sha256 text, p_customer_id text, p_due_date date, p_valid_until date, p_intake_term_status text, p_intake_source text, p_note text, p_positions jsonb)
 RETURNS TABLE(result_code text, result_quote_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_prior private.quote_create_receipts%ROWTYPE;
  v_quote_id uuid := gen_random_uuid();
  v_event_id text := gen_random_uuid()::text;
  v_receipt_id uuid := gen_random_uuid();
  v_correlation_id uuid := gen_random_uuid();
  v_quote_number text;
  v_total bigint;
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
     OR p_actor_id IS NULL OR p_client_event_id IS NULL
     OR p_intent_sha256 !~ '^[0-9a-f]{64}$'
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('path1:quote-create:' || p_tenant_id || ':' || p_actor_id::text || ':' || p_client_event_id::text, 0));
  SELECT * INTO v_prior FROM private.quote_create_receipts
   WHERE tenant_id = p_tenant_id AND actor_id = p_actor_id AND client_event_id = p_client_event_id;
  IF FOUND THEN
    IF v_prior.intent_sha256 IS DISTINCT FROM p_intent_sha256 THEN
      RETURN QUERY SELECT 'CONFLICT', NULL::uuid, false;
    ELSE
      RETURN QUERY SELECT 'OK', v_prior.quote_id, true;
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id = p_actor_id AND tenant_id = p_tenant_id AND active IS TRUE)
     OR NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND tenant_id = p_tenant_id)
  THEN RETURN QUERY SELECT 'NOT_FOUND', NULL::uuid, false; RETURN; END IF;
  IF p_due_date IS NULL
     OR NOT (
       (p_valid_until IS NULL AND p_intake_term_status IS NULL AND p_intake_source IS NULL)
       OR (p_valid_until IS NOT NULL
         AND p_intake_term_status IN ('wunsch', 'bestaetigt', 'verschoben')
         AND p_intake_source IN ('persoenlich', 'versand', 'abholung_firma', 'anfrage_mail', 'anfrage_telefon'))
     )
     OR (p_note IS NOT NULL AND (p_note IS DISTINCT FROM btrim(p_note) OR length(p_note) NOT BETWEEN 1 AND 2000))
     OR jsonb_typeof(p_positions) <> 'array' OR jsonb_array_length(p_positions) NOT BETWEEN 1 AND 20
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_positions) WITH ORDINALITY AS entry(value, ordinal)
       WHERE jsonb_typeof(value) <> 'object'
          OR (SELECT count(*) FROM jsonb_object_keys(value)) <> 5 + CASE WHEN value ? 'lineTotalCents' THEN 1 ELSE 0 END
          OR (value ? 'lineTotalCents' AND coalesce(value->>'lineTotalCents','') !~ '^[0-9]{1,12}$')
          OR NOT value ?& ARRAY['name','quantity','material','surfaceRequested','unitPriceCents']
          OR value->>'name' IS DISTINCT FROM btrim(value->>'name')
          OR length(value->>'name') NOT BETWEEN 2 AND 160
          OR coalesce(value->>'quantity','') !~ '^[1-9][0-9]{0,6}$'
          OR (value->>'quantity')::integer NOT BETWEEN 1 AND 1000000
          OR NOT (value->'material' = 'null'::jsonb OR (
            jsonb_typeof(value->'material') = 'string'
            AND value->>'material' = btrim(value->>'material')
            AND length(value->>'material') BETWEEN 1 AND 120
          ))
          OR value->>'surfaceRequested' IS DISTINCT FROM btrim(value->>'surfaceRequested')
          OR length(value->>'surfaceRequested') NOT BETWEEN 2 AND 160
          OR coalesce(value->>'unitPriceCents','') !~ '^[0-9]{1,9}$'
     )
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN; END IF;

  SELECT sum(coalesce((value->>'lineTotalCents')::bigint,(value->>'quantity')::bigint * (value->>'unitPriceCents')::bigint))
    INTO v_total FROM jsonb_array_elements(p_positions) entry(value);
  IF v_total IS NULL OR v_total NOT BETWEEN 0 AND 999999999999 THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN;
  END IF;

  v_quote_number := private.allocate_quote_number(p_tenant_id);
  INSERT INTO private.quotes (
    id, tenant_id, quote_number, customer_id, status, version, currency,
    due_date, valid_until, intake_term_status, intake_source, note, total_net_cents, created_by
  ) VALUES (
    v_quote_id, p_tenant_id, v_quote_number, p_customer_id, 'draft', 1, 'EUR',
    p_due_date, p_valid_until, p_intake_term_status, p_intake_source, p_note, v_total, p_actor_id
  );
  INSERT INTO private.quote_positions (
    tenant_id, quote_id, revision, position, name, quantity, material, surface_requested, unit_price_cents, zeilen_gesamt_cents
  )
  SELECT p_tenant_id, v_quote_id, 1, ordinal::integer, value->>'name', (value->>'quantity')::integer,
    CASE WHEN value->'material' = 'null'::jsonb THEN NULL ELSE value->>'material' END,
    value->>'surfaceRequested', (value->>'unitPriceCents')::bigint, (value->>'lineTotalCents')::bigint
  FROM jsonb_array_elements(p_positions) WITH ORDINALITY AS entry(value, ordinal);
  INSERT INTO public.events (
    id, tenant_id, order_id, item_id, event_type, description, notes, payload,
    status, user_id, station, client_event_id, event_schema_version,
    correlation_id, aggregate_version, from_station, created_at
  ) VALUES (
    v_event_id, p_tenant_id, NULL, NULL, 'QUOTE_CREATED_V1', 'KV angelegt', p_note,
    jsonb_build_object('quoteId', v_quote_id::text, 'customerId', p_customer_id, 'intentSha256', p_intent_sha256),
    'success', p_actor_id, NULL, p_client_event_id, 1, v_correlation_id, 1, NULL,
    statement_timestamp() AT TIME ZONE 'UTC'
  );
  INSERT INTO private.quote_create_receipts (
    id, event_id, tenant_id, quote_id, customer_id, actor_id,
    client_event_id, correlation_id, intent_sha256
  ) VALUES (
    v_receipt_id, v_event_id, p_tenant_id, v_quote_id, p_customer_id, p_actor_id,
    p_client_event_id, v_correlation_id, p_intent_sha256
  );
  RETURN QUERY SELECT 'OK', v_quote_id, false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.update_quote_v1(p_tenant_id text, p_actor_id uuid, p_client_event_id uuid, p_quote_id uuid, p_expected_version integer, p_intent_sha256 text, p_due_date date, p_note text, p_positions jsonb)
 RETURNS TABLE(result_code text, result_quote_id uuid, replayed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_prior private.quote_update_receipts%ROWTYPE;
  v_quote private.quotes%ROWTYPE;
  v_next_version integer;
  v_total bigint;
  v_event_id text := gen_random_uuid()::text;
  v_receipt_id uuid := gen_random_uuid();
  v_correlation_id uuid := gen_random_uuid();
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
     OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_quote_id IS NULL
     OR p_expected_version IS NULL OR p_expected_version < 1
     OR p_intent_sha256 !~ '^[0-9a-f]{64}$'
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('path1:quote-update:' || p_tenant_id || ':' || p_quote_id::text, 0));
  SELECT * INTO v_prior FROM private.quote_update_receipts
   WHERE tenant_id = p_tenant_id AND actor_id = p_actor_id AND client_event_id = p_client_event_id;
  IF FOUND THEN
    IF v_prior.quote_id IS DISTINCT FROM p_quote_id OR v_prior.intent_sha256 IS DISTINCT FROM p_intent_sha256
       OR v_prior.expected_version IS DISTINCT FROM p_expected_version
    THEN RETURN QUERY SELECT 'CONFLICT', NULL::uuid, false;
    ELSE RETURN QUERY SELECT 'OK', v_prior.quote_id, true;
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id = p_actor_id AND tenant_id = p_tenant_id AND active IS TRUE)
     OR p_due_date IS NULL
     OR (p_note IS NOT NULL AND (p_note IS DISTINCT FROM btrim(p_note) OR length(p_note) NOT BETWEEN 1 AND 2000))
     OR jsonb_typeof(p_positions) <> 'array' OR jsonb_array_length(p_positions) NOT BETWEEN 1 AND 20
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_positions) WITH ORDINALITY AS entry(value, ordinal)
       WHERE jsonb_typeof(value) <> 'object'
          OR (SELECT count(*) FROM jsonb_object_keys(value)) <> 5 + CASE WHEN value ? 'lineTotalCents' THEN 1 ELSE 0 END
          OR (value ? 'lineTotalCents' AND coalesce(value->>'lineTotalCents','') !~ '^[0-9]{1,12}$')
          OR NOT value ?& ARRAY['name','quantity','material','surfaceRequested','unitPriceCents']
          OR value->>'name' IS DISTINCT FROM btrim(value->>'name') OR length(value->>'name') NOT BETWEEN 2 AND 160
          OR coalesce(value->>'quantity','') !~ '^[1-9][0-9]{0,6}$' OR (value->>'quantity')::integer NOT BETWEEN 1 AND 1000000
          OR NOT (value->'material' = 'null'::jsonb OR (jsonb_typeof(value->'material') = 'string' AND value->>'material' = btrim(value->>'material') AND length(value->>'material') BETWEEN 1 AND 120))
          OR value->>'surfaceRequested' IS DISTINCT FROM btrim(value->>'surfaceRequested') OR length(value->>'surfaceRequested') NOT BETWEEN 2 AND 160
          OR coalesce(value->>'unitPriceCents','') !~ '^[0-9]{1,9}$'
     )
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN; END IF;

  SELECT * INTO v_quote FROM private.quotes WHERE tenant_id = p_tenant_id AND id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND', NULL::uuid, false; RETURN; END IF;
  IF v_quote.status <> 'draft' OR v_quote.version <> p_expected_version THEN
    RETURN QUERY SELECT 'CONFLICT', NULL::uuid, false; RETURN;
  END IF;

  SELECT sum(coalesce((value->>'lineTotalCents')::bigint,(value->>'quantity')::bigint * (value->>'unitPriceCents')::bigint))
    INTO v_total FROM jsonb_array_elements(p_positions) entry(value);
  IF v_total IS NULL OR v_total NOT BETWEEN 0 AND 999999999999 THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN;
  END IF;
  v_next_version := p_expected_version + 1;

  INSERT INTO private.quote_positions (tenant_id, quote_id, revision, position, name, quantity, material, surface_requested, unit_price_cents, zeilen_gesamt_cents)
  SELECT p_tenant_id, p_quote_id, v_next_version, ordinal::integer, value->>'name', (value->>'quantity')::integer,
    CASE WHEN value->'material' = 'null'::jsonb THEN NULL ELSE value->>'material' END,
    value->>'surfaceRequested', (value->>'unitPriceCents')::bigint, (value->>'lineTotalCents')::bigint
  FROM jsonb_array_elements(p_positions) WITH ORDINALITY AS entry(value, ordinal);

  UPDATE private.quotes SET due_date = p_due_date, note = p_note, total_net_cents = v_total,
    version = v_next_version,
    fassung = CASE WHEN v_quote.gesendet_fassung IS NOT NULL AND (
      v_quote.due_date IS DISTINCT FROM p_due_date OR v_quote.note IS DISTINCT FROM p_note OR
      (SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('name',p.name,'quantity',p.quantity,'material',p.material,'surfaceRequested',p.surface_requested,'unitPriceCents',p.unit_price_cents,'lineTotalCents',p.zeilen_gesamt_cents)) ORDER BY p.position)
       FROM private.quote_positions p WHERE p.tenant_id=p_tenant_id AND p.quote_id=p_quote_id AND p.revision=p_expected_version)
      IS DISTINCT FROM (SELECT jsonb_agg(jsonb_strip_nulls(value) ORDER BY ordinal) FROM jsonb_array_elements(p_positions) WITH ORDINALITY entry(value,ordinal)))
      THEN v_quote.fassung+1 ELSE v_quote.fassung END,
    updated_by = p_actor_id, updated_at = statement_timestamp()
  WHERE tenant_id = p_tenant_id AND id = p_quote_id;

  INSERT INTO public.events (id, tenant_id, order_id, item_id, event_type, description, notes, payload,
    status, user_id, station, client_event_id, event_schema_version, correlation_id, aggregate_version, from_station, created_at)
  VALUES (v_event_id, p_tenant_id, NULL, NULL, 'QUOTE_UPDATED_V1', 'KV geändert', p_note,
    jsonb_build_object('quoteId', p_quote_id::text, 'intentSha256', p_intent_sha256), 'success', p_actor_id, NULL,
    p_client_event_id, 1, v_correlation_id, v_next_version, NULL, statement_timestamp() AT TIME ZONE 'UTC');
  INSERT INTO private.quote_update_receipts (id, event_id, tenant_id, quote_id, actor_id, client_event_id,
    correlation_id, intent_sha256, expected_version, aggregate_version)
  VALUES (v_receipt_id, v_event_id, p_tenant_id, p_quote_id, p_actor_id, p_client_event_id,
    v_correlation_id, p_intent_sha256, p_expected_version, v_next_version);
  RETURN QUERY SELECT 'OK', p_quote_id, false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.finalize_quote_conversion_from_order_event_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_request private.quote_conversion_requests%ROWTYPE;
  v_quote private.quotes%ROWTYPE;
  v_converted_version integer;
  v_handover_mode text;
  v_payment_mode text;
BEGIN
  SELECT * INTO v_request FROM private.quote_conversion_requests
   WHERE tenant_id = NEW.tenant_id AND actor_id = NEW.user_id AND client_event_id = NEW.client_event_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.event_type <> 'ORDER_INTAKE_CREATED_V1' OR NEW.order_id IS NULL OR NEW.status <> 'success'
     OR NEW.station <> 'wareneingang' OR NEW.event_schema_version <> 1 OR NEW.aggregate_version <> 1
  THEN RAISE EXCEPTION 'QUOTE_CONVERSION_ORDER_EVENT_MISMATCH'; END IF;

  SELECT orders.handover_mode, orders.payment_mode
    INTO v_handover_mode, v_payment_mode
  FROM public.orders
  WHERE orders.tenant_id = NEW.tenant_id AND orders.id = NEW.order_id;
  IF NOT FOUND OR NEW.payload IS DISTINCT FROM jsonb_build_object(
    'intentSha256', v_request.order_intent_sha256,
    'handoverMode', v_handover_mode,
    'paymentMode', v_payment_mode
  ) THEN RAISE EXCEPTION 'QUOTE_CONVERSION_ORDER_EVENT_MISMATCH'; END IF;

  SELECT * INTO v_quote FROM private.quotes WHERE tenant_id = NEW.tenant_id AND id = v_request.quote_id FOR UPDATE;
  IF NOT FOUND OR v_quote.status <> 'draft' OR v_quote.version <> v_request.expected_version
  THEN RAISE EXCEPTION 'QUOTE_CONVERSION_STATE_MISMATCH'; END IF;
  v_converted_version := v_request.expected_version + 1;

  INSERT INTO private.quote_positions (
    tenant_id, quote_id, revision, position, name, quantity, material, surface_requested, unit_price_cents, zeilen_gesamt_cents
  )
  SELECT tenant_id, quote_id, v_converted_version, position, name, quantity, material, surface_requested, unit_price_cents, zeilen_gesamt_cents
  FROM private.quote_positions
  WHERE tenant_id = NEW.tenant_id AND quote_id = v_request.quote_id AND revision = v_request.expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'QUOTE_CONVERSION_POSITIONS_MISSING'; END IF;

  UPDATE private.quotes SET status = 'converted', version = v_converted_version, linked_order_id = NEW.order_id,
    converted_at = statement_timestamp(), updated_by = NEW.user_id, updated_at = statement_timestamp()
  WHERE tenant_id = NEW.tenant_id AND id = v_request.quote_id;

  INSERT INTO public.events (id, tenant_id, order_id, item_id, event_type, description, notes, payload,
    status, user_id, station, client_event_id, event_schema_version, correlation_id, aggregate_version, from_station, created_at)
  VALUES (v_request.event_id, NEW.tenant_id, NULL, NULL, 'QUOTE_AWARDED_V1', 'KV beauftragt', NULL,
    jsonb_build_object('quoteId', v_request.quote_id::text, 'orderId', NEW.order_id, 'intentSha256', v_request.intent_sha256),
    'success', NEW.user_id, NULL, v_request.award_client_event_id, 1, v_request.correlation_id, v_converted_version, NULL,
    statement_timestamp() AT TIME ZONE 'UTC');

  INSERT INTO private.quote_conversion_receipts (id, event_id, tenant_id, quote_id, customer_id, order_id, order_intake_event_id,
    order_intent_sha256, actor_id, client_event_id, award_client_event_id, correlation_id, intent_sha256, quote_version)
  VALUES (v_request.receipt_id, v_request.event_id, NEW.tenant_id, v_request.quote_id, v_quote.customer_id,
    NEW.order_id, NEW.id, v_request.order_intent_sha256, NEW.user_id, NEW.client_event_id,
    v_request.award_client_event_id, v_request.correlation_id, v_request.intent_sha256, v_converted_version);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE VIEW private.v_quotes_v1 WITH (security_invoker=true) AS
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
    ((customer.id IS NOT NULL) AND (creator.id IS NOT NULL) AND (positions.position_count >= 1) AND (positions.position_count <= 20) AND (positions.calculated_total = quote.total_net_cents) AND (((quote.valid_until IS NULL) AND (quote.intake_term_status IS NULL) AND (quote.intake_source IS NULL)) OR ((quote.valid_until IS NOT NULL) AND (quote.intake_term_status = ANY (ARRAY['wunsch'::text, 'bestaetigt'::text, 'verschoben'::text, 'gegenvorschlag'::text])) AND (quote.intake_source = ANY (ARRAY['persoenlich'::text, 'versand'::text, 'abholung_firma'::text, 'anfrage_mail'::text, 'anfrage_telefon'::text])))) AND (((quote.status = 'draft'::text) AND (quote.version >= 1) AND (quote.linked_order_id IS NULL)) OR ((quote.status = 'converted'::text) AND (quote.version >= 2) AND (quote.linked_order_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM private.quote_conversion_receipts receipt
          WHERE ((receipt.tenant_id = quote.tenant_id) AND (receipt.quote_id = quote.id) AND (receipt.order_id = quote.linked_order_id) AND (receipt.quote_version = quote.version))))))) AS integrity_ok,
    quote.valid_until,
    quote.intake_term_status,
    quote.intake_source,
    quote.fassung,
    quote.kalk_stunden,
    quote.stundensatz_cents,
    quote.ruest_cents,
    quote.material_cents,
    quote.lieferzeit_wochen,
    quote.gesendet_fassung,
    quote.gesendet_am,
    quote.gesendet_kanal,
    quote.zugesagt_fassung,
    quote.zugesagt_am,
    quote.zusage_nachweis,
    quote.abgesagt_am,
    quote.absage_grund,
    quote.nachfass_am,
    quote.quelle_intake_item_id,
    quote.quelle_nachricht_id,
    quote.sonderwuensche,
    CASE WHEN quote.linked_order_id IS NOT NULL THEN 'umgewandelt'
     WHEN quote.abgesagt_am IS NOT NULL THEN 'abgesagt'
     WHEN quote.zugesagt_fassung=quote.fassung AND quote.zugesagt_am IS NOT NULL AND nullif(btrim(quote.zusage_nachweis),'') IS NOT NULL THEN 'zugesagt'
     WHEN quote.valid_until < (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date THEN 'abgelaufen'
     WHEN quote.gesendet_fassung < quote.fassung THEN 'geaendert_seit_versand'
     WHEN quote.gesendet_fassung=quote.fassung THEN 'versendet' ELSE 'entwurf' END AS derived_status
   FROM (((private.quotes quote
     LEFT JOIN customers customer ON ((((customer.tenant_id)::text = quote.tenant_id) AND (customer.id = quote.customer_id))))
     LEFT JOIN app_users creator ON (((creator.tenant_id = quote.tenant_id) AND (creator.id = quote.created_by))))
     LEFT JOIN LATERAL ( SELECT (count(*))::integer AS position_count,
            (COALESCE(sum(coalesce("position".zeilen_gesamt_cents,"position".line_total_cents)), (0)::numeric))::bigint AS calculated_total,
            jsonb_agg(jsonb_build_object('id', ("position".id)::text, 'position', "position"."position", 'name', "position".name, 'quantity', "position".quantity, 'material', "position".material, 'surfaceRequested', "position".surface_requested, 'unitPriceCents', coalesce("position".zeilen_gesamt_cents::numeric/"position".quantity,"position".unit_price_cents), 'lineTotalCents', coalesce("position".zeilen_gesamt_cents,"position".line_total_cents), 'explicitLineTotal', "position".zeilen_gesamt_cents IS NOT NULL) ORDER BY "position"."position") AS positions
           FROM private.quote_positions "position"
          WHERE (("position".tenant_id = quote.tenant_id) AND ("position".quote_id = quote.id) AND ("position".revision = quote.version))) positions ON (true))
  WHERE ((NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL) AND (quote.tenant_id = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text)));

CREATE OR REPLACE VIEW private.v_open_quotes_v1 WITH (security_invoker=true) AS SELECT * FROM private.v_quotes_v1 WHERE status='draft';
