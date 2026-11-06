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

CREATE OR REPLACE VIEW private.v_customer_effective_agreement_v1
WITH (security_invoker = true)
AS
SELECT
  agreement.id,
  agreement.tenant_id,
  agreement.customer_id,
  agreement.order_id,
  agreement.position,
  agreement.bezeichnung,
  agreement.typ,
  agreement.ziel_tage,
  agreement.geld,
  agreement.hinweis,
  agreement.gueltig_bis,
  agreement.grund,
  agreement.version,
  agreement.created_at,
  creator.full_name AS created_by_name
FROM public.customer_agreements agreement
LEFT JOIN public.app_users creator
  ON creator.tenant_id = agreement.tenant_id
 AND creator.id = agreement.created_by
WHERE agreement.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND agreement.typ IS NOT NULL
  AND agreement.geld = true
  AND agreement.widerrufen_am IS NULL
  AND (agreement.gueltig_bis IS NULL OR agreement.gueltig_bis >= timezone('Europe/Berlin', now())::date);

REVOKE ALL ON TABLE private.v_customer_effective_agreement_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_customer_effective_agreement_v1 TO service_role;

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

-- V3 records the one typed-agreement exception without weakening either
-- legacy goods-out receipt.  The trigger rechecks the agreement at the write
-- boundary so a stale dialog cannot hand over goods after a revoke.
ALTER TABLE public.events
  ADD CONSTRAINT events_order_picked_up_v3_contract_chk
  CHECK (
    event_type <> 'ORDER_PICKED_UP_V3'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND correlation_id IS NOT NULL
      AND event_schema_version = 3
      AND aggregate_version > 0
      AND status = 'success'
      AND from_station = 'fertig'
      AND station = 'abgeholt'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'agreementId', payload->'agreementId',
        'agreementType', payload->'agreementType',
        'agreementVersion', payload->'agreementVersion',
        'gateAllowed', payload->'gateAllowed',
        'mode', payload->'mode',
        'orderId', payload->'orderId',
        'orderVersion', payload->'orderVersion',
        'paymentMode', payload->'paymentMode',
        'settlement', payload->'settlement'
      )
      AND coalesce(payload->>'agreementId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND payload->>'agreementType' IN ('ausgabe_ohne_zahlung', 'sammelrechnung', 'zahlungsziel')
      AND jsonb_typeof(payload->'agreementVersion') = 'number'
      AND (payload->>'agreementVersion') ~ '^[0-9]+$'
      AND (payload->>'agreementVersion')::integer > 0
      AND jsonb_typeof(payload->'gateAllowed') = 'boolean'
      AND payload->>'gateAllowed' = 'true'
      AND payload->>'mode' IN ('versand', 'abholung')
      AND payload->>'paymentMode' IN ('vorkasse', 'abholung', 'rechnung')
      AND payload->>'orderId' = order_id
      AND jsonb_typeof(payload->'orderVersion') = 'number'
      AND (payload->>'orderVersion') ~ '^[0-9]+$'
      AND (payload->>'orderVersion')::integer = aggregate_version
      AND payload->>'settlement' IN ('invoice', 'collection')
      AND ((payload->>'agreementType' = 'sammelrechnung') = (payload->>'settlement' = 'collection'))
    ), false)
  ) NOT VALID;

CREATE FUNCTION private.validate_abs_goods_out_v3_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_agreement public.customer_agreements%ROWTYPE;
  v_collection_count integer;
