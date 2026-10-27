-- F1: one server-side intake draft per login, private to tenant and actor.
CREATE TABLE IF NOT EXISTS private.intake_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.app_users(id),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'discarded')),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (tenant_id, actor_id),
  CHECK (jsonb_typeof(payload) = 'object')
);

REVOKE ALL ON TABLE private.intake_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE private.intake_drafts TO service_role;

COMMENT ON TABLE private.intake_drafts IS
  'F1 intake/customer drafts; exactly one row per tenant login, never visible to another login.';

CREATE OR REPLACE FUNCTION private.update_customer_note_v1(
  p_tenant_id text,
  p_actor_id uuid,
  p_client_event_id uuid,
  p_customer_id text,
  p_note text
)
RETURNS TABLE(result_code text, replayed boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_prior public.events%ROWTYPE;
  v_note_sha text := encode(extensions.digest(convert_to(coalesce(p_note, ''), 'UTF8'), 'sha256'), 'hex');
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
    OR p_actor_id IS NULL OR p_client_event_id IS NULL OR p_customer_id IS NULL
    OR p_note IS NULL OR p_note IS DISTINCT FROM btrim(p_note) OR length(p_note) > 2000
  THEN RETURN QUERY SELECT 'VALIDATION_ERROR'::text, false; RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('f1:customer-note:' || p_tenant_id || ':' || p_actor_id || ':' || p_client_event_id, 0));
  SELECT event.* INTO v_prior
  FROM public.events event
  WHERE event.tenant_id = p_tenant_id
    AND event.user_id = p_actor_id
    AND event.client_event_id = p_client_event_id
    AND event.event_type = 'CUSTOMER_NOTE_CHANGED_V1';
  IF FOUND THEN
    IF v_prior.payload->>'customerId' = p_customer_id AND v_prior.payload->>'noteSha256' = v_note_sha
    THEN RETURN QUERY SELECT 'OK'::text, true;
    ELSE RETURN QUERY SELECT 'CONFLICT'::text, true;
    END IF;
    RETURN;
  END IF;

  UPDATE public.customers
  SET internal_notes = nullif(p_note, ''), updated_at = statement_timestamp()
  WHERE tenant_id = p_tenant_id AND id = p_customer_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 'NOT_FOUND'::text, false; RETURN; END IF;

  INSERT INTO public.events (
    id, tenant_id, event_type, description, payload, status, user_id,
    client_event_id, event_schema_version, correlation_id, aggregate_version, created_at
  ) VALUES (
    gen_random_uuid()::text, p_tenant_id, 'CUSTOMER_NOTE_CHANGED_V1', 'Kundennotiz geändert',
    jsonb_build_object('customerId', p_customer_id, 'noteSha256', v_note_sha), 'success', p_actor_id,
    p_client_event_id, 1, gen_random_uuid(), 1, statement_timestamp() AT TIME ZONE 'UTC'
  );
  RETURN QUERY SELECT 'OK'::text, false;
END;
$$;

REVOKE ALL ON FUNCTION private.update_customer_note_v1(text, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.update_customer_note_v1(text, uuid, uuid, text, text) TO service_role;
