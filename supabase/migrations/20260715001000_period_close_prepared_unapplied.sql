-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Atomic, idempotent period closing with server-only mutation and immutable final-period records.

CREATE UNIQUE INDEX IF NOT EXISTS periode_tenant_year_month_uidx
  ON public.periode (tenant_id, jahr, monat);

ALTER TABLE public.bh_audit_log
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  ADD COLUMN IF NOT EXISTS request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS bh_audit_log_tenant_request_uidx
  ON public.bh_audit_log (tenant_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_final_finance_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  old_period_id uuid;
  new_period_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_period_id := OLD.periode_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_period_id := NEW.periode_id; END IF;

  IF old_period_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.periode p
    WHERE p.id = old_period_id
      AND p.tenant_id = 'galvanik-kreile'
      AND p.status = 'final_geschlossen'
  ) THEN
    RAISE EXCEPTION 'FINAL_PERIOD_IMMUTABLE' USING ERRCODE = '55000';
  END IF;

  IF new_period_id IS NOT NULL AND new_period_id IS DISTINCT FROM old_period_id AND EXISTS (
    SELECT 1 FROM public.periode p
    WHERE p.id = new_period_id
      AND p.tenant_id = 'galvanik-kreile'
      AND p.status = 'final_geschlossen'
  ) THEN
    RAISE EXCEPTION 'FINAL_PERIOD_IMMUTABLE' USING ERRCODE = '55000';
  END IF;

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
  blocker_count integer;
BEGIN
  IF p_period_id IS NULL OR p_actor IS NULL OR p_request_id IS NULL OR
     p_target_status NOT IN ('vorlaeufig_geschlossen', 'final_geschlossen') THEN
    RAISE EXCEPTION 'INVALID_PERIOD_CLOSE_REQUEST' USING ERRCODE = '22023';
  END IF;

  SELECT a.aktion, a.entitaet_id
    INTO existing_action, existing_entity
  FROM public.bh_audit_log a
  WHERE a.tenant_id = 'galvanik-kreile' AND a.request_id = p_request_id;

  IF FOUND THEN
    IF existing_entity <> p_period_id OR existing_action <> 'period_close:' || p_target_status THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSE' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY
      SELECT p.id, p.status, p.geschlossen_am AT TIME ZONE 'UTC', true
      FROM public.periode p
      WHERE p.id = p_period_id AND p.tenant_id = 'galvanik-kreile';
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
      jsonb_build_object('status', current_period.status, 'replayed_existing_state', true)
    );
    RETURN QUERY SELECT current_period.id, current_period.status,
      current_period.geschlossen_am AT TIME ZONE 'UTC', true;
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
    (SELECT count(*) FROM public.orders o
      WHERE o.tenant_id = current_period.tenant_id
        AND o.completed_date >= make_date(current_period.jahr, current_period.monat, 1)
        AND o.completed_date < (make_date(current_period.jahr, current_period.monat, 1) + interval '1 month')
        AND o.db_ist IS NULL
        AND o.status <> 'storniert')
  INTO blocker_count;

  IF blocker_count > 0 THEN
    RAISE EXCEPTION 'PERIOD_CLOSE_BLOCKED:%', blocker_count USING ERRCODE = '55000';
  END IF;

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
    jsonb_build_object('status', CASE WHEN p_target_status = 'final_geschlossen' THEN 'vorlaeufig_geschlossen' ELSE 'offen' END),
    jsonb_build_object('status', current_period.status, 'geschlossen_am', current_period.geschlossen_am)
  );

  RETURN QUERY SELECT current_period.id, current_period.status,
    current_period.geschlossen_am AT TIME ZONE 'UTC', false;
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
     NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ausgangsrechnung_final_period_guard' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Final-period immutability guards are missing';
  END IF;
END
$verification$;
