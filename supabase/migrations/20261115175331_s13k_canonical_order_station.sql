-- K13K-8 / PL15.11.16:10: canonical station projection, no backfill.
-- Existing rows are NOT updated or validated by this migration.
-- Writer combinations: four equal operational states; cancelled intake keeps
-- angenommen stations (quote undo and withdrawn not-yet-started rework).
CREATE FUNCTION private.s13k_project_order_station()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $function$
BEGIN
  NEW.station := NEW.current_station_id;
  NEW.current_station := NEW.current_station_id;
  -- Never rewrite status; in particular a real storniert stays storniert.
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.s13k_project_order_station()
  FROM PUBLIC,anon,authenticated;
CREATE TRIGGER s13k_orders_project_station
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.s13k_project_order_station();
ALTER TABLE public.orders ADD CONSTRAINT s13k_orders_station_combination
CHECK (
  current_station_id IS NOT NULL
  AND current_station_id IN ('angenommen','galvanik','fertig','abgeholt')
  AND station IS NOT DISTINCT FROM current_station_id
  AND current_station IS NOT DISTINCT FROM current_station_id
  AND (status=current_station_id OR
       (status='storniert' AND current_station_id='angenommen')) IS TRUE
) NOT VALID;
