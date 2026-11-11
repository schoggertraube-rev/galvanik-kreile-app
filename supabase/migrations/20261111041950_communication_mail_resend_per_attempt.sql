-- PL 11.11.05:15 B1: one confirmed resend per unresolved attempt.
DROP INDEX public.communication_mail_one_confirmed_resend;
CREATE UNIQUE INDEX communication_mail_one_confirmed_resend_per_attempt
 ON public.events(tenant_id,correlation_id,(coalesce(payload->>'attempt','1')))
 WHERE event_type='COMMUNICATION_MAIL_RESEND_CONFIRMED_V1';
ALTER TABLE public.events ADD CONSTRAINT communication_mail_resend_attempt_contract
 CHECK(event_type<>'COMMUNICATION_MAIL_RESEND_CONFIRMED_V1'
  OR coalesce(payload->>'attempt' ~ '^[1-9][0-9]{0,2}$',false)) NOT VALID;
