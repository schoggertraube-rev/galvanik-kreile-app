-- U-245: validity, wish/confirmation and source are independent facts.
-- Missing facts stay NULL; the writer never manufactures a source for a validity date.
ALTER TABLE private.quotes DROP CONSTRAINT quotes_intake_metadata_chk;
ALTER TABLE private.quotes
 ADD CONSTRAINT quotes_v04_term_optional CHECK(intake_term_status IS NULL OR intake_term_status IN ('wunsch','bestaetigt','verschoben','gegenvorschlag')),
 ADD CONSTRAINT quotes_v04_source_optional CHECK(intake_source IS NULL OR intake_source IN ('persoenlich','versand','abholung_firma','anfrage_mail','anfrage_telefon'));

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
     OR (p_intake_term_status IS NOT NULL AND p_intake_term_status NOT IN ('wunsch','bestaetigt','verschoben','gegenvorschlag'))
     OR (p_intake_source IS NOT NULL AND p_intake_source NOT IN ('persoenlich','versand','abholung_firma','anfrage_mail','anfrage_telefon'))
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
    ((customer.id IS NOT NULL) AND (creator.id IS NOT NULL) AND (positions.position_count >= 1) AND (positions.position_count <= 20) AND (positions.calculated_total = quote.total_net_cents) AND (quote.intake_term_status IS NULL OR quote.intake_term_status=ANY(ARRAY['wunsch','bestaetigt','verschoben','gegenvorschlag'])) AND (quote.intake_source IS NULL OR quote.intake_source=ANY(ARRAY['persoenlich','versand','abholung_firma','anfrage_mail','anfrage_telefon'])) AND (((quote.status = 'draft'::text) AND (quote.version >= 1) AND (quote.linked_order_id IS NULL)) OR ((quote.status = 'converted'::text) AND (quote.version >= 2) AND (quote.linked_order_id IS NOT NULL) AND (EXISTS ( SELECT 1
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
     WHEN quote.gesendet_fassung=quote.fassung THEN 'versendet' ELSE 'entwurf' END AS derived_status,
    quote.vorbehalt_fassung,quote.vorbehalt_am,quote.vorbehalt_grund
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
