-- APPROVAL REQUIRED - PREPARED, NOT APPLIED BY THIS MISSION.
-- Additive payment reservation, quote binding, callback admission and atomic finalization.
-- No RLS or policy changes. Abort if legacy duplicates exist; reconcile and back up first.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS quote_digest text,
  ADD COLUMN IF NOT EXISTS webhook_token_hash text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE provider_intent_id IS NOT NULL
    GROUP BY provider_intent_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_PREFLIGHT_FAILED: duplicate provider_intent_id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ausgangsrechnung
    WHERE bezahlt_payment_id IS NOT NULL
    GROUP BY bezahlt_payment_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_PREFLIGHT_FAILED: duplicate bezahlt_payment_id';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.payments
    WHERE status IN ('creating', 'pending')
    GROUP BY tenant_id, order_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_PREFLIGHT_FAILED: multiple active attempts per order';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_intent
  ON public.payments(provider_intent_id)
  WHERE provider_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_webhook_token_hash
  ON public.payments(webhook_token_hash)
  WHERE webhook_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_active_order
  ON public.payments(tenant_id, order_id)
  WHERE order_id IS NOT NULL AND status IN ('creating', 'pending');

CREATE UNIQUE INDEX IF NOT EXISTS uq_ausgangsrechnung_payment
  ON public.ausgangsrechnung(bezahlt_payment_id)
  WHERE bezahlt_payment_id IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.ausgangsrechnung_nummer_seq;

-- One canonical quote function owns amount and version truth. The JSONB text is
-- generated and consumed inside Postgres, so JavaScript formatting cannot drift.
CREATE OR REPLACE FUNCTION public.get_mollie_payment_quote(
  p_tenant_id text,
  p_order_id text
)
RETURNS TABLE(amount_eur numeric, amount_cents bigint, quote_digest text, line_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public, pg_temp
AS $$
DECLARE
  v_amount numeric;
  v_amount_cents bigint;
  v_lines jsonb;
  v_line_count integer;
BEGIN
  IF p_tenant_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_QUOTE_CONTEXT';
  END IF;

  PERFORM 1
  FROM public.orders
  WHERE id = p_order_id AND tenant_id = p_tenant_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id || ':' || p_order_id, 0));

  SELECT
    count(*)::integer,
    round(coalesce(sum(coalesce(
      pl.unit_total_eur,
      coalesce(pl.qty, 1) * pl.unit_price_eur
    )), 0), 2),
    coalesce(jsonb_agg(jsonb_build_array(
      pl.id,
      coalesce(pl.qty, 1),
      pl.unit_price_eur,
      coalesce(pl.unit_total_eur, coalesce(pl.qty, 1) * pl.unit_price_eur)
    ) ORDER BY pl.id), '[]'::jsonb)
  INTO v_line_count, v_amount, v_lines
  FROM public.price_lines pl
  WHERE pl.tenant_id = p_tenant_id AND pl.order_id = p_order_id;

  IF v_line_count = 0 OR v_amount <= 0 OR v_amount > 99999999.99 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT';
  END IF;

  v_amount_cents := round(v_amount * 100)::bigint;
  RETURN QUERY SELECT
    v_amount,
    v_amount_cents,
    encode(digest(convert_to(
      jsonb_build_array(p_tenant_id, p_order_id, v_amount_cents, v_lines)::text,
      'UTF8'
    ), 'sha256'), 'hex'),
    v_line_count;
END;
$$;

-- Price changes are not allowed while a provider payment can still be used.
-- This is the database-enforced half of quote locking; terminal state releases it.
CREATE OR REPLACE FUNCTION public.guard_active_mollie_payment_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_old_tenant text;
  v_old_order text;
  v_new_tenant text;
  v_new_order text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old_tenant := OLD.tenant_id;
    v_old_order := OLD.order_id;
    IF EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.tenant_id = v_old_tenant
        AND p.order_id = v_old_order
        AND p.provider = 'mollie'
        AND p.status IN ('creating', 'pending')
    ) THEN
      RAISE EXCEPTION 'ACTIVE_PAYMENT_LOCKS_QUOTE';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_new_tenant := NEW.tenant_id;
    v_new_order := NEW.order_id;
    IF (v_new_tenant, v_new_order) IS DISTINCT FROM (v_old_tenant, v_old_order)
       AND EXISTS (
         SELECT 1 FROM public.payments p
         WHERE p.tenant_id = v_new_tenant
           AND p.order_id = v_new_order
           AND p.provider = 'mollie'
           AND p.status IN ('creating', 'pending')
       ) THEN
      RAISE EXCEPTION 'ACTIVE_PAYMENT_LOCKS_QUOTE';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_active_mollie_payment_quote()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_price_lines_active_mollie_quote ON public.price_lines;
