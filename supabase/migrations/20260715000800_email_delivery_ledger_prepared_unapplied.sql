-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Durable, server-only email delivery and verified webhook audit boundary.

ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.app_users(id),
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.ausgangsrechnung(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS recipient text,
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code text;

UPDATE public.communications SET status = 'queued' WHERE status IS NULL;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.communications
    WHERE status NOT IN ('draft', 'queued', 'sending', 'sent', 'delivered', 'opened', 'bounced', 'complained', 'failed', 'uncertain')
  ) THEN
    RAISE EXCEPTION 'Unknown communications.status values must be classified before email hardening';
  END IF;
  IF EXISTS (
    SELECT tenant_id, idempotency_key FROM public.communications
    WHERE idempotency_key IS NOT NULL
    GROUP BY tenant_id, idempotency_key HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate communications idempotency keys must be resolved before email hardening';
  END IF;
  IF EXISTS (
    SELECT resend_message_id FROM public.communications
    WHERE resend_message_id IS NOT NULL
    GROUP BY resend_message_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Resend message IDs must be resolved before email hardening';
  END IF;
END
$preflight$;

ALTER TABLE public.communications
  ALTER COLUMN status SET DEFAULT 'queued',
  ALTER COLUMN status SET NOT NULL,
  ADD CONSTRAINT communications_delivery_status_chk
    CHECK (status IN ('draft', 'queued', 'sending', 'sent', 'delivered', 'opened', 'bounced', 'complained', 'failed', 'uncertain')),
  ADD CONSTRAINT communications_attempt_count_chk CHECK (attempt_count >= 0),
  ADD CONSTRAINT communications_idempotency_key_chk CHECK (
    idempotency_key IS NULL OR idempotency_key ~ '^[A-Za-z0-9._:/-]{8,200}$'
  ),
  ADD CONSTRAINT communications_template_key_chk CHECK (
    template_key IS NULL OR template_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'
  ),
  ADD CONSTRAINT communications_error_code_chk CHECK (error_code IS NULL OR length(error_code) <= 120),
  ADD CONSTRAINT communications_sent_provider_id_chk CHECK (
    status NOT IN ('sent', 'delivered', 'opened', 'bounced', 'complained') OR resend_message_id IS NOT NULL
  );

CREATE UNIQUE INDEX communications_tenant_idempotency_uidx
  ON public.communications (tenant_id, idempotency_key);
CREATE UNIQUE INDEX communications_resend_message_uidx
  ON public.communications (resend_message_id)
  WHERE resend_message_id IS NOT NULL;
CREATE INDEX communications_delivery_status_idx
  ON public.communications (status, claimed_at);
CREATE INDEX communications_tenant_invoice_created_idx
  ON public.communications (tenant_id, invoice_id, created_at DESC)
  WHERE invoice_id IS NOT NULL;

CREATE TABLE public.email_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  provider_event_id text NOT NULL,
  provider_message_id text,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'succeeded', 'failed')),
  processed_at timestamptz,
  error_code text CHECK (error_code IS NULL OR length(error_code) <= 120),
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_webhook_events_provider_event_uidx UNIQUE (provider_event_id),
  CONSTRAINT email_webhook_event_id_format_chk CHECK (provider_event_id ~ '^msg_[A-Za-z0-9_-]{8,200}$'),
  CONSTRAINT email_webhook_event_type_chk CHECK (event_type ~ '^email\.[a-z_]{2,50}$')
);

CREATE INDEX email_webhook_events_message_idx
  ON public.email_webhook_events (provider_message_id, received_at);

ALTER TABLE public.feedback_mail
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'galvanik-kreile';

INSERT INTO public.email_templates (
  tenant_id, template_key, name, subject_template, body_html_template, body_text_template, variables
) VALUES
  (
    'galvanik-kreile',
    'status_update',
    'Auftragsstatus',
    'Status zu Auftrag {order_number}',
    '<p>Guten Tag {customer_name},</p><p>der aktuelle Status Ihres Auftrags {order_number} lautet: <strong>{status}</strong>.</p><p>Bei Rückfragen erreichen Sie uns über Ihren bekannten Kontaktweg.</p>',
    'Guten Tag {customer_name}, der aktuelle Status Ihres Auftrags {order_number} lautet: {status}. Bei Rückfragen erreichen Sie uns über Ihren bekannten Kontaktweg.',
    '["customer_name", "order_number", "status"]'::jsonb
  ),
  (
    'galvanik-kreile',
    'feedback_request',
    'Feedback nach Auftragsabschluss',
    'Ihre Rückmeldung zu Auftrag {auftragsnummer}',
    '<p>Guten Tag {kunde_name},</p><p>Ihr Auftrag {auftragsnummer} ({auftragsbezeichnung}) ist abgeschlossen. Wir möchten gern wissen, ob Sie zufrieden sind.</p><p>Bitte melden Sie sich über Ihren bekannten Kontaktweg bei uns.</p>',
    'Guten Tag {kunde_name}, Ihr Auftrag {auftragsnummer} ({auftragsbezeichnung}) ist abgeschlossen. Wir möchten gern wissen, ob Sie zufrieden sind. Bitte melden Sie sich über Ihren bekannten Kontaktweg bei uns.',
    '["kunde_name", "auftragsnummer", "auftragsbezeichnung"]'::jsonb
  ),
  (
    'galvanik-kreile',
    'zahlung_quittung',
    'Zahlungsbestätigung',
    'Zahlung zu Auftrag {order_id} bestätigt',
    '<p>Vielen Dank. Die Zahlung über {amount} EUR zu Ihrem Auftrag {order_id} wurde bestätigt.</p>',
    'Vielen Dank. Die Zahlung über {amount} EUR zu Ihrem Auftrag {order_id} wurde bestätigt.',
    '["amount", "order_id"]'::jsonb
  )
ON CONFLICT (template_key) DO NOTHING;

DO $boundary$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['communications', 'email_templates', 'email_webhook_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    FOR policy_name IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, table_name);
    END LOOP;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', table_name);
  END LOOP;
END
$boundary$;

GRANT SELECT, INSERT, UPDATE ON TABLE public.communications TO service_role;
GRANT SELECT ON TABLE public.email_templates TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.email_webhook_events TO service_role;

DO $verification$
DECLARE
  browser_grants integer;
  delete_grants integer;
BEGIN
  SELECT count(*) INTO browser_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('communications', 'email_templates', 'email_webhook_events')
    AND grantee IN ('anon', 'authenticated');
  IF browser_grants <> 0 THEN
    RAISE EXCEPTION 'Email boundary still exposes % browser grants', browser_grants;
  END IF;

  SELECT count(*) INTO delete_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('communications', 'email_templates', 'email_webhook_events')
    AND grantee = 'service_role'
    AND privilege_type = 'DELETE';
  IF delete_grants <> 0 THEN
    RAISE EXCEPTION 'Email boundary unexpectedly grants DELETE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['communications', 'email_templates', 'email_webhook_events']) AS expected(name)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = expected.name
        AND c.relrowsecurity AND c.relforcerowsecurity
    )
  ) THEN
    RAISE EXCEPTION 'Every email table must use forced RLS';
  END IF;
END
$verification$;