BEGIN
  IF NEW.event_type <> 'ORDER_PICKED_UP_V3' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_order
  FROM public.orders orders
  WHERE orders.tenant_id = NEW.tenant_id
    AND orders.id = NEW.order_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_order.version <> NEW.aggregate_version
    OR v_order.station <> 'abgeholt'
    OR v_order.current_station <> 'abgeholt'
    OR v_order.current_station_id <> 'abgeholt'
    OR v_order.status <> 'abgeholt'
    OR v_order.payment_mode <> NEW.payload->>'paymentMode'
  THEN
    RAISE EXCEPTION 'ABS_GOODS_OUT_ORDER_INVALID' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_agreement
  FROM public.customer_agreements agreement
  WHERE agreement.tenant_id = NEW.tenant_id
    AND agreement.id::text = NEW.payload->>'agreementId'
    AND agreement.customer_id = v_order.customer_id
    AND (agreement.order_id IS NULL OR agreement.order_id = NEW.order_id)
  FOR UPDATE;
  IF NOT FOUND
    OR v_agreement.typ <> NEW.payload->>'agreementType'
    OR v_agreement.version <> (NEW.payload->>'agreementVersion')::integer
    OR v_agreement.geld IS DISTINCT FROM true
    OR v_agreement.widerrufen_am IS NOT NULL
    OR (v_agreement.gueltig_bis IS NOT NULL AND v_agreement.gueltig_bis < timezone('Europe/Berlin', NEW.created_at)::date)
  THEN
    RAISE EXCEPTION 'ABS_GOODS_OUT_AGREEMENT_INVALID' USING ERRCODE = '23514';
  END IF;

  IF v_agreement.typ = 'sammelrechnung' THEN
    SELECT count(*)::integer INTO v_collection_count
    FROM public.invoice_collection_orders collection_order
    JOIN public.invoice_collections collection
      ON collection.tenant_id = collection_order.tenant_id
     AND collection.id = collection_order.collection_id
    WHERE collection_order.tenant_id = NEW.tenant_id
      AND collection_order.order_id = NEW.order_id
      AND collection.customer_id = v_order.customer_id
      AND collection.monat = date_trunc('month', timezone('Europe/Berlin', NEW.created_at))::date
      AND collection.status = 'offen'
      AND collection.ziel_tage = v_agreement.ziel_tage;
    IF v_collection_count <> 1 OR EXISTS (
      SELECT 1
      FROM public.invoices invoice
      WHERE invoice.tenant_id = NEW.tenant_id
        AND invoice.order_id = NEW.order_id
        AND invoice.status = 'issued'
    ) THEN
      RAISE EXCEPTION 'ABS_GOODS_OUT_COLLECTION_INVALID' USING ERRCODE = '23514';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.invoices invoice
    WHERE invoice.tenant_id = NEW.tenant_id
      AND invoice.order_id = NEW.order_id
      AND invoice.status = 'issued'
  ) THEN
    RAISE EXCEPTION 'ABS_GOODS_OUT_INVOICE_MISSING' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_abs_goods_out_v3_event_insert()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER events_abs_goods_out_v3_insert_guard
  BEFORE INSERT ON public.events
  FOR EACH ROW
  WHEN (NEW.event_type = 'ORDER_PICKED_UP_V3')
  EXECUTE FUNCTION private.validate_abs_goods_out_v3_event_insert();

CREATE TRIGGER events_abs_goods_out_v3_update_guard
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'ORDER_PICKED_UP_V3' OR NEW.event_type = 'ORDER_PICKED_UP_V3')
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_abs_goods_out_v3_delete_guard
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'ORDER_PICKED_UP_V3')
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE UNIQUE INDEX events_goods_out_client_event_v3_uidx
  ON public.events (tenant_id, client_event_id)
  WHERE event_type = 'ORDER_PICKED_UP_V3';

