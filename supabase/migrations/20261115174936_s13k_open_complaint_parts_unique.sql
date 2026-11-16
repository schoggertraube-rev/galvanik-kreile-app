-- K13K-7 / PL15.11.16:10: one open complaint per real tenant/order/part.
-- Existing JSON remains the only stored parts source; item_id is legacy.
DO $preflight$
DECLARE overlap_ids jsonb;
BEGIN
  WITH parts AS (
    SELECT c.id,c.tenant_id,c.order_id,p.position_id
    FROM public.complaints c
    CROSS JOIN LATERAL (
      SELECT c.item_id AS position_id WHERE c.item_id IS NOT NULL
      UNION
      SELECT entry->>'position_id' FROM jsonb_array_elements(c.teile) entry
    ) p
    WHERE c.stand IS DISTINCT FROM 'abgeschlossen'
  ), overlap_rows AS (
    SELECT DISTINCT a.id AS first_id,b.id AS second_id
    FROM parts a JOIN parts b ON b.tenant_id=a.tenant_id
      AND b.order_id=a.order_id AND b.position_id=a.position_id AND b.id>a.id
  )
  SELECT jsonb_agg(jsonb_build_object('first',first_id,'second',second_id))
  INTO overlap_ids FROM overlap_rows;
  IF overlap_ids IS NOT NULL THEN
    RAISE EXCEPTION 'S13K_OPEN_COMPLAINT_OVERLAP'
      USING ERRCODE='23514',DETAIL=overlap_ids::text;
  END IF;
END;
$preflight$;

CREATE UNIQUE INDEX s13k_complaints_open_legacy_item_unique
  ON public.complaints(tenant_id,order_id,item_id)
  WHERE item_id IS NOT NULL AND stand IS DISTINCT FROM 'abgeschlossen';

CREATE FUNCTION private.s13k_check_open_complaint_parts()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public
AS $function$
BEGIN
  IF NEW.stand IS NOT DISTINCT FROM 'abgeschlossen' THEN RETURN NEW; END IF;
  -- Same real tenant/order row lock as the existing aufnehmen writer.
  PERFORM id FROM public.orders
    WHERE tenant_id=NEW.tenant_id AND id=NEW.order_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.complaints other
    CROSS JOIN LATERAL (
      SELECT other.item_id AS position_id WHERE other.item_id IS NOT NULL
      UNION SELECT part->>'position_id' FROM jsonb_array_elements(other.teile) part
    ) existing_part
    JOIN LATERAL (
      SELECT NEW.item_id AS position_id WHERE NEW.item_id IS NOT NULL
      UNION SELECT part->>'position_id' FROM jsonb_array_elements(NEW.teile) part
    ) incoming_part ON incoming_part.position_id=existing_part.position_id
    WHERE other.tenant_id=NEW.tenant_id AND other.order_id=NEW.order_id
      AND other.id<>NEW.id AND other.stand IS DISTINCT FROM 'abgeschlossen'
  ) THEN
    RAISE EXCEPTION 'S13K_OPEN_COMPLAINT_PART_ALREADY_PRESENT'
      USING ERRCODE='23505',CONSTRAINT='s13k_complaints_open_parts_unique';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.s13k_check_open_complaint_parts()
  FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER s13k_complaints_open_parts_unique
  AFTER INSERT OR UPDATE ON public.complaints
  NOT DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION private.s13k_check_open_complaint_parts();
