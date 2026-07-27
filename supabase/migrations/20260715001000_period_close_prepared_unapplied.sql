-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Atomic, idempotent period closing with server-only mutation and immutable final-period records.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

CREATE UNIQUE INDEX IF NOT EXISTS periode_tenant_year_month_uidx
  ON public.periode (tenant_id, jahr, monat);

ALTER TABLE public.bh_audit_log
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  ADD COLUMN IF NOT EXISTS request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS bh_audit_log_tenant_request_uidx
  ON public.bh_audit_log (tenant_id, request_id)
  WHERE request_id IS NOT NULL;

DO $period_relationships$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.periode
    WHERE monat NOT BETWEEN 1 AND 12
       OR status NOT IN ('offen', 'vorlaeufig_geschlossen', 'final_geschlossen')
       OR (
         status IN ('vorlaeufig_geschlossen', 'final_geschlossen')
         AND geschlossen_am IS NULL
       )
  ) THEN
    RAISE EXCEPTION
      'PERIOD_RELATIONSHIP_RECONCILIATION_REQUIRED: invalid period state';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.beleg receipt
    LEFT JOIN public.periode period ON period.id = receipt.periode_id
    WHERE receipt.periode_id IS NOT NULL AND period.id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.ausgangsrechnung invoice
    LEFT JOIN public.periode period ON period.id = invoice.periode_id
    WHERE invoice.periode_id IS NOT NULL AND period.id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.ausgangsrechnung invoice
    JOIN public.periode period ON period.id = invoice.periode_id
    WHERE invoice.tenant_id IS DISTINCT FROM period.tenant_id
  ) THEN
    RAISE EXCEPTION
      'PERIOD_RELATIONSHIP_RECONCILIATION_REQUIRED: finance rows reference an unknown or foreign period';
  END IF;

  ALTER TABLE public.beleg
    DROP CONSTRAINT IF EXISTS beleg_periode_id_fkey,
    ADD CONSTRAINT beleg_periode_id_fkey
      FOREIGN KEY (periode_id) REFERENCES public.periode(id) ON DELETE RESTRICT NOT VALID;
  ALTER TABLE public.beleg VALIDATE CONSTRAINT beleg_periode_id_fkey;

  ALTER TABLE public.ausgangsrechnung
    DROP CONSTRAINT IF EXISTS ausgangsrechnung_periode_id_fkey,
    ADD CONSTRAINT ausgangsrechnung_periode_id_fkey
      FOREIGN KEY (periode_id) REFERENCES public.periode(id) ON DELETE RESTRICT NOT VALID;
  ALTER TABLE public.ausgangsrechnung
    VALIDATE CONSTRAINT ausgangsrechnung_periode_id_fkey;
END
$period_relationships$;

