\set ON_ERROR_STOP on

DO $validation$
DECLARE
  unexpected integer;
BEGIN
  SELECT count(*) INTO unexpected
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('communications', 'email_templates', 'email_webhook_events')
    AND grantee IN ('anon', 'authenticated');
  IF unexpected <> 0 THEN RAISE EXCEPTION 'Expected zero browser email grants, found %', unexpected; END IF;

  IF has_table_privilege('service_role', 'public.communications', 'DELETE') OR
     has_table_privilege('service_role', 'public.email_templates', 'DELETE') OR
     has_table_privilege('service_role', 'public.email_webhook_events', 'DELETE') THEN
    RAISE EXCEPTION 'Service role unexpectedly has DELETE';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.communications', 'SELECT,INSERT,UPDATE') THEN
    RAISE EXCEPTION 'Service role lacks communications delivery privileges';
  END IF;
  IF has_table_privilege('service_role', 'public.email_templates', 'INSERT') THEN
    RAISE EXCEPTION 'Service role unexpectedly mutates templates';
  END IF;

  IF (SELECT count(*) FROM public.email_templates WHERE template_key IN ('status_update', 'feedback_request', 'zahlung_quittung')) <> 3 THEN
    RAISE EXCEPTION 'Required truthful email templates are missing';
  END IF;
END
$validation$;

INSERT INTO public.communications (
  tenant_id, recipient, template_key, idempotency_key, subject, body, type, channel_type, status
) VALUES (
  'galvanik-kreile', 'kunde@example.com', 'status_update', 'status/order-1/attempt-1',
  'Status', '<p>Status</p>', 'email', 'email', 'queued'
);

DO $constraints$
BEGIN
  BEGIN
    INSERT INTO public.communications (
      tenant_id, recipient, template_key, idempotency_key, subject, body, type, channel_type, status
    ) VALUES (
      'galvanik-kreile', 'kunde@example.com', 'status_update', 'status/order-1/attempt-1',
      'Duplicate', '<p>Duplicate</p>', 'email', 'email', 'queued'
    );
    RAISE EXCEPTION 'Expected duplicate idempotency key to fail';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.communications SET status = 'sent';
    RAISE EXCEPTION 'Expected sent state without provider ID to fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$constraints$;

UPDATE public.communications
SET status = 'sent', resend_message_id = 'msg_local_validation_001'
WHERE idempotency_key = 'status/order-1/attempt-1';

INSERT INTO public.email_webhook_events (
  tenant_id, provider_event_id, provider_message_id, event_type, status, processed_at
) VALUES (
  'galvanik-kreile', 'msg_event_validation_001', 'msg_local_validation_001', 'email.delivered', 'succeeded', now()
);

SELECT 'email_delivery_ok' AS result;
