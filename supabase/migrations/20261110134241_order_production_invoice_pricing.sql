-- Historical backfill may cross an existing later snapshot ONLY with a real intervening reopening event. No guard disabling.
CREATE OR REPLACE FUNCTION private.guard_order_production_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,private AS $$
DECLARE source public.events%ROWTYPE; original private.order_production_snapshots%ROWTYPE; base private.order_production_snapshots%ROWTYPE; extra_amount bigint;
BEGIN
 SELECT * INTO source FROM public.events WHERE id=NEW.event_id;
 IF NOT FOUND OR source.tenant_id IS DISTINCT FROM NEW.tenant_id OR source.order_id IS DISTINCT FROM NEW.order_id
  OR source.created_at IS DISTINCT FROM NEW.occurred_at OR source.status IS DISTINCT FROM 'success' OR source.user_id IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.items WHERE id=NEW.item_id AND order_id=NEW.order_id AND tenant_id=NEW.tenant_id)
  OR (NEW.direction=-1 AND (source.event_type='ORDER_ITEM_FINISHED_CHANGED_V1' AND source.item_id=NEW.item_id AND source.payload->>'finished'='false' OR source.event_type='ORDER_FREEZE_CORRECTED_V1')
   OR NEW.direction=1 AND NEW.component='base' AND (source.event_type='ORDER_ITEM_FINISHED_CHANGED_V1' AND source.item_id=NEW.item_id AND source.payload->>'finished'='true' OR source.event_type='ORDER_FROZEN_V1')
   OR NEW.direction=1 AND NEW.component='extra' AND source.event_type='ORDER_FROZEN_V1'
   OR NEW.direction=1 AND NEW.component='pricing' AND source.event_type IN ('ORDER_CONTENT_CHANGED_V1','ORDER_INVOICE_PRICES_SET_V1')) IS NOT TRUE
 THEN RAISE EXCEPTION 'ORDER_PRODUCTION_EVENT_SOURCE_INVALID'; END IF;
 IF NEW.direction=-1 THEN
  SELECT * INTO original FROM private.order_production_snapshots WHERE event_id=NEW.reverses_event_id AND item_id=NEW.item_id AND component=NEW.component;
  IF NOT FOUND OR original.direction<>1 OR original.tenant_id IS DISTINCT FROM NEW.tenant_id OR original.order_id IS DISTINCT FROM NEW.order_id
   OR original.quantity IS DISTINCT FROM NEW.quantity OR original.unit IS DISTINCT FROM NEW.unit OR original.net_cents IS DISTINCT FROM NEW.net_cents
   OR original.rework IS DISTINCT FROM NEW.rework OR original.valuation IS DISTINCT FROM NEW.valuation OR original.price_source IS DISTINCT FROM NEW.price_source
   OR original.origin_event_id IS DISTINCT FROM NEW.origin_event_id
  THEN RAISE EXCEPTION 'ORDER_PRODUCTION_REVERSAL_SOURCE_INVALID'; END IF;
 ELSE
  IF NEW.component='base' THEN
   IF EXISTS(SELECT 1 FROM private.order_production_snapshots positive WHERE positive.tenant_id=NEW.tenant_id AND positive.item_id=NEW.item_id AND positive.direction=1 AND positive.component='base'
    AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.reverses_event_id=positive.event_id AND negative.item_id=positive.item_id AND negative.component=positive.component)
    AND (NEW.valuation<>'nachberechnet' OR NOT EXISTS(SELECT 1 FROM public.events reopened WHERE reopened.tenant_id=NEW.tenant_id AND reopened.order_id=NEW.order_id AND reopened.status='success'
     AND (reopened.event_type='ORDER_FREEZE_CORRECTED_V1' OR reopened.event_type='ORDER_ITEM_FINISHED_CHANGED_V1' AND reopened.item_id=NEW.item_id AND reopened.payload->>'finished'='false')
     AND reopened.created_at>least(positive.occurred_at,NEW.occurred_at) AND reopened.created_at<=greatest(positive.occurred_at,NEW.occurred_at))))
   THEN RAISE EXCEPTION 'ORDER_PRODUCTION_ALREADY_COUNTED'; END IF;
  ELSE
   SELECT * INTO base FROM private.order_production_snapshots WHERE event_id=NEW.origin_event_id AND item_id=NEW.item_id AND component='base' AND direction=1;
   IF NOT FOUND OR base.tenant_id IS DISTINCT FROM NEW.tenant_id OR base.order_id IS DISTINCT FROM NEW.order_id OR base.quantity IS DISTINCT FROM NEW.quantity
    OR base.unit IS DISTINCT FROM NEW.unit OR base.rework IS DISTINCT FROM NEW.rework
    OR EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.reverses_event_id=base.event_id AND negative.item_id=base.item_id AND negative.component='base' AND negative.occurred_at<=NEW.occurred_at)
   THEN RAISE EXCEPTION 'ORDER_PRODUCTION_COMPONENT_SOURCE_INVALID'; END IF;
   IF NEW.component='pricing' AND (base.net_cents IS NOT NULL OR NEW.net_cents IS NULL) THEN RAISE EXCEPTION 'ORDER_PRODUCTION_PRICING_SOURCE_INVALID'; END IF;
   IF NEW.component='extra' THEN
    SELECT sum(line.amount_cents) INTO extra_amount FROM private.order_frozen_extra_work_lines line JOIN private.order_freezes frozen ON frozen.id=line.freeze_id AND frozen.tenant_id=line.tenant_id
     WHERE frozen.event_id=NEW.event_id AND line.tenant_id=NEW.tenant_id AND line.order_id=NEW.order_id AND line.item_id=NEW.item_id;
    IF NEW.net_cents IS DISTINCT FROM (CASE WHEN NEW.rework THEN 0 ELSE extra_amount END) OR extra_amount IS NULL THEN RAISE EXCEPTION 'ORDER_PRODUCTION_EXTRA_SOURCE_INVALID'; END IF;
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
