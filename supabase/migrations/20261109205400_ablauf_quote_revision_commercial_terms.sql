-- PL 09.11.21:45: commercial facts belong to each immutable quote revision.
-- No historical values are backfilled or guessed. Existing guards/receipts remain.
ALTER TABLE private.quote_positions
 ADD COLUMN vat_rate_basis_points integer CHECK(vat_rate_basis_points IS NULL OR vat_rate_basis_points IN (0,700,1900));

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
          OR (SELECT count(*) FROM jsonb_object_keys(value)) <> 5 + CASE WHEN value ? 'lineTotalCents' THEN 1 ELSE 0 END + CASE WHEN value ? 'unit' THEN 1 ELSE 0 END + CASE WHEN value ? 'plannedMinutes' THEN 1 ELSE 0 END
          OR (value ? 'unit' AND value->'unit'<>'null'::jsonb AND (jsonb_typeof(value->'unit')<>'string' OR value->>'unit'<>btrim(value->>'unit') OR length(value->>'unit') NOT BETWEEN 1 AND 32))
          OR (value ? 'plannedMinutes' AND value->'plannedMinutes'<>'null'::jsonb AND coalesce(value->>'plannedMinutes','') !~ '^[0-9]{1,7}$')
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
    tenant_id, quote_id, revision, position, name, quantity, material, surface_requested, unit_price_cents, zeilen_gesamt_cents, unit, aufwand_min, vat_rate_basis_points
  )
  SELECT p_tenant_id, v_quote_id, 1, ordinal::integer, value->>'name', (value->>'quantity')::integer,
    CASE WHEN value->'material' = 'null'::jsonb THEN NULL ELSE value->>'material' END,
    value->>'surfaceRequested', (value->>'unitPriceCents')::bigint, (value->>'lineTotalCents')::bigint, value->>'unit', (value->>'plannedMinutes')::integer,
    (SELECT settings.invoice_vat_rate_basis_points FROM public.company_settings settings WHERE settings.tenant_id=p_tenant_id)
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
          OR (SELECT count(*) FROM jsonb_object_keys(value)) <> 5 + CASE WHEN value ? 'lineTotalCents' THEN 1 ELSE 0 END + CASE WHEN value ? 'unit' THEN 1 ELSE 0 END + CASE WHEN value ? 'plannedMinutes' THEN 1 ELSE 0 END
          OR (value ? 'unit' AND value->'unit'<>'null'::jsonb AND (jsonb_typeof(value->'unit')<>'string' OR value->>'unit'<>btrim(value->>'unit') OR length(value->>'unit') NOT BETWEEN 1 AND 32))
          OR (value ? 'plannedMinutes' AND value->'plannedMinutes'<>'null'::jsonb AND coalesce(value->>'plannedMinutes','') !~ '^[0-9]{1,7}$')
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
  IF v_quote.status <> 'draft' OR v_quote.abgesagt_am IS NOT NULL OR v_quote.version <> p_expected_version THEN
    RETURN QUERY SELECT 'CONFLICT', NULL::uuid, false; RETURN;
  END IF;

  -- Older clients omit the new fields. Preserve facts instead of silently erasing them.
  SELECT jsonb_agg(entry.value || jsonb_strip_nulls(jsonb_build_object(
    'unit',CASE WHEN entry.value ? 'unit' THEN entry.value->'unit' ELSE to_jsonb(previous.unit) END,
    'plannedMinutes',CASE WHEN entry.value ? 'plannedMinutes' THEN entry.value->'plannedMinutes' ELSE to_jsonb(previous.aufwand_min) END
  )) ORDER BY entry.ordinal)
  INTO p_positions
  FROM jsonb_array_elements(p_positions) WITH ORDINALITY entry(value,ordinal)
  LEFT JOIN private.quote_positions previous ON previous.tenant_id=p_tenant_id AND previous.quote_id=p_quote_id
    AND previous.revision=p_expected_version AND previous.position=entry.ordinal;

  SELECT sum(coalesce((value->>'lineTotalCents')::bigint,(value->>'quantity')::bigint * (value->>'unitPriceCents')::bigint))
    INTO v_total FROM jsonb_array_elements(p_positions) entry(value);
  IF v_total IS NULL OR v_total NOT BETWEEN 0 AND 999999999999 THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR', NULL::uuid, false; RETURN;
  END IF;
  v_next_version := p_expected_version + 1;

  INSERT INTO private.quote_positions (tenant_id, quote_id, revision, position, name, quantity, material, surface_requested, unit_price_cents, zeilen_gesamt_cents, unit, aufwand_min, vat_rate_basis_points)
  SELECT p_tenant_id, p_quote_id, v_next_version, ordinal::integer, value->>'name', (value->>'quantity')::integer,
    CASE WHEN value->'material' = 'null'::jsonb THEN NULL ELSE value->>'material' END,
    value->>'surfaceRequested', (value->>'unitPriceCents')::bigint, (value->>'lineTotalCents')::bigint, value->>'unit', (value->>'plannedMinutes')::integer,
    CASE WHEN EXISTS(SELECT 1 FROM private.quote_positions previous WHERE previous.tenant_id=p_tenant_id AND previous.quote_id=p_quote_id AND previous.revision=p_expected_version AND previous.position=ordinal AND previous.name=value->>'name' AND previous.quantity=(value->>'quantity')::integer AND previous.material IS NOT DISTINCT FROM value->>'material' AND previous.surface_requested=value->>'surfaceRequested' AND previous.unit_price_cents=(value->>'unitPriceCents')::bigint AND previous.zeilen_gesamt_cents IS NOT DISTINCT FROM (value->>'lineTotalCents')::bigint AND previous.unit IS NOT DISTINCT FROM value->>'unit' AND previous.aufwand_min IS NOT DISTINCT FROM (value->>'plannedMinutes')::integer) THEN (SELECT previous.vat_rate_basis_points FROM private.quote_positions previous WHERE previous.tenant_id=p_tenant_id AND previous.quote_id=p_quote_id AND previous.revision=p_expected_version AND previous.position=ordinal) ELSE (SELECT settings.invoice_vat_rate_basis_points FROM public.company_settings settings WHERE settings.tenant_id=p_tenant_id) END
  FROM jsonb_array_elements(p_positions) WITH ORDINALITY AS entry(value, ordinal);

  UPDATE private.quotes SET due_date = p_due_date, note = p_note, total_net_cents = v_total,
    version = v_next_version,
    fassung = CASE WHEN v_quote.gesendet_fassung IS NOT NULL AND (
      v_quote.note IS DISTINCT FROM p_note OR
      (SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('name',p.name,'quantity',p.quantity,'material',p.material,'surfaceRequested',p.surface_requested,'unitPriceCents',p.unit_price_cents,'lineTotalCents',p.zeilen_gesamt_cents,'unit',p.unit,'plannedMinutes',p.aufwand_min)) ORDER BY p.position)
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