-- 5.2 keeps free-text agreements in the existing customer write transaction.
-- This replaces neither the typed-agreement commands nor the customer write path.
CREATE OR REPLACE FUNCTION private.update_customer_v1(
  p_tenant_id text,p_actor_id uuid,p_client_event_id uuid,p_customer_id text,p_intent_sha256 text,p_fields jsonb
) RETURNS TABLE(result_code text,replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_prior public.events%ROWTYPE;
  v_before public.customers%ROWTYPE;
  v_after public.customers%ROWTYPE;
  v_money boolean;
  v_name text;
  v_version integer;
  v_customer_fields jsonb;
  v_agreements jsonb;
  v_agreements_present boolean := false;
  v_before_agreements jsonb := '[]'::jsonb;
  v_after_agreements jsonb := '[]'::jsonb;
  v_entry jsonb;
  v_entry_id uuid;
  v_existing public.customer_agreements%ROWTYPE;
  v_position integer;
  v_used_positions integer[] := ARRAY[]::integer[];
  v_editable_ids uuid[] := ARRAY[]::uuid[];
  v_seen_ids uuid[] := ARRAY[]::uuid[];
  v_valid_until date;
BEGIN
  v_agreements_present := p_fields ? 'agreements';
  v_agreements := p_fields->'agreements';
  v_customer_fields := p_fields - 'agreements';
  IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id',true)),'')
    OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_customer_id IS NULL OR p_intent_sha256 IS NULL OR p_intent_sha256 !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object'
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_customer_fields) key WHERE key <> ALL(ARRAY[
      'type','company_name','salutation','first_name','last_name','contact_role','phone','email','billing_email','website',
      'street','house_number','zip_code','city','country','payment_preference','vat_id','notes','handover_preference',
      'iban','zahlungsziel_tage','auto_info','vorrang','address_status']))
    OR (v_agreements_present AND (jsonb_typeof(v_agreements) IS DISTINCT FROM 'array' OR jsonb_array_length(v_agreements) > 20))
    OR NOT EXISTS (SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=p_tenant_id AND actor.id=p_actor_id AND actor.active)
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='kunden')
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
  v_money := EXISTS (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='geld');
  PERFORM pg_advisory_xact_lock(hashtextextended('s1:customer-update:'||p_tenant_id||':'||p_actor_id||':'||p_client_event_id,0));
  SELECT * INTO v_prior FROM public.events WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND client_event_id=p_client_event_id AND event_type='CUSTOMER_UPDATED_V1';
  IF FOUND THEN
    RETURN QUERY SELECT CASE WHEN v_prior.payload->>'intentSha256'=p_intent_sha256 AND v_prior.payload->>'customerId'=p_customer_id THEN 'OK' ELSE 'CONFLICT' END,true; RETURN;
  END IF;
  SELECT * INTO v_before FROM public.customers WHERE tenant_id=p_tenant_id AND id=p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text,false; RETURN; END IF;
  v_after := jsonb_populate_record(v_before,v_customer_fields);
  IF NOT v_money AND (v_before.type='lieferant' OR v_after.type='lieferant'
    OR v_before.payment_preference IS DISTINCT FROM v_after.payment_preference
    OR v_before.iban IS DISTINCT FROM v_after.iban OR v_before.zahlungsziel_tage IS DISTINCT FROM v_after.zahlungsziel_tage)
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
  IF v_before.vorrang IS DISTINCT FROM v_after.vorrang AND NOT EXISTS
    (SELECT 1 FROM public.app_user_rights WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND bereich='entscheiden')
  THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
  IF v_after.payment_preference='rechnung' AND NOT v_before.ziel_freigeschaltet
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
  v_name := CASE WHEN v_after.type='privat' THEN concat_ws(' ',nullif(v_after.first_name,''),nullif(v_after.last_name,'')) ELSE v_after.company_name END;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 160 THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
  IF v_agreements_present THEN
    PERFORM 1 FROM public.customer_agreements agreement
      WHERE agreement.tenant_id=p_tenant_id AND agreement.customer_id=p_customer_id AND agreement.widerrufen_am IS NULL
      FOR UPDATE;
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', agreement.id::text, 'position', agreement.position, 'bezeichnung', agreement.bezeichnung,
      'wert', agreement.wert, 'geld', agreement.geld, 'hinweis', agreement.hinweis,
      'gueltigBis', agreement.gueltig_bis
    ) ORDER BY agreement.position), '[]'::jsonb)
    INTO v_before_agreements
    FROM public.customer_agreements agreement
    WHERE agreement.tenant_id=p_tenant_id AND agreement.customer_id=p_customer_id AND agreement.typ IS NULL
      AND agreement.widerrufen_am IS NULL AND (v_money OR NOT agreement.geld);
    SELECT coalesce(array_agg(agreement.position ORDER BY agreement.position), ARRAY[]::integer[])
    INTO v_used_positions
    FROM public.customer_agreements agreement
    WHERE agreement.tenant_id=p_tenant_id AND agreement.customer_id=p_customer_id AND agreement.widerrufen_am IS NULL
      AND agreement.typ IS NULL AND NOT v_money AND agreement.geld;
    SELECT coalesce(array_agg(agreement.id ORDER BY agreement.position), ARRAY[]::uuid[])
    INTO v_editable_ids
    FROM public.customer_agreements agreement
    WHERE agreement.tenant_id=p_tenant_id AND agreement.customer_id=p_customer_id AND agreement.typ IS NULL
      AND agreement.widerrufen_am IS NULL AND (v_money OR NOT agreement.geld);
    -- The partial unique index covers active free-text rows. Temporarily mark exactly the
    -- editable rows revoked so a full 1..20 list can be reordered without a swap collision.
    UPDATE public.customer_agreements agreement SET widerrufen_am=statement_timestamp(),widerrufen_von=p_actor_id,
      widerruf_grund='wird in Kundenkarte neu sortiert'
    WHERE agreement.tenant_id=p_tenant_id AND agreement.id = ANY(v_editable_ids);
    FOR v_entry IN SELECT value FROM jsonb_array_elements(v_agreements) LOOP
      IF jsonb_typeof(v_entry) IS DISTINCT FROM 'object'
        OR NOT (v_entry ?& ARRAY['id','bezeichnung','wert','geld','hinweis','gueltigBis'])
        OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_entry) key WHERE key <> ALL(ARRAY['id','bezeichnung','wert','geld','hinweis','gueltigBis']))
        OR jsonb_typeof(v_entry->'id') NOT IN ('null','string')
        OR jsonb_typeof(v_entry->'bezeichnung') <> 'string' OR char_length(btrim(v_entry->>'bezeichnung')) NOT BETWEEN 1 AND 40
        OR jsonb_typeof(v_entry->'wert') <> 'string' OR char_length(btrim(v_entry->>'wert')) NOT BETWEEN 1 AND 200
        OR jsonb_typeof(v_entry->'geld') <> 'boolean' OR jsonb_typeof(v_entry->'hinweis') <> 'boolean'
        OR jsonb_typeof(v_entry->'gueltigBis') NOT IN ('null','string')
      THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
      BEGIN
        v_entry_id := CASE WHEN v_entry->>'id' IS NULL THEN NULL ELSE (v_entry->>'id')::uuid END;
        v_valid_until := CASE WHEN v_entry->>'gueltigBis' IS NULL THEN NULL ELSE (v_entry->>'gueltigBis')::date END;
      EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
        RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN;
      END;
      IF v_valid_until IS NOT NULL AND to_char(v_valid_until,'YYYY-MM-DD') <> v_entry->>'gueltigBis' THEN
        RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN;
      END IF;
      IF NOT v_money AND (v_entry->>'geld')::boolean THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
      SELECT candidate::integer INTO v_position FROM generate_series(1,20) candidate
        WHERE candidate <> ALL(v_used_positions) ORDER BY candidate LIMIT 1;
      IF v_position IS NULL THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
      IF v_entry_id IS NULL THEN
        INSERT INTO public.customer_agreements(
          tenant_id,customer_id,position,bezeichnung,wert,geld,hinweis,gueltig_bis,typ,order_id,ziel_tage,grund,client_key,created_by
        ) VALUES (
          p_tenant_id,p_customer_id,v_position,btrim(v_entry->>'bezeichnung'),btrim(v_entry->>'wert'),(v_entry->>'geld')::boolean,
          (v_entry->>'hinweis')::boolean,v_valid_until,NULL,NULL,NULL,NULL,NULL,p_actor_id
        ) RETURNING id INTO v_entry_id;
      ELSE
        v_existing := NULL;
        SELECT * INTO v_existing FROM public.customer_agreements agreement
          WHERE agreement.tenant_id=p_tenant_id AND agreement.id=v_entry_id AND agreement.customer_id=p_customer_id
            AND agreement.typ IS NULL AND agreement.id = ANY(v_editable_ids) FOR UPDATE;
        IF NOT FOUND THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
        IF NOT v_money AND v_existing.geld THEN RETURN QUERY SELECT 'FORBIDDEN'::text,false; RETURN; END IF;
        IF v_entry_id = ANY(v_seen_ids) THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text,false; RETURN; END IF;
        IF (v_existing.position,v_existing.bezeichnung,v_existing.wert,v_existing.geld,v_existing.hinweis,v_existing.gueltig_bis)
          IS DISTINCT FROM (v_position,btrim(v_entry->>'bezeichnung'),btrim(v_entry->>'wert'),(v_entry->>'geld')::boolean,(v_entry->>'hinweis')::boolean,v_valid_until)
        THEN
          UPDATE public.customer_agreements SET position=v_position,bezeichnung=btrim(v_entry->>'bezeichnung'),wert=btrim(v_entry->>'wert'),
            geld=(v_entry->>'geld')::boolean,hinweis=(v_entry->>'hinweis')::boolean,gueltig_bis=v_valid_until,
            widerrufen_am=NULL,widerrufen_von=NULL,widerruf_grund=NULL,version=version+1
          WHERE tenant_id=p_tenant_id AND id=v_entry_id AND version=v_existing.version;
          IF NOT FOUND THEN RETURN QUERY SELECT 'CONFLICT'::text,false; RETURN; END IF;
        ELSE
          UPDATE public.customer_agreements SET widerrufen_am=NULL,widerrufen_von=NULL,widerruf_grund=NULL
          WHERE tenant_id=p_tenant_id AND id=v_entry_id AND version=v_existing.version;
        END IF;
      END IF;
      v_seen_ids := array_append(v_seen_ids,v_entry_id);
      v_used_positions := array_append(v_used_positions,v_position);
    END LOOP;
    UPDATE public.customer_agreements agreement SET widerrufen_am=statement_timestamp(),widerrufen_von=p_actor_id,
      widerruf_grund='aus Kundenkarte entfernt',version=version+1
    WHERE agreement.tenant_id=p_tenant_id AND agreement.id = ANY(v_editable_ids)
      AND NOT (agreement.id = ANY(v_seen_ids));
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', agreement.id::text, 'position', agreement.position, 'bezeichnung', agreement.bezeichnung,
      'wert', agreement.wert, 'geld', agreement.geld, 'hinweis', agreement.hinweis,
      'gueltigBis', agreement.gueltig_bis
    ) ORDER BY agreement.position), '[]'::jsonb)
    INTO v_after_agreements
    FROM public.customer_agreements agreement
    WHERE agreement.tenant_id=p_tenant_id AND agreement.customer_id=p_customer_id AND agreement.typ IS NULL
      AND agreement.widerrufen_am IS NULL AND (v_money OR NOT agreement.geld);
  END IF;
  UPDATE public.customers SET
    name=v_name,type=v_after.type,company_name=v_after.company_name,salutation=v_after.salutation,first_name=v_after.first_name,
    last_name=v_after.last_name,contact_role=v_after.contact_role,phone=v_after.phone,email=v_after.email,billing_email=v_after.billing_email,
    website=v_after.website,street=v_after.street,house_number=v_after.house_number,zip_code=v_after.zip_code,city=v_after.city,country=v_after.country,
    payment_preference=v_after.payment_preference,vat_id=v_after.vat_id,notes=v_after.notes,handover_preference=v_after.handover_preference,
    iban=v_after.iban,zahlungsziel_tage=v_after.zahlungsziel_tage,auto_info=v_after.auto_info,vorrang=v_after.vorrang,address_status=v_after.address_status,
    address_checked_at=CASE WHEN (v_before.country,v_before.zip_code,v_before.city,v_before.street,v_before.house_number)
      IS DISTINCT FROM (v_after.country,v_after.zip_code,v_after.city,v_after.street,v_after.house_number)
      THEN CASE WHEN v_after.address_status IS NULL THEN NULL ELSE statement_timestamp() END ELSE v_before.address_checked_at END,
    customer_number=coalesce(v_before.customer_number,private.allocate_customer_number(p_tenant_id)),updated_at=statement_timestamp()
  WHERE tenant_id=p_tenant_id AND id=p_customer_id;
  SELECT coalesce(max(event.aggregate_version),0)+1 INTO v_version FROM public.events event
    WHERE event.tenant_id=p_tenant_id AND event.event_type='CUSTOMER_UPDATED_V1' AND event.payload->>'customerId'=p_customer_id;
  INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,created_at)
  VALUES(gen_random_uuid()::text,p_tenant_id,'CUSTOMER_UPDATED_V1','Kunde gespeichert',
    jsonb_build_object('customerId',p_customer_id,'intentSha256',p_intent_sha256,'fields',v_customer_fields)
      || CASE WHEN v_agreements_present THEN jsonb_build_object('agreements',jsonb_build_object('before',v_before_agreements,'after',v_after_agreements)) ELSE '{}'::jsonb END,
    'success',p_actor_id,p_client_event_id,1,gen_random_uuid(),v_version,statement_timestamp() AT TIME ZONE 'UTC');
  RETURN QUERY SELECT 'OK'::text,false;