CREATE OR REPLACE FUNCTION public.guard_final_finance_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_old_period_id uuid;
  v_new_period_id uuid;
  v_old_date_period_id uuid;
  v_new_date_period_id uuid;
  v_old_parent_id uuid;
  v_new_parent_id uuid;
  v_period record;
  v_period_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'beleg' THEN
      IF TG_OP <> 'INSERT' THEN
        v_period_ids := array_append(v_period_ids, OLD.periode_id);
        IF OLD.belegdatum IS NOT NULL THEN
          SELECT period.id
          INTO v_old_date_period_id
          FROM public.periode period
          WHERE period.tenant_id = 'galvanik-kreile'
            AND make_date(period.jahr, period.monat, 1)
              = date_trunc('month', OLD.belegdatum)::date;
          v_period_ids := array_append(v_period_ids, v_old_date_period_id);
        END IF;
      END IF;
      IF TG_OP <> 'DELETE' THEN
        v_period_ids := array_append(v_period_ids, NEW.periode_id);
        IF NEW.belegdatum IS NOT NULL THEN
          SELECT period.id
          INTO v_new_date_period_id
          FROM public.periode period
          WHERE period.tenant_id = 'galvanik-kreile'
            AND make_date(period.jahr, period.monat, 1)
              = date_trunc('month', NEW.belegdatum)::date;
          v_period_ids := array_append(v_period_ids, v_new_date_period_id);
        END IF;
      END IF;

    WHEN 'ausgangsrechnung' THEN
      IF TG_OP <> 'INSERT' THEN
        v_period_ids := array_append(v_period_ids, OLD.periode_id);
        SELECT period.id
        INTO v_old_date_period_id
        FROM public.periode period
        WHERE period.tenant_id = OLD.tenant_id
          AND make_date(period.jahr, period.monat, 1)
            = date_trunc('month', OLD.datum)::date;
        v_period_ids := array_append(v_period_ids, v_old_date_period_id);
      END IF;
      IF TG_OP <> 'DELETE' THEN
        v_period_ids := array_append(v_period_ids, NEW.periode_id);
        SELECT period.id
        INTO v_new_date_period_id
        FROM public.periode period
        WHERE period.tenant_id = NEW.tenant_id
          AND make_date(period.jahr, period.monat, 1)
            = date_trunc('month', NEW.datum)::date;
        v_period_ids := array_append(v_period_ids, v_new_date_period_id);
      END IF;

    WHEN 'beleg_position', 'kraftstoff_detail' THEN
      IF TG_OP <> 'INSERT' THEN v_old_parent_id := OLD.beleg_id; END IF;
      IF TG_OP <> 'DELETE' THEN v_new_parent_id := NEW.beleg_id; END IF;

      SELECT receipt.periode_id, period.id
      INTO v_old_period_id, v_old_date_period_id
      FROM public.beleg receipt
      LEFT JOIN public.periode period
        ON period.tenant_id = 'galvanik-kreile'
       AND make_date(period.jahr, period.monat, 1)
         = date_trunc('month', receipt.belegdatum)::date
      WHERE receipt.id = v_old_parent_id;

      SELECT receipt.periode_id, period.id
      INTO v_new_period_id, v_new_date_period_id
      FROM public.beleg receipt
      LEFT JOIN public.periode period
        ON period.tenant_id = 'galvanik-kreile'
       AND make_date(period.jahr, period.monat, 1)
         = date_trunc('month', receipt.belegdatum)::date
      WHERE receipt.id = v_new_parent_id;

      v_period_ids := array_append(v_period_ids, v_old_period_id);
      v_period_ids := array_append(v_period_ids, v_old_date_period_id);
      v_period_ids := array_append(v_period_ids, v_new_period_id);
      v_period_ids := array_append(v_period_ids, v_new_date_period_id);

    WHEN 'ausgangsrechnung_position' THEN
      IF TG_OP <> 'INSERT' THEN v_old_parent_id := OLD.ausgangsrechnung_id; END IF;
      IF TG_OP <> 'DELETE' THEN v_new_parent_id := NEW.ausgangsrechnung_id; END IF;

      SELECT invoice.periode_id, period.id
      INTO v_old_period_id, v_old_date_period_id
      FROM public.ausgangsrechnung invoice
      LEFT JOIN public.periode period
        ON period.tenant_id = invoice.tenant_id
       AND make_date(period.jahr, period.monat, 1)
         = date_trunc('month', invoice.datum)::date
      WHERE invoice.id = v_old_parent_id;

      SELECT invoice.periode_id, period.id
      INTO v_new_period_id, v_new_date_period_id
      FROM public.ausgangsrechnung invoice
      LEFT JOIN public.periode period
        ON period.tenant_id = invoice.tenant_id
       AND make_date(period.jahr, period.monat, 1)
         = date_trunc('month', invoice.datum)::date
      WHERE invoice.id = v_new_parent_id;

      v_period_ids := array_append(v_period_ids, v_old_period_id);
      v_period_ids := array_append(v_period_ids, v_old_date_period_id);
      v_period_ids := array_append(v_period_ids, v_new_period_id);
      v_period_ids := array_append(v_period_ids, v_new_date_period_id);

    WHEN 'orders' THEN
      IF TG_OP <> 'INSERT' AND OLD.completed_date IS NOT NULL THEN
        SELECT period.id
        INTO v_old_period_id
        FROM public.periode period
        WHERE period.tenant_id = OLD.tenant_id
          AND make_date(period.jahr, period.monat, 1) = date_trunc(
            'month',
            OLD.completed_date AT TIME ZONE 'Europe/Berlin'
          )::date;
        v_period_ids := array_append(v_period_ids, v_old_period_id);
      END IF;

      IF TG_OP <> 'DELETE' AND NEW.completed_date IS NOT NULL THEN
        SELECT period.id
        INTO v_new_period_id
        FROM public.periode period
        WHERE period.tenant_id = NEW.tenant_id
          AND make_date(period.jahr, period.monat, 1) = date_trunc(
            'month',
            NEW.completed_date AT TIME ZONE 'Europe/Berlin'
          )::date;
        v_period_ids := array_append(v_period_ids, v_new_period_id);
      END IF;

    ELSE
      RAISE EXCEPTION 'UNSUPPORTED_FINANCE_PERIOD_GUARD_TARGET:%', TG_TABLE_NAME;
  END CASE;

  -- A writer locks every affected period before it mutates finance evidence.
  -- finance_close_period takes FOR UPDATE on the same row, so either the write
  -- finishes before the close checks run or it observes the final state and fails.
  FOR v_period IN
    SELECT period.id, period.status
    FROM public.periode period
    WHERE period.id = ANY(v_period_ids)
    ORDER BY period.id
    FOR SHARE
  LOOP
    IF v_period.status = 'final_geschlossen' THEN
      IF TG_TABLE_NAME = 'ausgangsrechnung' AND TG_OP = 'UPDATE' THEN
        IF (
          to_jsonb(OLD) - ARRAY[
            'bezahlt_am',
            'bezahlt_methode',
            'bezahlt_betrag_eur',
            'bezahlt_payment_id',
            'status'
          ]::text[]
        ) IS DISTINCT FROM (
          to_jsonb(NEW) - ARRAY[
            'bezahlt_am',
            'bezahlt_methode',
            'bezahlt_betrag_eur',
            'bezahlt_payment_id',
            'status'
          ]::text[]
        )
        OR (
          OLD.status IS DISTINCT FROM NEW.status
          AND NOT (
            OLD.status IN (
              'offen',
              'teilbezahlt',
              'ueberfaellig',
              'gemahnt',
              'mahnung'
            )
            AND NEW.status IN ('teilbezahlt', 'bezahlt')
          )
        )
        OR (
          OLD.bezahlt_am IS NOT NULL
          AND NEW.bezahlt_am IS DISTINCT FROM OLD.bezahlt_am
        )
        OR (
          OLD.bezahlt_methode IS NOT NULL
          AND NEW.bezahlt_methode IS DISTINCT FROM OLD.bezahlt_methode
        )
        OR (
          OLD.bezahlt_payment_id IS NOT NULL
          AND NEW.bezahlt_payment_id IS DISTINCT FROM OLD.bezahlt_payment_id
        )
        OR coalesce(NEW.bezahlt_betrag_eur, 0) < coalesce(OLD.bezahlt_betrag_eur, 0)
        OR coalesce(NEW.bezahlt_betrag_eur, 0) < 0
        OR coalesce(NEW.bezahlt_betrag_eur, 0) > NEW.brutto
        OR (
          (
            NEW.bezahlt_am IS NOT NULL
            OR NEW.bezahlt_methode IS NOT NULL
            OR NEW.bezahlt_payment_id IS NOT NULL
          )
          AND coalesce(NEW.bezahlt_betrag_eur, 0) <= 0
        )
        OR (
          coalesce(NEW.bezahlt_betrag_eur, 0) > 0
          AND coalesce(NEW.bezahlt_betrag_eur, 0) < NEW.brutto
          AND NEW.status IS DISTINCT FROM 'teilbezahlt'
        )
        OR (
          coalesce(NEW.bezahlt_betrag_eur, 0) >= NEW.brutto
          AND NEW.status IS DISTINCT FROM 'bezahlt'
        )
        OR (
          NEW.status = 'bezahlt'
          AND (
            NEW.bezahlt_am IS NULL
            OR coalesce(NEW.bezahlt_betrag_eur, 0) < NEW.brutto
          )
        )
        OR (
          NEW.bezahlt_payment_id IS NOT NULL
          AND NEW.status IS DISTINCT FROM 'bezahlt'
        ) THEN
          RAISE EXCEPTION 'FINAL_PERIOD_IMMUTABLE' USING ERRCODE = '55000';
        END IF;
      ELSE
        RAISE EXCEPTION 'FINAL_PERIOD_IMMUTABLE' USING ERRCODE = '55000';
      END IF;
    END IF;
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$function$;

