-- Preserve the actor, reason and linked release of every conscious debt override.
CREATE FUNCTION private.guard_goods_out_debt_override_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.event_type = 'ORDER_GOODS_OUT_DEBT_OVERRIDE_V1'
    OR (TG_OP = 'UPDATE' AND NEW.event_type = 'ORDER_GOODS_OUT_DEBT_OVERRIDE_V1')
  THEN
    RAISE EXCEPTION 'GOODS_OUT_DEBT_OVERRIDE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_goods_out_debt_override_v1() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER events_goods_out_debt_override_immutable
BEFORE UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION private.guard_goods_out_debt_override_v1();
