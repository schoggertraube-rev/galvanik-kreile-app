-- H18.8e: the catalogue module emits its audit event atomically without
-- reaching across the module boundary into fundament-owned tables.

CREATE FUNCTION private.emit_catalog_service_saved_ui_event_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_actor_id text := nullif(btrim(current_setting('app.actor_id', true)), '');
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ui_events (tenant_id, event_type, payload)
  VALUES (
    NEW.tenant_id,
    'catalog_service_saved',
    jsonb_build_object('actorId', v_actor_id, 'serviceId', NEW.id::text)
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.emit_catalog_service_saved_ui_event_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.emit_catalog_service_saved_ui_event_v1() TO service_role;

CREATE TRIGGER catalog_services_emit_ui_event
AFTER INSERT OR UPDATE ON public.catalog_services
FOR EACH ROW
EXECUTE FUNCTION private.emit_catalog_service_saved_ui_event_v1();

COMMENT ON FUNCTION private.emit_catalog_service_saved_ui_event_v1() IS
  'H18 catalogue audit seam; emits only for application transactions carrying app.actor_id.';