END $$;
REVOKE ALL ON FUNCTION private.update_customer_v1(text,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.update_customer_v1(text,uuid,uuid,text,text,jsonb) TO service_role;
CREATE UNIQUE INDEX events_goods_out_order_version_v3_uidx
  ON public.events (tenant_id, order_id, aggregate_version)
  WHERE event_type = 'ORDER_PICKED_UP_V3';

-- Keep the established read port authoritative after a typed-agreement
-- handover. All legacy columns retain their former meaning; V3 only extends
-- the recognised immutable event family.
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
      (invoice_state.active_invoice_count = 0 AND orders.payment_mode = 'rechnung')
      OR (invoice_state.active_invoice_count = 1 AND payment.goods_out_allowed = true)
    )
  ) AS goods_out_allowed,
  coalesce(
    orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND orders.payment_mode IN ('vorkasse', 'abholung', 'rechnung')
    AND orders.payment_mode_version >= 0
    AND orders.station = orders.current_station
    AND orders.station = orders.current_station_id
    AND orders.station = orders.status
    AND invoice_state.active_invoice_count IN (0, 1)
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
    AND (
      coalesce(goods_out.event_count, 0) = 0
      OR (
        goods_out.event_count = 1
        AND goods_out.event_id IS NOT NULL
        AND goods_out.user_id IS NOT NULL
        AND goods_out.aggregate_version = orders.version
        AND goods_out.payload->>'orderId' = orders.id
        AND goods_out.payload->>'paymentMode' = orders.payment_mode
        AND goods_out.payload->>'orderVersion' = orders.version::text
        AND goods_out.payload->>'mode' IN ('versand', 'abholung')
      )
    )
  , false) AS integrity_ok
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
    event.created_at, event.payload
  FROM public.events event
  WHERE event.tenant_id = orders.tenant_id
    AND event.order_id = orders.id
    AND event.event_type IN ('ORDER_PICKED_UP_V1', 'ORDER_PICKED_UP_V2', 'ORDER_PICKED_UP_V3')
    AND event.status = 'success'
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT 1
) goods_out ON true
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_goods_out_ui_state_v1 IS
  'Q5 plus AP-ABS: tenant-bound goods-out state including typed-agreement V3 receipts.';
