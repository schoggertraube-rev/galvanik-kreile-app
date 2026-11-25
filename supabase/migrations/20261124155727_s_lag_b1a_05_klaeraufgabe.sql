-- Die Bestandsklärungsaufgabe nutzt die vorhandene Aufgabentabelle.
ALTER TABLE public.tasks DROP CONSTRAINT tasks_bezug_typ_check,
  ADD CONSTRAINT tasks_bezug_typ_check CHECK (
    bezug_typ IN ('kunde','auftrag','kv','eingang','eingangsrechnung','reklamation','allgemein','lagerartikel','lagerbestand')
  );
CREATE UNIQUE INDEX tasks_lagerbestand_offen_key
  ON public.tasks (tenant_id, bezug_id) WHERE bezug_typ = 'lagerbestand' AND status = 'offen';

-- Eine Übernahme in P1 darf bereits erfasste Bewegungsmengen nicht umdeuten.
CREATE FUNCTION private.lager_basiseinheit_schuetzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  IF NEW.basiseinheit IS DISTINCT FROM OLD.basiseinheit AND EXISTS (
    SELECT 1 FROM public.stock_movements bewegung WHERE bewegung.tenant_id = NEW.tenant_id
      AND bewegung.inventory_item_id = NEW.id AND bewegung.befehl_id IS NOT NULL
      AND bewegung.lagerwirksam AND bewegung.quantity <> 0
      AND bewegung.mengeneinheit IS DISTINCT FROM NEW.basiseinheit
  ) THEN
    RAISE EXCEPTION 'LAGER_BASISEINHEIT_KONFLIKT' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$funktion$;
REVOKE ALL ON FUNCTION private.lager_basiseinheit_schuetzen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_basiseinheit_schuetzen() TO service_role;
CREATE TRIGGER inventory_items_lager_basiseinheit_schuetzen
  BEFORE UPDATE OF basiseinheit ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION private.lager_basiseinheit_schuetzen();