DROP TRIGGER IF EXISTS beleg_final_period_guard ON public.beleg;
CREATE TRIGGER beleg_final_period_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.beleg
  FOR EACH ROW EXECUTE FUNCTION public.guard_final_finance_period();

DROP TRIGGER IF EXISTS ausgangsrechnung_final_period_guard ON public.ausgangsrechnung;
CREATE TRIGGER ausgangsrechnung_final_period_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.ausgangsrechnung
  FOR EACH ROW EXECUTE FUNCTION public.guard_final_finance_period();

DROP TRIGGER IF EXISTS beleg_position_final_period_guard ON public.beleg_position;
CREATE TRIGGER beleg_position_final_period_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.beleg_position
  FOR EACH ROW EXECUTE FUNCTION public.guard_final_finance_period();

DROP TRIGGER IF EXISTS kraftstoff_detail_final_period_guard ON public.kraftstoff_detail;
CREATE TRIGGER kraftstoff_detail_final_period_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.kraftstoff_detail
  FOR EACH ROW EXECUTE FUNCTION public.guard_final_finance_period();

DROP TRIGGER IF EXISTS ausgangsrechnung_position_final_period_guard
  ON public.ausgangsrechnung_position;
CREATE TRIGGER ausgangsrechnung_position_final_period_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.ausgangsrechnung_position
  FOR EACH ROW EXECUTE FUNCTION public.guard_final_finance_period();

