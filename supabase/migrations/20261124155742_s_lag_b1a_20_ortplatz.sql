CREATE FUNCTION private.lager_ort_ist_platz() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  IF NEW.ort_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.stock_locations ort
    WHERE ort.tenant_id = NEW.tenant_id AND ort.id = NEW.ort_id AND ort.bereich IS NULL
  ) THEN
    RAISE EXCEPTION 'LAGER_ORT_IST_STOCKWERK' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$funktion$;

REVOKE ALL ON FUNCTION private.lager_ort_ist_platz() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_ort_ist_platz() TO service_role;

CREATE TRIGGER stock_movements_lager_ort_ist_platz
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION private.lager_ort_ist_platz();
CREATE TRIGGER inventory_counts_lager_ort_ist_platz
  BEFORE INSERT ON public.inventory_counts
  FOR EACH ROW EXECUTE FUNCTION private.lager_ort_ist_platz();
