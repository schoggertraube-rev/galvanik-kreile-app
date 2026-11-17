-- A-09 / I-046: one server-only technical source. Business events are untouched.
-- PL16.11.14:51: no anonymous actor or substitute tenant.
CREATE TABLE public.technical_protocol (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.app_users(id),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  event_type text NOT NULL CHECK (event_type IN
    ('rejected','server_error','slow','external','offline_sync','offline_conflict','offline_quarantine')),
  command text NOT NULL CHECK (command ~ '^[a-zA-Z][a-zA-Z0-9_.:-]{0,99}$'),
  subject_type text NOT NULL CHECK (subject_type ~ '^[a-z][a-z0-9_]{0,39}$'),
  subject_id text NOT NULL CHECK (length(subject_id) BETWEEN 1 AND 200),
  duration_ms integer NULL CHECK (duration_ms >= 0),
  reason text NULL CHECK (reason IN ('FORBIDDEN','VALIDATION','CONFLICT','NOT_FOUND','UNAVAILABLE','UNAUTHENTICATED','SERVER_ERROR','UNKNOWN')),
  dienst text NULL CHECK (dienst IN ('microsoft365','belegerkennung','versand','druck')),
  ergebnis text NULL CHECK (ergebnis IN ('ok','fehler','zeitueberschreitung','unklar')),
  original_ref text NULL,
  original_sha256 text NULL CHECK (original_sha256 ~ '^[0-9a-f]{64}$'),
  verpasst integer NOT NULL DEFAULT 0 CHECK (verpasst >= 0),
  CONSTRAINT technical_protocol_original_pair CHECK ((original_ref IS NULL) = (original_sha256 IS NULL)),
  CONSTRAINT technical_protocol_external_complete CHECK (
    (event_type = 'external' AND dienst IS NOT NULL AND ergebnis IS NOT NULL)
    OR (event_type <> 'external' AND dienst IS NULL AND ergebnis IS NULL))
);
CREATE INDEX technical_protocol_tenant_time ON public.technical_protocol(tenant_id,occurred_at DESC,id);
CREATE INDEX technical_protocol_tenant_actor_time ON public.technical_protocol(tenant_id,user_id,occurred_at DESC);
ALTER TABLE public.technical_protocol ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_protocol FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.technical_protocol FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,DELETE ON public.technical_protocol TO service_role;

CREATE FUNCTION private.qualify_technical_protocol_actor() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_users actor
    WHERE actor.id=NEW.user_id AND actor.tenant_id=NEW.tenant_id) THEN
    RAISE EXCEPTION 'TECHNICAL_PROTOCOL_ACTOR_TENANT_MISMATCH' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.qualify_technical_protocol_actor() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER technical_protocol_actor_guard BEFORE INSERT ON public.technical_protocol
FOR EACH ROW EXECUTE FUNCTION private.qualify_technical_protocol_actor();
