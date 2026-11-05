-- P51: retain the existing write/read paths; remove destructive table privileges.
REVOKE DELETE, TRUNCATE ON TABLE
  public.intake_item,
  public.intake_event,
  public.intake_file,
  public.intake_suggestion,
  public.device_request,
  public.outbox_mails
FROM service_role, anon, authenticated;

-- The intake history is append-only for every application role.
REVOKE UPDATE ON TABLE public.intake_event
FROM service_role, anon, authenticated;
