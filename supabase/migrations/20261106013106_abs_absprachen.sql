-- AP-ABS: typed customer/order agreements, invoice collection truth and tenant-safe links.
-- Existing free-text notes remain untouched; only a typed, non-revoked agreement can
-- influence payment or goods-out behaviour.

CREATE TABLE public.customer_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_id text NOT NULL,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 20),
  bezeichnung text NOT NULL CHECK (char_length(btrim(bezeichnung)) BETWEEN 1 AND 160),
  wert text,
  geld boolean NOT NULL DEFAULT false,
  hinweis boolean NOT NULL DEFAULT false,
  gueltig_bis date,
  typ text CHECK (typ IS NULL OR typ IN ('ausgabe_ohne_zahlung', 'sammelrechnung', 'zahlungsziel')),
  order_id text,
  ziel_tage integer CHECK (ziel_tage IS NULL OR ziel_tage BETWEEN 1 AND 120),
  grund text CHECK (grund IS NULL OR char_length(btrim(grund)) BETWEEN 3 AND 400),
  widerrufen_am timestamptz,
  widerrufen_von uuid,
  widerruf_grund text CHECK (widerruf_grund IS NULL OR char_length(btrim(widerruf_grund)) BETWEEN 3 AND 400),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  client_key uuid,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  created_by uuid,
  CONSTRAINT customer_agreements_tenant_customer_fk
    FOREIGN KEY (tenant_id, customer_id) REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT customer_agreements_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id) REFERENCES public.orders (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT customer_agreements_tenant_revoker_fk
    FOREIGN KEY (tenant_id, widerrufen_von) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT customer_agreements_tenant_creator_fk
    FOREIGN KEY (tenant_id, created_by) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT customer_agreements_type_terms_chk CHECK (
    (typ IN ('sammelrechnung', 'zahlungsziel') AND ziel_tage BETWEEN 1 AND 120)
    OR ((typ IS NULL OR typ = 'ausgabe_ohne_zahlung') AND ziel_tage IS NULL)
  ),
  CONSTRAINT customer_agreements_revocation_chk CHECK (
    (widerrufen_am IS NULL AND widerrufen_von IS NULL AND widerruf_grund IS NULL)
    OR (widerrufen_am IS NOT NULL AND widerrufen_von IS NOT NULL AND widerruf_grund IS NOT NULL)
  )
);

CREATE UNIQUE INDEX customer_agreements_client_key_uidx
  ON public.customer_agreements (tenant_id, client_key)
  WHERE client_key IS NOT NULL;

-- A customer-level agreement and an order-level agreement are separate scopes.
CREATE UNIQUE INDEX customer_agreements_valid_typed_scope_uidx
  ON public.customer_agreements (tenant_id, customer_id, COALESCE(order_id, '__CUSTOMER__'))
  WHERE typ IS NOT NULL AND widerrufen_am IS NULL;

CREATE UNIQUE INDEX customer_agreements_open_freetext_position_uidx
  ON public.customer_agreements (tenant_id, customer_id, position)
  WHERE typ IS NULL AND widerrufen_am IS NULL;

CREATE INDEX customer_agreements_effective_lookup_idx
  ON public.customer_agreements (tenant_id, customer_id, order_id, typ, gueltig_bis)
  WHERE widerrufen_am IS NULL;

CREATE TABLE public.invoice_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_id text NOT NULL,
  monat date NOT NULL CHECK (monat = date_trunc('month', monat)::date),
  ziel_tage integer NOT NULL CHECK (ziel_tage BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'abgerechnet')),
  invoice_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  created_by uuid,
  CONSTRAINT invoice_collections_tenant_id_uidx UNIQUE (tenant_id, id),
  CONSTRAINT invoice_collections_tenant_customer_fk
    FOREIGN KEY (tenant_id, customer_id) REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT invoice_collections_tenant_invoice_fk
    FOREIGN KEY (tenant_id, invoice_id) REFERENCES public.invoices (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT invoice_collections_tenant_creator_fk
    FOREIGN KEY (tenant_id, created_by) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT invoice_collections_customer_month_uidx UNIQUE (tenant_id, customer_id, monat),
  CONSTRAINT invoice_collections_state_invoice_chk CHECK (
    status = 'offen' OR (status = 'abgerechnet' AND invoice_id IS NOT NULL)
  )
);

CREATE TABLE public.invoice_collection_orders (
  collection_id uuid NOT NULL,
  tenant_id text NOT NULL,
  order_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (collection_id, order_id),
  CONSTRAINT invoice_collection_orders_tenant_collection_fk
    FOREIGN KEY (tenant_id, collection_id) REFERENCES public.invoice_collections (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT invoice_collection_orders_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id) REFERENCES public.orders (tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX invoice_collection_orders_tenant_collection_idx
  ON public.invoice_collection_orders (tenant_id, collection_id, order_id);

ALTER TABLE public.customer_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_collection_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_agreements_tenant_isolation ON public.customer_agreements
  FOR ALL TO service_role
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));

CREATE POLICY invoice_collections_tenant_isolation ON public.invoice_collections
  FOR ALL TO service_role
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));

CREATE POLICY invoice_collection_orders_tenant_isolation ON public.invoice_collection_orders
  FOR ALL TO service_role
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));

-- The application writes exclusively through tenant-bound server commands.
REVOKE ALL ON TABLE public.customer_agreements, public.invoice_collections, public.invoice_collection_orders
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customer_agreements, public.invoice_collections, public.invoice_collection_orders
  TO service_role;
