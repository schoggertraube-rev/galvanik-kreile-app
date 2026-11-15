-- PL14Nov18:09: protection only, no replacement of an existing guard or source.
-- Requests bind N5 to the same original. Group/parcel events remain evidence
-- even before the last active shipment closes the whole order.
CREATE TRIGGER events_s10_original_handover_update_immutable
 BEFORE UPDATE ON public.events FOR EACH ROW
 WHEN (OLD.event_type IN ('DELIVERY_NOTE_ORIGINAL_V1','DELIVERY_NOTE_REQUESTED_V1','SHIPMENT_GROUP_HANDED_OVER_V1','SHIPMENT_HANDED_OVER_V1')
    OR NEW.event_type IN ('DELIVERY_NOTE_ORIGINAL_V1','DELIVERY_NOTE_REQUESTED_V1','SHIPMENT_GROUP_HANDED_OVER_V1','SHIPMENT_HANDED_OVER_V1'))
 EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_s10_original_handover_delete_immutable
 BEFORE DELETE ON public.events FOR EACH ROW
 WHEN (OLD.event_type IN ('DELIVERY_NOTE_ORIGINAL_V1','DELIVERY_NOTE_REQUESTED_V1','SHIPMENT_GROUP_HANDED_OVER_V1','SHIPMENT_HANDED_OVER_V1'))
 EXECUTE FUNCTION public.prevent_audit_mutation();
