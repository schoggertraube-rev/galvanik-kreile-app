-- S38a / A-15, R2: retain the existing mail ledger's recovery original.
-- Same event source and audit guard, no new table, role, policy or privilege.
CREATE TRIGGER events_invoice_mail_remainder_update_immutable
BEFORE UPDATE ON public.events FOR EACH ROW
WHEN (OLD.event_type = 'INVOICE_MAIL_REMAINDER_PENDING_V1'
   OR NEW.event_type = 'INVOICE_MAIL_REMAINDER_PENDING_V1')
EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_invoice_mail_remainder_delete_immutable
BEFORE DELETE ON public.events FOR EACH ROW
WHEN (OLD.event_type = 'INVOICE_MAIL_REMAINDER_PENDING_V1')
EXECUTE FUNCTION public.prevent_audit_mutation();