REVOKE DELETE, TRUNCATE ON TABLE public.customer_agreements, public.invoice_collections, public.invoice_collection_orders
  FROM service_role, anon, authenticated;

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
    gueltig_bis, typ, order_id, ziel_tage, grund, client_key, created_by
  ) VALUES (
    p_tenant_id, p_customer_id, v_position, v_label,
    CASE WHEN p_ziel_tage IS NULL THEN NULL ELSE p_ziel_tage::text || ' Tage' END,
    true, false, p_gueltig_bis, p_typ, p_order_id, p_ziel_tage, btrim(p_grund), p_client_key, p_actor_id
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

CREATE OR REPLACE FUNCTION private.revoke_customer_agreement_v1(
  p_tenant_id text,
  p_actor_id uuid,
  p_client_key uuid,
  p_agreement_id uuid,
  p_reason text,
  p_expected_version integer,
  p_intent_sha256 text
) RETURNS TABLE(result_code text, agreement_id uuid, replayed boolean, result_message text)
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_event_count integer;
  v_event public.events%ROWTYPE;
  v_agreement public.customer_agreements%ROWTYPE;
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
    IF v_event.event_type = 'CUSTOMER_AGREEMENT_REVOKED_V1'
      AND v_event.payload->>'intentSha256' = p_intent_sha256
      AND (v_event.payload->>'agreementId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN
      RETURN QUERY SELECT 'OK'::text, (v_event.payload->>'agreementId')::uuid, true, NULL::text;
    ELSE
      RETURN QUERY SELECT 'CONFLICT'::text, NULL::uuid, false, 'Anfragekennung wurde bereits anders verwendet.'::text;
      RETURN;
    END IF;
  END IF;

  SELECT * INTO v_agreement
  FROM public.customer_agreements
  WHERE tenant_id = p_tenant_id AND id = p_agreement_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text, NULL::uuid, false, 'Absprache ist nicht verfügbar.'::text;
    RETURN;
  END IF;
  IF p_expected_version IS DISTINCT FROM v_agreement.version THEN
    RETURN QUERY SELECT 'CONFLICT'::text, NULL::uuid, false, 'Absprache wurde bereits geändert.'::text;
    RETURN;
  END IF;
  IF v_agreement.typ IS NULL THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false, 'Nur typisierte Zahlungsabsprachen können hier widerrufen werden.'::text;
    RETURN;
  END IF;
  IF v_agreement.widerrufen_am IS NOT NULL THEN
    RETURN QUERY SELECT 'CONFLICT'::text, NULL::uuid, false, 'Absprache wurde bereits widerrufen.'::text;
    RETURN;
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) < 3 THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false, 'Bitte Grund angeben.'::text;
    RETURN;
  END IF;
  IF char_length(btrim(p_reason)) > 400 THEN
    RETURN QUERY SELECT 'VALIDATION_ERROR'::text, NULL::uuid, false, 'Grund darf höchstens 400 Zeichen haben.'::text;
    RETURN;
  END IF;

  v_before := jsonb_build_object(
    'id', v_agreement.id::text,
    'type', v_agreement.typ,
    'version', v_agreement.version,
    'targetDays', v_agreement.ziel_tage,
    'validUntil', v_agreement.gueltig_bis,
    'reason', v_agreement.grund
  );

  UPDATE public.customer_agreements
  SET widerrufen_am = statement_timestamp(), widerrufen_von = p_actor_id,
    widerruf_grund = btrim(p_reason), version = version + 1
  WHERE tenant_id = p_tenant_id AND id = v_agreement.id AND version = v_agreement.version
  RETURNING * INTO v_agreement;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'CONFLICT'::text, NULL::uuid, false, 'Absprache wurde bereits geändert.'::text;
    RETURN;
  END IF;
  INSERT INTO public.events (
    id, tenant_id, order_id, item_id, event_type, description, payload,
    status, user_id, station, client_event_id, event_schema_version,
    correlation_id, aggregate_version, from_station, created_at
  ) VALUES (
    gen_random_uuid()::text, p_tenant_id, v_agreement.order_id, NULL,
    'CUSTOMER_AGREEMENT_REVOKED_V1', 'Zahlungsabsprache widerrufen',
    jsonb_build_object(
      'intentSha256', p_intent_sha256,
      'agreementId', v_agreement.id::text,
      'customerId', v_agreement.customer_id,
      'before', v_before,
      'after', jsonb_build_object('id', v_agreement.id::text, 'type', v_agreement.typ, 'version', v_agreement.version, 'reason', v_agreement.widerruf_grund),
      'reason', v_agreement.widerruf_grund
    ),
    'success', p_actor_id, NULL, p_client_key, 1, gen_random_uuid(), v_agreement.version, NULL,
    statement_timestamp() AT TIME ZONE 'UTC'
  );
  RETURN QUERY SELECT 'OK'::text, v_agreement.id, false, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION private.save_customer_agreement_v1(text, uuid, uuid, text, text, text, integer, date, text, integer, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.revoke_customer_agreement_v1(text, uuid, uuid, uuid, text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.save_customer_agreement_v1(text, uuid, uuid, text, text, text, integer, date, text, integer, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION private.revoke_customer_agreement_v1(text, uuid, uuid, uuid, text, integer, text)
  TO service_role;