CREATE TRIGGER trg_price_lines_active_mollie_quote
BEFORE INSERT OR UPDATE OR DELETE ON public.price_lines
FOR EACH ROW EXECUTE FUNCTION public.guard_active_mollie_payment_quote();

CREATE OR REPLACE FUNCTION public.reserve_mollie_payment_attempt(
  p_attempt_id uuid,
  p_tenant_id text,
  p_order_id text,
  p_amount_cents bigint,
  p_quote_digest text,
  p_webhook_token_hash text
)
RETURNS TABLE(
  payment_id uuid,
  was_created boolean,
  payment_status text,
  provider_intent_id text,
  reserved_amount_eur numeric,
  reserved_quote_digest text,
  reserved_webhook_token_hash text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_quote_amount numeric;
  v_quote_cents bigint;
  v_quote_digest text;
BEGIN
  IF p_attempt_id IS NULL
     OR p_amount_cents <= 0
     OR p_quote_digest !~ '^[a-f0-9]{64}$'
     OR p_webhook_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_RESERVATION';
  END IF;

  SELECT q.amount_eur, q.amount_cents, q.quote_digest
  INTO v_quote_amount, v_quote_cents, v_quote_digest
  FROM public.get_mollie_payment_quote(p_tenant_id, p_order_id) q;

  IF v_quote_cents <> p_amount_cents OR v_quote_digest <> p_quote_digest THEN
    RAISE EXCEPTION 'PAYMENT_QUOTE_CHANGED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.tenant_id = p_tenant_id
      AND p.order_id = p_order_id
      AND p.provider = 'mollie'
      AND p.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'PAYMENT_ALREADY_COMPLETED';
  END IF;

  SELECT p.* INTO v_payment
  FROM public.payments p
  WHERE p.tenant_id = p_tenant_id
    AND p.order_id = p_order_id
    AND p.provider = 'mollie'
    AND p.status IN ('creating', 'pending')
  ORDER BY p.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_payment.id,
      false,
      v_payment.status,
      v_payment.provider_intent_id,
      v_payment.amount_eur,
      v_payment.quote_digest,
      v_payment.webhook_token_hash,
      v_payment.created_at;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.payments (
      id, tenant_id, order_id, amount_eur, status, provider,
      quote_digest, webhook_token_hash, created_at, updated_at
    ) VALUES (
      p_attempt_id, p_tenant_id, p_order_id, v_quote_amount, 'creating', 'mollie',
      p_quote_digest, p_webhook_token_hash, now(), now()
    ) RETURNING * INTO v_payment;
  EXCEPTION WHEN unique_violation THEN
    SELECT p.* INTO v_payment
    FROM public.payments p
    WHERE p.tenant_id = p_tenant_id
      AND p.order_id = p_order_id
      AND p.provider = 'mollie'
      AND p.status IN ('creating', 'pending')
    ORDER BY p.created_at DESC
    LIMIT 1
    FOR UPDATE;
    IF NOT FOUND THEN RAISE; END IF;
    RETURN QUERY SELECT
      v_payment.id,
      false,
      v_payment.status,
      v_payment.provider_intent_id,
      v_payment.amount_eur,
      v_payment.quote_digest,
      v_payment.webhook_token_hash,
      v_payment.created_at;
    RETURN;
  END;

  RETURN QUERY SELECT
    v_payment.id,
    true,
    v_payment.status,
    v_payment.provider_intent_id,
    v_payment.amount_eur,
    v_payment.quote_digest,
    v_payment.webhook_token_hash,
    v_payment.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.bind_mollie_payment_provider(
  p_payment_id uuid,
  p_provider_intent_id text,
  p_provider_status text,
  p_expected_amount_cents bigint,
  p_expected_quote_digest text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
BEGIN
  IF p_provider_intent_id !~ '^tr_[A-Za-z0-9]{1,64}$'
     OR p_provider_status !~ '^[a-z_]{1,64}$'
     OR p_expected_quote_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_BINDING';
  END IF;

  SELECT p.* INTO v_payment
  FROM public.payments p
  WHERE p.id = p_payment_id AND p.provider = 'mollie'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;

  IF round(v_payment.amount_eur * 100)::bigint <> p_expected_amount_cents
     OR v_payment.quote_digest <> p_expected_quote_digest THEN
    RAISE EXCEPTION 'PAYMENT_TRUTH_MISMATCH';
  END IF;

  IF v_payment.status = 'pending'
     AND v_payment.provider_intent_id = p_provider_intent_id THEN
    RETURN true;
  END IF;
  IF v_payment.status <> 'creating' OR v_payment.provider_intent_id IS NOT NULL THEN
    RAISE EXCEPTION 'PAYMENT_STATE_LOCKED';
  END IF;

  UPDATE public.payments
  SET provider_intent_id = p_provider_intent_id,
      status = 'pending',
      mollie_status = p_provider_status,
      updated_at = now()
  WHERE id = v_payment.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_mollie_payment_state(
  p_payment_id uuid,
  p_provider_intent_id text,
  p_provider_status text,
  p_target_status text
)
RETURNS TABLE(changed boolean, payment_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_event_type text;
BEGIN
  IF p_target_status NOT IN ('pending', 'failed', 'review_required')
     OR p_provider_status !~ '^[a-z_]{1,64}$' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATE';
  END IF;

  SELECT p.* INTO v_payment
  FROM public.payments p
  WHERE p.id = p_payment_id AND p.provider = 'mollie'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;

  IF v_payment.provider_intent_id IS NOT NULL
     AND v_payment.provider_intent_id IS DISTINCT FROM p_provider_intent_id THEN
    RAISE EXCEPTION 'PAYMENT_PROVIDER_MISMATCH';
  END IF;

  IF v_payment.status IN ('completed', 'review_required')
     OR (v_payment.status = 'failed' AND p_target_status <> 'review_required') THEN
    RETURN QUERY SELECT false, v_payment.status;
    RETURN;
  END IF;

  IF p_target_status = 'pending'
     AND (v_payment.status NOT IN ('creating', 'pending') OR v_payment.provider_intent_id IS NULL) THEN
    RAISE EXCEPTION 'PAYMENT_STATE_LOCKED';
  END IF;

  UPDATE public.payments
  SET status = p_target_status,
      mollie_status = p_provider_status,
      updated_at = now()
  WHERE id = v_payment.id;

  IF p_target_status IN ('failed', 'review_required') THEN
    v_event_type := CASE
      WHEN p_target_status = 'failed' THEN 'PAYMENT_FAILED'
      ELSE 'PAYMENT_REVIEW_REQUIRED'
    END;
    INSERT INTO public.events (
      id, tenant_id, order_id, event_type, description, payload, status, created_at
    ) VALUES (
      'payment_' || replace(v_payment.id::text, '-', '') || '_' || p_target_status,
      v_payment.tenant_id,
      v_payment.order_id,
      v_event_type,
      CASE
        WHEN p_target_status = 'failed' THEN 'Mollie-Zahlung beendet'
        ELSE 'Mollie-Zahlung muss manuell geprüft werden'
      END,
      jsonb_build_object(
        'paymentId', v_payment.id,
        'providerIntentId', v_payment.provider_intent_id,
        'providerStatus', p_provider_status
      ),
      CASE WHEN p_target_status = 'failed' THEN 'success' ELSE 'warning' END,
      now()
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT true, p_target_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_mollie_payment(
  p_provider_intent_id text,
  p_status text,
  p_method text,
  p_paid_at timestamptz,
  p_expected_order_id text,
  p_expected_tenant_id text,
  p_expected_amount_cents bigint,
  p_expected_quote_digest text
)
RETURNS TABLE(created boolean, invoice_id uuid, order_id text, customer_id text, amount_eur numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_customer_id text;
  v_existing_invoice uuid;
  v_invoice_id uuid;
  v_number text;
  v_current_amount numeric;
  v_current_cents bigint;
  v_current_digest text;
BEGIN
  IF p_status <> 'paid' OR p_paid_at IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_NOT_PAID';
  END IF;

  SELECT p.* INTO v_payment
  FROM public.payments p
  WHERE p.provider_intent_id = p_provider_intent_id
  FOR UPDATE;

  IF NOT FOUND OR v_payment.provider <> 'mollie' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;
  IF v_payment.tenant_id <> p_expected_tenant_id
     OR v_payment.order_id IS DISTINCT FROM p_expected_order_id
     OR round(v_payment.amount_eur * 100)::bigint <> p_expected_amount_cents
     OR v_payment.quote_digest IS DISTINCT FROM p_expected_quote_digest THEN
    RAISE EXCEPTION 'PAYMENT_TRUTH_MISMATCH';
  END IF;
  IF v_payment.status IN ('failed', 'review_required') THEN
    RAISE EXCEPTION 'PAYMENT_STATE_LOCKED';
  END IF;

  SELECT q.amount_eur, q.amount_cents, q.quote_digest
  INTO v_current_amount, v_current_cents, v_current_digest
  FROM public.get_mollie_payment_quote(v_payment.tenant_id, v_payment.order_id) q;

  IF v_current_cents <> p_expected_amount_cents
     OR v_current_digest <> p_expected_quote_digest
     OR round(v_current_amount, 2) <> round(v_payment.amount_eur, 2) THEN
    RAISE EXCEPTION 'PAYMENT_QUOTE_STALE';
  END IF;

  SELECT o.customer_id INTO v_customer_id
  FROM public.orders o
  WHERE o.id = v_payment.order_id AND o.tenant_id = v_payment.tenant_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  SELECT ar.id INTO v_existing_invoice
  FROM public.ausgangsrechnung ar
  WHERE ar.bezahlt_payment_id = v_payment.id;
  IF FOUND THEN
    UPDATE public.payments
    SET status = 'completed', mollie_status = p_status, mollie_method = p_method,
        updated_at = now()
    WHERE id = v_payment.id;
    RETURN QUERY SELECT false, v_existing_invoice, v_payment.order_id, v_customer_id, v_payment.amount_eur;
    RETURN;
  END IF;

  UPDATE public.payments
  SET status = 'completed', mollie_status = p_status, mollie_method = p_method,
      updated_at = now()
  WHERE id = v_payment.id;

  v_number := format(
    'RE-%s-%s',
    extract(year FROM p_paid_at)::integer,
    lpad(nextval('public.ausgangsrechnung_nummer_seq')::text, 6, '0')
  );

  INSERT INTO public.ausgangsrechnung (
    nummer, kunde_id, datum, brutto, bezahlt_am, bezahlt_methode,
    bezahlt_betrag_eur, bezahlt_payment_id, status, order_id, tenant_id
  ) VALUES (
    v_number, v_customer_id, p_paid_at::date, v_payment.amount_eur, p_paid_at::date,
    p_method, v_payment.amount_eur, v_payment.id, 'bezahlt', v_payment.order_id,
    v_payment.tenant_id
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO public.events (
    id, tenant_id, order_id, event_type, description, payload, status, created_at
  ) VALUES (
    'payment_' || replace(v_payment.id::text, '-', '') || '_paid',
    v_payment.tenant_id,
    v_payment.order_id,
    'PAYMENT_PAID',
    'Mollie-Zahlung bestätigt und Rechnung verknüpft',
    jsonb_build_object(
      'paymentId', v_payment.id,
      'providerIntentId', v_payment.provider_intent_id,
      'invoiceId', v_invoice_id,
      'amountEur', v_payment.amount_eur,
      'quoteDigest', v_payment.quote_digest
    ),
    'success',
    p_paid_at
  ) ON CONFLICT (id) DO NOTHING;

  RETURN QUERY SELECT true, v_invoice_id, v_payment.order_id, v_customer_id, v_payment.amount_eur;
END;
$$;

REVOKE ALL ON FUNCTION public.get_mollie_payment_quote(text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reserve_mollie_payment_attempt(uuid,text,text,bigint,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.bind_mollie_payment_provider(uuid,text,text,bigint,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_mollie_payment_state(uuid,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finalize_mollie_payment(text,text,text,timestamptz,text,text,bigint,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_mollie_payment_quote(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_mollie_payment_attempt(uuid,text,text,bigint,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bind_mollie_payment_provider(uuid,text,text,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_mollie_payment_state(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_mollie_payment(text,text,text,timestamptz,text,text,bigint,text) TO service_role;

COMMIT;
