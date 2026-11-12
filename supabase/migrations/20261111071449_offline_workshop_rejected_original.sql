-- PL 11.11.08:01: rejected offline workshop originals use the existing events.
-- Protect the original and its task link; the existing global audit trigger
-- already rejects TRUNCATE of public.events.
CREATE TRIGGER offline_workshop_original_update_immutable
BEFORE UPDATE ON public.events FOR EACH ROW
WHEN (OLD.event_type IN ('OFFLINE_WORKSHOP_REJECTED_V1','OFFLINE_WORKSHOP_REJECTED_TASK_V1')
   OR NEW.event_type IN ('OFFLINE_WORKSHOP_REJECTED_V1','OFFLINE_WORKSHOP_REJECTED_TASK_V1'))
EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER offline_workshop_original_delete_immutable
BEFORE DELETE ON public.events FOR EACH ROW
WHEN (OLD.event_type IN ('OFFLINE_WORKSHOP_REJECTED_V1','OFFLINE_WORKSHOP_REJECTED_TASK_V1'))
EXECUTE FUNCTION public.prevent_audit_mutation();