DROP TRIGGER IF EXISTS orders_final_finance_period_guard ON public.orders;
CREATE TRIGGER orders_final_finance_period_guard
  BEFORE INSERT OR DELETE OR UPDATE OF tenant_id, completed_date, db_ist, status
  ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_final_finance_period();

CREATE OR REPLACE FUNCTION public.finance_close_period(
  p_period_id uuid,
  p_target_status text,
  p_actor uuid,
  p_request_id uuid
)
RETURNS TABLE (id uuid, status text, closed_at timestamptz, replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  current_period public.periode%ROWTYPE;
  existing_action text;
  existing_entity uuid;
  existing_actor uuid;
  existing_entity_type text;
  existing_after jsonb;
  blocker_count integer;
  previous_status text;
BEGIN
  IF p_period_id IS NULL OR p_actor IS NULL OR p_request_id IS NULL OR
     p_target_status NOT IN ('vorlaeufig_geschlossen', 'final_geschlossen') THEN
    RAISE EXCEPTION 'INVALID_PERIOD_CLOSE_REQUEST' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('finance-close:galvanik-kreile:' || p_request_id::text, 0)
  );

  SELECT a.aktion, a.entitaet_id, a.benutzer, a.entitaet, a.nachher
    INTO existing_action, existing_entity, existing_actor, existing_entity_type, existing_after
  FROM public.bh_audit_log a
  WHERE a.tenant_id = 'galvanik-kreile' AND a.request_id = p_request_id;

  IF FOUND THEN
    IF existing_entity <> p_period_id
       OR existing_actor <> p_actor
       OR existing_entity_type <> 'periode'
       OR existing_action <> 'period_close:' || p_target_status THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSE' USING ERRCODE = '23505';
    END IF;
    IF existing_after->>'status' IS DISTINCT FROM p_target_status
       OR nullif(existing_after->>'geschlossen_am', '') IS NULL THEN
      RAISE EXCEPTION 'PERIOD_CLOSE_RECEIPT_INVALID' USING ERRCODE = '55000';
    END IF;
    RETURN QUERY SELECT
      existing_entity,
      existing_after->>'status',
      (existing_after->>'geschlossen_am')::timestamptz,
      true;
    RETURN;
  END IF;

  SELECT p.* INTO current_period
  FROM public.periode p
  WHERE p.id = p_period_id AND p.tenant_id = 'galvanik-kreile'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PERIOD_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  IF current_period.status = p_target_status THEN
    INSERT INTO public.bh_audit_log (
      tenant_id, request_id, benutzer, entitaet, entitaet_id, aktion, vorher, nachher
    ) VALUES (
      'galvanik-kreile', p_request_id, p_actor, 'periode', current_period.id,
      'period_close:' || p_target_status,
      jsonb_build_object('status', current_period.status),
      jsonb_build_object(
        'status', current_period.status,
        'geschlossen_am', current_period.geschlossen_am,
        'existing_state_confirmed', true
      )
    );
    RETURN QUERY SELECT current_period.id, current_period.status,
      current_period.geschlossen_am, false;
    RETURN;
  END IF;

  IF (p_target_status = 'vorlaeufig_geschlossen' AND current_period.status <> 'offen') OR
     (p_target_status = 'final_geschlossen' AND current_period.status <> 'vorlaeufig_geschlossen') THEN
    RAISE EXCEPTION 'INVALID_PERIOD_TRANSITION' USING ERRCODE = '55000';
  END IF;

  SELECT
    (SELECT count(*) FROM public.beleg b
      WHERE b.periode_id = current_period.id AND b.konto_id IS NULL AND b.status <> 'storniert') +
    (SELECT count(*) FROM public.beleg b
      WHERE b.periode_id = current_period.id AND b.kostenstelle_id IS NULL AND b.status <> 'storniert') +
    (SELECT count(*) FROM public.ausgangsrechnung r
      WHERE r.periode_id = current_period.id AND r.order_id IS NULL AND r.status <> 'storniert') +
    (SELECT count(*) FROM public.beleg b
      WHERE b.periode_id IS NULL
        AND b.belegdatum >= make_date(current_period.jahr, current_period.monat, 1)
        AND b.belegdatum < (make_date(current_period.jahr, current_period.monat, 1) + interval '1 month')
        AND b.status <> 'storniert') +
    (SELECT count(*) FROM public.ausgangsrechnung r
      WHERE r.tenant_id = current_period.tenant_id
        AND r.periode_id IS NULL
        AND r.datum >= make_date(current_period.jahr, current_period.monat, 1)
        AND r.datum < (make_date(current_period.jahr, current_period.monat, 1) + interval '1 month')
        AND r.status <> 'storniert') +
    (SELECT count(*) FROM public.orders o
      WHERE o.tenant_id = current_period.tenant_id
        AND date_trunc(
          'month',
          o.completed_date AT TIME ZONE 'Europe/Berlin'
        )::date = make_date(current_period.jahr, current_period.monat, 1)
        AND o.db_ist IS NULL
        AND o.status NOT IN ('cancelled', 'storniert'))
  INTO blocker_count;

  IF blocker_count > 0 THEN
    RAISE EXCEPTION 'PERIOD_CLOSE_BLOCKED:%', blocker_count USING ERRCODE = '55000';
  END IF;

  previous_status := current_period.status;

  UPDATE public.periode p
  SET status = p_target_status,
      geschlossen_am = clock_timestamp(),
      geschlossen_von = p_actor
  WHERE p.id = current_period.id
    AND p.tenant_id = current_period.tenant_id
    AND p.status = current_period.status
  RETURNING p.* INTO current_period;

  IF NOT FOUND THEN RAISE EXCEPTION 'PERIOD_STATE_CHANGED' USING ERRCODE = '40001'; END IF;

  INSERT INTO public.bh_audit_log (
    tenant_id, request_id, benutzer, entitaet, entitaet_id, aktion, vorher, nachher
  ) VALUES (
    current_period.tenant_id, p_request_id, p_actor, 'periode', current_period.id,
    'period_close:' || p_target_status,
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', current_period.status, 'geschlossen_am', current_period.geschlossen_am)
  );

  RETURN QUERY SELECT current_period.id, current_period.status,
    current_period.geschlossen_am, false;
END
$function$;

ALTER TABLE public.periode ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periode FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.periode FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.periode TO service_role;

REVOKE ALL ON FUNCTION public.finance_close_period(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_close_period(uuid, text, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.guard_final_finance_period() FROM PUBLIC, anon, authenticated, service_role;

DO $verification$
BEGIN
  IF has_table_privilege('authenticated', 'public.periode', 'SELECT') OR
     has_table_privilege('service_role', 'public.periode', 'UPDATE') THEN
    RAISE EXCEPTION 'Period table permissions are broader than the server-only contract';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.finance_close_period(uuid,text,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Service role cannot execute the period close function';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'beleg_final_period_guard' AND NOT tgisinternal) OR
     NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ausgangsrechnung_final_period_guard' AND NOT tgisinternal) OR
     NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'beleg_position_final_period_guard' AND NOT tgisinternal) OR
     NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'kraftstoff_detail_final_period_guard' AND NOT tgisinternal) OR
     NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ausgangsrechnung_position_final_period_guard' AND NOT tgisinternal) OR
     NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_final_finance_period_guard' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Final-period immutability guards are missing';
  END IF;
END
$verification$;
