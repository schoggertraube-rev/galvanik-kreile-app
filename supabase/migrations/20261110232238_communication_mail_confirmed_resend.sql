-- PL23:01: at most one explicit resend after a complete empty Sent Items check.
ALTER TABLE public.events ADD CONSTRAINT communication_mail_resend_receipt_contract CHECK (
 event_type<>'COMMUNICATION_MAIL_RESEND_CONFIRMED_V1' OR coalesce((
  status='success' AND user_id IS NOT NULL AND event_schema_version=1
  AND payload->>'originalRequestId'=correlation_id::text
  AND payload->>'threadId' ~ '^[0-9a-f-]{36}$'
  AND payload->>'intentHash' ~ '^[0-9a-f]{64}$'
  AND payload->>'reason'='nicht_im_postausgang_gefunden'
  AND NOT(payload ?| ARRAY['body','text','token','pin','password'])
 ),false)
);
CREATE UNIQUE INDEX communication_mail_one_confirmed_resend ON public.events(tenant_id,correlation_id)
 WHERE event_type='COMMUNICATION_MAIL_RESEND_CONFIRMED_V1';
CREATE TRIGGER communication_mail_resend_update_immutable BEFORE UPDATE ON public.events FOR EACH ROW
 WHEN(OLD.event_type='COMMUNICATION_MAIL_RESEND_CONFIRMED_V1' OR NEW.event_type='COMMUNICATION_MAIL_RESEND_CONFIRMED_V1') EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER communication_mail_resend_delete_immutable BEFORE DELETE ON public.events FOR EACH ROW
 WHEN(OLD.event_type='COMMUNICATION_MAIL_RESEND_CONFIRMED_V1') EXECUTE FUNCTION public.prevent_audit_mutation();
