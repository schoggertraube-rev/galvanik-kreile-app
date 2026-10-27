-- F0: per-login access areas are the single authorization truth.
-- Existing roles are retained only as templates and labels.

ALTER TABLE public.app_users
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS kuerzel varchar(8),
  ADD COLUMN IF NOT EXISTS bezeichnung text;

UPDATE public.app_users
SET
  kuerzel = COALESCE(
    NULLIF(btrim(kuerzel), ''),
    upper(left(regexp_replace(full_name, '[^[:alpha:]]', '', 'g'), 2))
  ),
  bezeichnung = COALESCE(
    NULLIF(btrim(bezeichnung), ''),
    CASE role
      WHEN 'developer' THEN 'App-Entwicklerin · Wartung'
      WHEN 'admin' THEN 'Administration'
      WHEN 'meister' THEN 'Firmeninhaber'
      WHEN 'buero' THEN 'Büro'
      WHEN 'werkstatt' THEN 'Werkstatt'
      ELSE 'Ohne Vorlage'
    END
  )
WHERE kuerzel IS NULL OR btrim(kuerzel) = '' OR bezeichnung IS NULL OR btrim(bezeichnung) = '';

ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_kuerzel_format_chk
    CHECK (kuerzel IS NULL OR kuerzel ~ '^[[:alnum:]][[:alnum:]_-]{0,7}$') NOT VALID,
  ADD CONSTRAINT app_users_bezeichnung_length_chk
    CHECK (bezeichnung IS NULL OR length(btrim(bezeichnung)) BETWEEN 1 AND 120) NOT VALID;

CREATE UNIQUE INDEX app_users_tenant_kuerzel_uidx
  ON public.app_users (tenant_id, lower(kuerzel))
  WHERE kuerzel IS NOT NULL;

CREATE TABLE public.app_user_rights (
  tenant_id text NOT NULL,
  user_id uuid NOT NULL,
  bereich text NOT NULL,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT app_user_rights_pkey PRIMARY KEY (tenant_id, user_id, bereich),
  CONSTRAINT app_user_rights_user_fkey
    FOREIGN KEY (tenant_id, user_id)
    REFERENCES public.app_users (tenant_id, id)
    ON DELETE CASCADE,
  CONSTRAINT app_user_rights_granted_by_fkey
    FOREIGN KEY (granted_by)
    REFERENCES public.app_users (id)
    ON DELETE SET NULL,
  CONSTRAINT app_user_rights_bereich_chk CHECK (
    bereich IN ('auftraege', 'eingang', 'kunden', 'geld', 'mails', 'einstellungen', 'logins', 'wartung')
  )
);

COMMENT ON TABLE public.app_user_rights IS
  'F0 tenant-bound per-login access areas; roles are templates only.';

ALTER TABLE public.app_user_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user_rights FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_user_rights FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.app_user_rights TO service_role;

CREATE POLICY app_user_rights_service_role
  ON public.app_user_rights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
SELECT users.tenant_id, users.id, templates.bereich, NULL
FROM public.app_users users
CROSS JOIN LATERAL unnest(
  CASE users.role
    WHEN 'developer' THEN ARRAY['auftraege', 'eingang', 'kunden', 'geld', 'mails', 'einstellungen', 'logins', 'wartung']::text[]
    WHEN 'admin' THEN ARRAY['auftraege', 'eingang', 'kunden', 'geld', 'mails', 'einstellungen', 'logins', 'wartung']::text[]
    WHEN 'meister' THEN ARRAY['auftraege', 'eingang', 'kunden', 'geld', 'mails', 'einstellungen']::text[]
    WHEN 'buero' THEN ARRAY['auftraege', 'eingang', 'kunden', 'geld', 'mails', 'einstellungen']::text[]
    WHEN 'werkstatt' THEN ARRAY['auftraege', 'eingang', 'kunden']::text[]
    ELSE ARRAY[]::text[]
  END
) templates(bereich)
ON CONFLICT (tenant_id, user_id, bereich) DO NOTHING;

CREATE OR REPLACE VIEW private.v_order_task_assignee_options_v1
WITH (security_invoker = true)
AS
SELECT
  actor.tenant_id,
  actor.id AS user_id,
  actor.full_name,
  actor.role,
  actor.active,
  (
    actor.full_name = btrim(actor.full_name)
    AND length(actor.full_name) BETWEEN 1 AND 160
    AND actor.role IN ('developer', 'admin', 'meister', 'buero', 'werkstatt', 'readonly')
    AND EXISTS (
      SELECT 1
      FROM public.app_user_rights rights
      WHERE rights.tenant_id = actor.tenant_id
        AND rights.user_id = actor.id
        AND rights.bereich = 'auftraege'
    )
  ) AS integrity_ok
FROM public.app_users actor
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND actor.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND actor.active = true
  AND actor.role IN ('developer', 'admin', 'meister', 'buero', 'werkstatt', 'readonly')
  AND EXISTS (
    SELECT 1
    FROM public.app_user_rights rights
    WHERE rights.tenant_id = actor.tenant_id
      AND rights.user_id = actor.id
      AND rights.bereich = 'auftraege'
  );

COMMENT ON VIEW private.v_order_task_assignee_options_v1 IS
  'F0 tenant-bound active assignment targets selected by the auftraege access area.';
