-- Replacing an agreement must advance the existing optimistic version.
-- The superseded row is already incremented and retained by the canonical command.
-- Reusing that version prevents a second stale editor from replacing the new row.
CREATE OR REPLACE FUNCTION private.save_customer_agreement_v1(
  p_tenant_id text,
  p_actor_id uuid,
  p_client_key uuid,
  p_customer_id text,
  p_order_id text,
  p_typ text,
  p_ziel_tage integer,
  p_gueltig_bis date,
  p_grund text,
  p_expected_version integer,
  p_intent_sha256 text
) RETURNS TABLE(result_code text, agreement_id uuid, replayed boolean, result_message text)
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_event_count integer;
  v_event public.events%ROWTYPE;
  v_previous public.customer_agreements%ROWTYPE;
  v_agreement public.customer_agreements%ROWTYPE;
  v_position integer;
  v_correlation_id uuid := gen_random_uuid();
  v_label text;
  v_before jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('customer-agreement-client:' || p_tenant_id || ':' || p_client_key::text, 0));
  SELECT count(*)::integer INTO v_event_count
  FROM public.events
  WHERE tenant_id = p_tenant_id AND client_event_id = p_client_key;
  IF v_event_count > 0 THEN
    IF v_event_count <> 1 THEN
      RETURN QUERY SELECT 'CONFLICT'::text, NULL::uuid, false, 'Anfragekennung wurde bereits anders verwendet.'::text;
      RETURN;
    END IF;
    SELECT * INTO v_event
    FROM public.events
    WHERE tenant_id = p_tenant_id AND client_event_id = p_client_key;
    IF v_event.event_type = 'CUSTOMER_AGREEMENT_SAVED_V1'
      AND v_event.payload->>'intentSha256' = p_intent_sha256
      AND (v_event.payload->>'agreementId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN
      RETURN QUERY SELECT 'OK'::text, (v_event.payload->>'agreementId')::uuid, true, NULL::text;
      RETURN;
    ELSE
      RETURN QUERY SELECT 'CONFLICT'::text, NULL::uuid, false, 'Anfragekennung wurde bereits anders verwendet.'::text;
      RETURN;
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('customer-agreement-scope:' || p_tenant_id || ':' || p_customer_id || ':' || coalesce(p_order_id, '__CUSTOMER__'), 0));
  SELECT * INTO v_previous
  FROM public.customer_agreements
  WHERE tenant_id = p_tenant_id
    AND customer_id = p_customer_id
    AND order_id IS NOT DISTINCT FROM p_order_id
    AND typ IS NOT NULL
    AND widerrufen_am IS NULL
  FOR UPDATE;
  IF p_expected_version IS DISTINCT FROM v_previous.version THEN
    RETURN QUERY SELECT 'CONFLICT'::text, NULL::uuid, false, 'Absprache wurde bereits geändert.'::text;
    RETURN;
  END IF;
  IF p_typ IS NULL OR p_typ NOT IN ('ausgabe_ohne_zahlung', 'sammelrechnung', 'zahlungsziel') THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false, 'Typ wählen.'::text;
    RETURN;
  END IF;
  IF (p_typ IN ('sammelrechnung', 'zahlungsziel') AND (p_ziel_tage IS NULL OR p_ziel_tage NOT BETWEEN 1 AND 120))
    OR (p_typ = 'ausgabe_ohne_zahlung' AND p_ziel_tage IS NOT NULL)
  THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false, 'Tage eintragen · 1 bis 120.'::text;
    RETURN;
  END IF;
  IF char_length(btrim(coalesce(p_grund, ''))) < 3 THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false, 'Bitte Grund angeben.'::text;
    RETURN;
  END IF;
  IF char_length(btrim(p_grund)) > 400 THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false, 'Grund darf höchstens 400 Zeichen haben.'::text;
    RETURN;
  END IF;
  IF p_gueltig_bis IS NOT NULL AND p_gueltig_bis < CURRENT_DATE THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false, 'Datum heute oder später wählen.'::text;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE tenant_id = p_tenant_id AND id = p_customer_id) THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, false, 'Kunde ist nicht verfügbar.'::text;
    RETURN;
  END IF;
  IF p_order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.orders WHERE tenant_id = p_tenant_id AND id = p_order_id AND customer_id = p_customer_id
  ) THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, false, 'Auftrag ist für diesen Kunden nicht verfügbar.'::text;
    RETURN;
  END IF;

  IF v_previous.id IS NULL THEN
    SELECT candidate::integer INTO v_position
    FROM generate_series(1, 20) AS candidate
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.customer_agreements agreement
      WHERE agreement.tenant_id = p_tenant_id
        AND agreement.customer_id = p_customer_id
        AND agreement.position = candidate
        AND agreement.widerrufen_am IS NULL
    )
    ORDER BY candidate
    LIMIT 1;
    IF v_position IS NULL THEN
      RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false, 'Maximal 20 Absprachen sind möglich.'::text;
      RETURN;
    END IF;
  ELSE
    v_position := v_previous.position;
    v_before := jsonb_build_object(
      'id', v_previous.id::text,
      'type', v_previous.typ,
      'version', v_previous.version,
      'targetDays', v_previous.ziel_tage,
      'validUntil', v_previous.gueltig_bis,
      'reason', v_previous.grund
    );
    v_label := CASE p_typ
      WHEN 'ausgabe_ohne_zahlung' THEN 'Übergabe ohne Zahlung · Rechnung folgt'
      WHEN 'sammelrechnung' THEN 'Sammelrechnung monatlich'
      ELSE 'Zahlungsziel in Tagen'
    END;
    UPDATE public.customer_agreements
    SET widerrufen_am = statement_timestamp(), widerrufen_von = p_actor_id,
      widerruf_grund = 'ersetzt durch ' || v_label, version = version + 1
    WHERE tenant_id = p_tenant_id AND id = v_previous.id AND version = v_previous.version
    RETURNING * INTO v_previous;
    IF NOT FOUND THEN
      RETURN QUERY SELECT 'CONFLICT'::text, NULL::uuid, false, 'Absprache wurde bereits geändert.'::text;
      RETURN;
    END IF;
  END IF;

  v_label := CASE p_typ
    WHEN 'ausgabe_ohne_zahlung' THEN 'Übergabe ohne Zahlung · Rechnung folgt'
    WHEN 'sammelrechnung' THEN 'Sammelrechnung monatlich'
    ELSE 'Zahlungsziel in Tagen'
  END;
  INSERT INTO public.customer_agreements (
    tenant_id, customer_id, position, bezeichnung, wert, geld, hinweis,
    gueltig_bis, typ, order_id, ziel_tage, grund, client_key, created_by, version
  ) VALUES (
    p_tenant_id, p_customer_id, v_position, v_label,
    CASE WHEN p_ziel_tage IS NULL THEN NULL ELSE p_ziel_tage::text || ' Tage' END,
    true, false, p_gueltig_bis, p_typ, p_order_id, p_ziel_tage, btrim(p_grund), p_client_key, p_actor_id, coalesce(v_previous.version, 1)
  ) RETURNING * INTO v_agreement;

  INSERT INTO public.events (
    id, tenant_id, order_id, item_id, event_type, description, payload,
    status, user_id, station, client_event_id, event_schema_version,
    correlation_id, aggregate_version, from_station, created_at
  ) VALUES (
    gen_random_uuid()::text, p_tenant_id, p_order_id, NULL,
    'CUSTOMER_AGREEMENT_SAVED_V1', 'Zahlungsabsprache gespeichert',
    jsonb_build_object(
      'intentSha256', p_intent_sha256,
      'agreementId', v_agreement.id::text,
      'customerId', v_agreement.customer_id,
      'before', v_before,
      'after', jsonb_build_object('id', v_agreement.id::text, 'type', v_agreement.typ, 'version', v_agreement.version, 'reason', v_agreement.grund),
      'reason', v_agreement.grund
    ),
    'success', p_actor_id, NULL, p_client_key, 1, v_correlation_id, v_agreement.version, NULL,
    statement_timestamp() AT TIME ZONE 'UTC'
  );
  RETURN QUERY SELECT 'OK'::text, v_agreement.id, false, NULL::text;
END;
$$;
