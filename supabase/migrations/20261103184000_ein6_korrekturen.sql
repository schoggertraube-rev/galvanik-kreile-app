-- AP-EIN Teil 6, frozen Runde 51. Local replay until planning review + Owner merge.
ALTER TABLE public.orders
 ADD COLUMN pickup_by_name text CHECK (pickup_by_name IS NULL OR length(btrim(pickup_by_name)) BETWEEN 1 AND 160),
 ADD COLUMN pickup_by_note text CHECK (pickup_by_note IS NULL OR length(pickup_by_note)<=120),
 ADD COLUMN pickup_by_source text CHECK (pickup_by_source IS NULL OR pickup_by_source IN ('mail','telefon','persoenlich','notiz')),
 ADD COLUMN pickup_by_at timestamptz,
 ADD COLUMN pickup_by_login uuid REFERENCES public.app_users(id),
 ADD COLUMN ausgabe_frei boolean NOT NULL DEFAULT false;

-- Provider names and initial formats are data, never fallbacks in product code.
ALTER TABLE public.company_settings
 ADD COLUMN versand_dienst text NOT NULL DEFAULT 'DPD' CHECK (length(btrim(versand_dienst)) BETWEEN 1 AND 40),
 ADD COLUMN versand_nummer_format text NOT NULL DEFAULT E'^\\d{14}$' CHECK (length(versand_nummer_format)<=160),
 ADD COLUMN versand_nummer_hinweis text NOT NULL DEFAULT '14 Ziffern' CHECK (length(versand_nummer_hinweis)<=160),
 ADD COLUMN versand_verfolgung_url text CHECK (versand_verfolgung_url IS NULL OR length(versand_verfolgung_url)<=1000),
 ADD COLUMN versand_label_api text;

-- One persisted release fact. It is calculated from existing freeze/payment receipts,
-- after their entire transaction has completed. No customer-agreement substitute.
CREATE FUNCTION private.refresh_order_ausgabe_frei(p_tenant text,p_order text) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $fn$
DECLARE v_allowed boolean;
BEGIN
 SELECT orders.station::text='fertig' AND orders.status::text='fertig'
   AND EXISTS(SELECT 1 FROM private.v_order_freeze_state_v1 freeze_state
     WHERE freeze_state.tenant_id=p_tenant AND freeze_state.order_id=orders.id AND freeze_state.active AND freeze_state.integrity_ok)
   AND (orders.payment_mode='rechnung' OR EXISTS(
     SELECT 1 FROM private.v_payment_summary_v1 payment WHERE payment.tenant_id=p_tenant
       AND payment.order_id=orders.id AND payment.integrity_ok
       AND payment.payment_status='bezahlt' AND payment.payment_open_amount_cents=0))
 INTO v_allowed FROM public.orders orders WHERE orders.tenant_id=p_tenant AND orders.id=p_order;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.orders SET ausgabe_frei=v_allowed
 WHERE tenant_id=p_tenant AND id=p_order AND ausgabe_frei IS DISTINCT FROM v_allowed;
END; $fn$;
REVOKE ALL ON FUNCTION private.refresh_order_ausgabe_frei(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.refresh_order_ausgabe_frei(text,text) TO service_role;

CREATE FUNCTION private.sync_order_ausgabe_frei() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF TG_TABLE_NAME='orders' THEN
  IF TG_OP='UPDATE' AND NEW.station IS NOT DISTINCT FROM OLD.station AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.payment_mode IS NOT DISTINCT FROM OLD.payment_mode THEN RETURN NULL; END IF;
  PERFORM private.refresh_order_ausgabe_frei(NEW.tenant_id,NEW.id);
 ELSE
  IF NEW.order_id IS NOT NULL THEN PERFORM private.refresh_order_ausgabe_frei(NEW.tenant_id,NEW.order_id); END IF;
 END IF;
 RETURN NULL;
END; $fn$;
REVOKE ALL ON FUNCTION private.sync_order_ausgabe_frei() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.sync_order_ausgabe_frei() TO service_role;
CREATE CONSTRAINT TRIGGER orders_ausgabe_frei_sync AFTER INSERT OR UPDATE ON public.orders
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.sync_order_ausgabe_frei();
CREATE CONSTRAINT TRIGGER events_ausgabe_frei_sync AFTER INSERT ON public.events
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.sync_order_ausgabe_frei();

-- Existing finished orders are evaluated using their real tenant-bound receipts.
DO $backfill$
DECLARE candidate record; previous_tenant text:=current_setting('app.tenant_id',true);
BEGIN
 FOR candidate IN SELECT tenant_id,id FROM public.orders WHERE station::text='fertig' LOOP
  PERFORM set_config('app.tenant_id',candidate.tenant_id,true);
  PERFORM private.refresh_order_ausgabe_frei(candidate.tenant_id,candidate.id);
 END LOOP;
 PERFORM set_config('app.tenant_id',coalesce(previous_tenant,''),true);
END; $backfill$;

-- P56: expose the existing release fact through the canonical tenant-bound queue.
CREATE OR REPLACE VIEW private.v_operational_station_queue_v1
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.tenant_id,
  o.version,
  o.order_number,
  o.customer_id,
  c.name AS customer_name,
  o.title,
  o.task,
  o.station,
  o.current_station,
  o.current_station_id,
  o.status,
  o.priority_computed AS risk,
  o.intake_date,
  o.due_date,
  o.created_at,
  (
    c.id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.items corrupt_item
      WHERE corrupt_item.order_id = o.id
        AND (
          corrupt_item.tenant_id IS DISTINCT FROM o.tenant_id
          OR corrupt_item.customer_id IS DISTINCT FROM o.customer_id
        )
    )
  ) AS tenant_integrity_ok,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'tenantId', i.tenant_id,
        'orderId', i.order_id,
        'customerId', i.customer_id,
        'name', i.name,
        'quantity', i.quantity,
        'currentStationId', i.current_station_id,
        'material', i.material,
        'surfaceRequested', i.surface_requested,
        'photoIds', i.photo_ids,
        'photo', i.photo,
        'repairTypes', i.repair_types,
        'stationSequence', i.station_sequence,
        'currentStep', i.current_step,
        'internalNotes', i.internal_notes,
        'catalogServiceId', i.catalog_service_id,
        'standardLeadTimeWorkingDays', catalog.standard_lead_time_working_days,
        'createdAt', i.created_at
      )
      ORDER BY i.created_at, i.id
    ) FILTER (WHERE i.id IS NOT NULL),
    '[]'::jsonb
  ) AS parts,
  o.ausgabe_frei
FROM public.orders o
LEFT JOIN public.customers c
  ON c.id = o.customer_id
 AND c.tenant_id = o.tenant_id
LEFT JOIN public.items i
  ON i.order_id = o.id
 AND i.tenant_id = o.tenant_id
 AND i.customer_id = o.customer_id
LEFT JOIN public.catalog_services catalog
  ON catalog.id = i.catalog_service_id
 AND catalog.tenant_id = i.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND o.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND coalesce(o.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
  AND coalesce(o.order_number, '') NOT ILIKE 'A-SEED-%'
  AND coalesce(o.order_number, '') NOT ILIKE '%TEST%'
GROUP BY
  o.id,
  o.tenant_id,
  o.version,
  o.order_number,
  o.customer_id,
  c.id,
  c.name,
  o.title,
  o.task,
  o.station,
  o.current_station,
  o.current_station_id,
  o.status,
  o.priority_computed,
  o.intake_date,
  o.due_date,
  o.created_at;
