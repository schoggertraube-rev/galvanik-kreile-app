-- S02 / PL 10.11.23:01: immutable reservation before an external mail effect.
-- No mail body, provider token, new table or new sender.
ALTER TABLE public.events ADD CONSTRAINT communication_mail_prepare_receipt_contract CHECK (
  event_type <> 'COMMUNICATION_MAIL_PREPARED_V1' OR coalesce((
    tenant_id IS NOT NULL AND user_id IS NOT NULL AND client_event_id IS NOT NULL
    AND correlation_id IS NOT NULL AND event_schema_version=1 AND status='success'
    AND jsonb_typeof(payload)='object'
    AND payload->>'clientRequestId'=correlation_id::text
    AND payload->>'threadId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND payload->>'intentHash' ~ '^[0-9a-f]{64}$'
    AND payload->>'contentSha256' ~ '^[0-9a-f]{64}$'
    AND payload->>'targetType' IN('CUSTOMER','ORDER')
    AND length(payload->>'targetId')>0
    AND length(payload->>'customerId')>0
    AND payload->>'recipient' ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    AND jsonb_typeof(payload->'documents')='array'
    AND NOT(payload ?| ARRAY['body','text','token','pin','password'])
  ),false)
);
CREATE UNIQUE INDEX communication_mail_prepare_request_unique ON public.events(tenant_id,correlation_id)
  WHERE event_type='COMMUNICATION_MAIL_PREPARED_V1';
CREATE INDEX communication_mail_prepare_intent_lookup ON public.events(tenant_id,(payload->>'intentHash'))
  WHERE event_type='COMMUNICATION_MAIL_PREPARED_V1';
CREATE TRIGGER communication_mail_prepare_update_immutable BEFORE UPDATE ON public.events FOR EACH ROW
  WHEN(OLD.event_type='COMMUNICATION_MAIL_PREPARED_V1' OR NEW.event_type='COMMUNICATION_MAIL_PREPARED_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER communication_mail_prepare_delete_immutable BEFORE DELETE ON public.events FOR EACH ROW
  WHEN(OLD.event_type='COMMUNICATION_MAIL_PREPARED_V1') EXECUTE FUNCTION public.prevent_audit_mutation();
-- The table-wide existing events truncate guard already rejects TRUNCATE.
