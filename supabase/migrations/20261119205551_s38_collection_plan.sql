-- S38a / PL19.11.16:22: immutable preparation on the existing order event source.
-- This records no planned month and creates no billable collection membership.
CREATE TRIGGER events_collection_plan_update_immutable
BEFORE UPDATE ON public.events FOR EACH ROW
WHEN (OLD.event_type = 'ORDER_COLLECTION_PLANNED_V1')
EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_collection_plan_delete_immutable
BEFORE DELETE ON public.events FOR EACH ROW
WHEN (OLD.event_type = 'ORDER_COLLECTION_PLANNED_V1')
EXECUTE FUNCTION public.prevent_audit_mutation();
