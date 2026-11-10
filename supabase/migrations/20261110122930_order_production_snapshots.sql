-- PL 10.11.10:03 / U-264: immutable facts attached to the existing completion
-- event. This is not invoice revenue and never rereads today's price on reversal.
CREATE TABLE private.order_production_snapshots (
  event_id text NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  tenant_id text NOT NULL,
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  item_id text NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  occurred_at timestamp without time zone NOT NULL,
  direction smallint NOT NULL CHECK (direction IN (-1,1)),
  quantity numeric(18,3) NOT NULL CHECK (quantity>0),
  unit text,
  net_cents bigint CHECK (net_cents>=0),
  rework boolean NOT NULL,
  valuation text NOT NULL CHECK (valuation IN ('captured','nachberechnet')),
  price_source jsonb NOT NULL CHECK (jsonb_typeof(price_source)='object'),
  reverses_event_id text,
  PRIMARY KEY(event_id,item_id),
  FOREIGN KEY(reverses_event_id,item_id) REFERENCES private.order_production_snapshots(event_id,item_id) ON DELETE RESTRICT,
  CHECK ((direction=1 AND reverses_event_id IS NULL) OR (direction=-1 AND reverses_event_id IS NOT NULL)),
  CHECK (NOT rework OR (net_cents IS NOT NULL AND net_cents=0))
);
CREATE UNIQUE INDEX order_production_one_reversal ON private.order_production_snapshots(reverses_event_id,item_id) WHERE direction=-1;
CREATE INDEX order_production_week ON private.order_production_snapshots(tenant_id,occurred_at,order_id);
ALTER TABLE private.order_production_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_production_tenant ON private.order_production_snapshots
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),''))
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),''));
REVOKE ALL ON private.order_production_snapshots FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON private.order_production_snapshots TO service_role;

CREATE FUNCTION private.guard_order_production_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,private AS $$
DECLARE source public.events%ROWTYPE; original private.order_production_snapshots%ROWTYPE;
BEGIN
 SELECT * INTO source FROM public.events WHERE id=NEW.event_id;
 IF NOT FOUND OR source.tenant_id IS DISTINCT FROM NEW.tenant_id OR source.order_id IS DISTINCT FROM NEW.order_id
  OR source.created_at IS DISTINCT FROM NEW.occurred_at OR source.status IS DISTINCT FROM 'success' OR source.user_id IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.items WHERE id=NEW.item_id AND order_id=NEW.order_id AND tenant_id=NEW.tenant_id)
  OR (source.event_type='ORDER_ITEM_FINISHED_CHANGED_V1' AND source.item_id=NEW.item_id AND
   (source.payload->>'finished')::boolean=(NEW.direction=1)
   OR source.event_type='ORDER_FROZEN_V1' AND NEW.direction=1
   OR source.event_type='ORDER_FREEZE_CORRECTED_V1' AND NEW.direction=-1) IS NOT TRUE
 THEN RAISE EXCEPTION 'ORDER_PRODUCTION_EVENT_SOURCE_INVALID'; END IF;
 IF NEW.direction=1 AND EXISTS(
  SELECT 1 FROM private.order_production_snapshots positive
  WHERE positive.tenant_id=NEW.tenant_id AND positive.item_id=NEW.item_id AND positive.direction=1
   AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.reverses_event_id=positive.event_id AND negative.item_id=positive.item_id)
 ) THEN RAISE EXCEPTION 'ORDER_PRODUCTION_ALREADY_COUNTED'; END IF;
 IF NEW.direction=-1 THEN
  SELECT * INTO original FROM private.order_production_snapshots WHERE event_id=NEW.reverses_event_id AND item_id=NEW.item_id;
  IF NOT FOUND OR original.direction<>1 OR original.tenant_id IS DISTINCT FROM NEW.tenant_id OR original.order_id IS DISTINCT FROM NEW.order_id
   OR original.quantity IS DISTINCT FROM NEW.quantity OR original.unit IS DISTINCT FROM NEW.unit OR original.net_cents IS DISTINCT FROM NEW.net_cents
   OR original.rework IS DISTINCT FROM NEW.rework OR original.valuation IS DISTINCT FROM NEW.valuation OR original.price_source IS DISTINCT FROM NEW.price_source
  THEN RAISE EXCEPTION 'ORDER_PRODUCTION_REVERSAL_SOURCE_INVALID'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_order_production_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER order_production_source BEFORE INSERT ON private.order_production_snapshots FOR EACH ROW EXECUTE FUNCTION private.guard_order_production_snapshot();
CREATE TRIGGER order_production_immutable BEFORE UPDATE OR DELETE ON private.order_production_snapshots FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
