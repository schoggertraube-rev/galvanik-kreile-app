-- S09 / PL13Nov22:20: explicit fact on the current versioned quote.
-- Historical quotes retain the approved false default; never infer from names.
ALTER TABLE private.quotes ADD COLUMN versand_enthalten boolean NOT NULL DEFAULT false;

CREATE TRIGGER events_quote_shipping_update_immutable
 BEFORE UPDATE ON public.events FOR EACH ROW
 WHEN (OLD.event_type='QUOTE_SHIPPING_INCLUDED_SET_V1' OR NEW.event_type='QUOTE_SHIPPING_INCLUDED_SET_V1')
 EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_quote_shipping_delete_immutable
 BEFORE DELETE ON public.events FOR EACH ROW
 WHEN (OLD.event_type='QUOTE_SHIPPING_INCLUDED_SET_V1')
 EXECUTE FUNCTION public.prevent_audit_mutation();
