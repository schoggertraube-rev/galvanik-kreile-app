-- B3-a: Ein Preisbeleg je Befehl, eine unveränderliche Nachbewertung je Buchung.
ALTER TABLE public.material_prices
  ADD COLUMN befehl_id uuid,
  ADD COLUMN preiseinheit text CHECK (preiseinheit IN ('stk','paar','ml','l','g','kg','mm','cm','m')),
  ADD CONSTRAINT material_prices_lager_befehl_einheit_chk CHECK ((befehl_id IS NULL) = (preiseinheit IS NULL)),
  ADD CONSTRAINT material_prices_lager_befehl_key UNIQUE (tenant_id, befehl_id);

CREATE FUNCTION private.lager_preisbefehl_schuetzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  IF NEW.befehl_id IS DISTINCT FROM OLD.befehl_id OR NEW.preiseinheit IS DISTINCT FROM OLD.preiseinheit
    OR (OLD.befehl_id IS NOT NULL AND ROW(NEW.tenant_id, NEW.artikel_id, NEW.einzelpreis)
      IS DISTINCT FROM ROW(OLD.tenant_id, OLD.artikel_id, OLD.einzelpreis)) THEN
    RAISE EXCEPTION 'LAGER_PREISBEFEHL_UNVERAENDERLICH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$funktion$;
REVOKE ALL ON FUNCTION private.lager_preisbefehl_schuetzen() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER material_prices_lager_preisbefehl_schuetzen BEFORE UPDATE ON public.material_prices
  FOR EACH ROW EXECUTE FUNCTION private.lager_preisbefehl_schuetzen();

CREATE OR REPLACE FUNCTION private.lager_kalkulationsbasis(p_artikel text, p_fachzeit timestamptz, p_methode text)
RETURNS TABLE (preisquelle_id uuid, einzelpreis numeric)
LANGUAGE plpgsql STABLE SET search_path = '' AS $funktion$
BEGIN
  IF p_methode IS NULL OR p_methode NOT IN ('letzter_ek','gleitender_durchschnitt','hoechster_ek') THEN
    RAISE EXCEPTION 'LAGER_KALKULATIONSREGEL_FEHLT' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH gueltige_preise AS (
    SELECT preis.id, preis.einzelpreis, preis.gueltig_ab, preis.bestaetigt_am,
      preis.erfasst_am, preis.beleg_id, preis.tenant_id
    FROM public.material_prices preis
    JOIN public.inventory_items artikel ON artikel.tenant_id = preis.tenant_id AND artikel.id = preis.artikel_id
    WHERE preis.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
      AND preis.artikel_id = p_artikel AND preis.waehrung = 'EUR'
      AND (preis.preiseinheit IS NULL OR preis.preiseinheit = artikel.basiseinheit)
      AND preis.bestaetigt_am <= p_fachzeit AND preis.gueltig_ab <= p_fachzeit
      AND preis.storniert_am IS NULL AND preis.fehlpreis_am IS NULL
  ), preisquelle AS (
    SELECT preis.id, preis.einzelpreis
    FROM gueltige_preise preis
    ORDER BY
      CASE WHEN p_methode = 'hoechster_ek' THEN preis.einzelpreis END DESC,
      preis.gueltig_ab DESC,
      CASE WHEN p_methode <> 'hoechster_ek' THEN preis.bestaetigt_am END DESC,
      preis.erfasst_am DESC,
      CASE WHEN p_methode = 'hoechster_ek' THEN preis.id END,
      CASE WHEN p_methode <> 'hoechster_ek' THEN preis.id END DESC
    LIMIT 1
  )
  SELECT quelle.id,
    CASE WHEN p_methode = 'gleitender_durchschnitt' THEN (
      SELECT round(coalesce(
        sum(preis.einzelpreis * gewicht.menge) / nullif(sum(gewicht.menge), 0),
        avg(preis.einzelpreis)
      ), 6)
      FROM gueltige_preise preis
      CROSS JOIN LATERAL (
        SELECT sum(bewegung.quantity) AS menge
        FROM public.stock_movements bewegung
        WHERE bewegung.tenant_id = preis.tenant_id
          AND bewegung.inventory_item_id = p_artikel
          AND bewegung.beleg_id = preis.beleg_id
          AND bewegung.movement_type = 'stock_in'
          AND bewegung.geschaeftsgrund = 'wareneingang'
          AND bewegung.fachzeit <= p_fachzeit
          AND NOT EXISTS (SELECT 1 FROM public.stock_movements g WHERE g.tenant_id = bewegung.tenant_id AND g.gegenbuchung_id = bewegung.id)
      ) gewicht
    ) ELSE quelle.einzelpreis END
  FROM preisquelle quelle;
END;
$funktion$;

CREATE TABLE public.lager_material_nachbewertungen (
  tenant_id text NOT NULL,
  event_id uuid NOT NULL,
  artikel_id text NOT NULL,
  befehl_id uuid NOT NULL,
  preisquelle_id uuid NOT NULL,
  kalk_ek numeric NOT NULL CHECK (kalk_ek >= 0 AND kalk_ek < 1000000000000),
  aufschlag_pct numeric NOT NULL CHECK (aufschlag_pct >= 0 AND aufschlag_pct < 10000),
  regel_version text NOT NULL CHECK (btrim(regel_version) <> ''),
  PRIMARY KEY (tenant_id, event_id),
  FOREIGN KEY (tenant_id, artikel_id, event_id)
    REFERENCES public.stock_movements (tenant_id, inventory_item_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, artikel_id, preisquelle_id)
    REFERENCES public.material_prices (tenant_id, artikel_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, befehl_id)
    REFERENCES public.material_prices (tenant_id, befehl_id) ON DELETE RESTRICT
);

ALTER TABLE public.lager_material_nachbewertungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY lager_mandant ON public.lager_material_nachbewertungen
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));
REVOKE ALL ON public.lager_material_nachbewertungen FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.lager_material_nachbewertungen TO service_role;

CREATE TRIGGER lager_material_nachbewertungen_unveraenderlich
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.lager_material_nachbewertungen
  FOR EACH STATEMENT EXECUTE FUNCTION private.lager_journal_unveraenderlich();

CREATE FUNCTION private.lager_material_rechnung(p_auftraege text[])
RETURNS TABLE (auftrag_id text, rechnungsnummer text, event_ids uuid[])
LANGUAGE sql STABLE SET search_path = '' AS $funktion$
  SELECT mitglied.order_id, rechnung.invoice_number::text, ARRAY(
    SELECT ereignis.value::uuid
    FROM jsonb_array_elements(rechnung.snapshot->'lines') zeile
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN zeile->>'type' = 'MATERIAL' AND zeile->>'sourceOrderId' = mitglied.order_id
        THEN zeile->'eventIds' ELSE '[]'::jsonb END
    ) ereignis
  )
  FROM private.v_invoice_order_members_v1 mitglied
  JOIN public.invoices rechnung ON rechnung.tenant_id = mitglied.tenant_id AND rechnung.id = mitglied.invoice_id
  WHERE mitglied.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND mitglied.order_id = ANY(p_auftraege) AND rechnung.contract_version = 1
    AND rechnung.status = 'issued' AND (rechnung.belegart = 'auftrag' OR mitglied.collection_id IS NOT NULL)
$funktion$;
REVOKE ALL ON FUNCTION private.lager_material_rechnung(text[]) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.lager_material_rechnung_sperren() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE nummer text;
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '') THEN
    RAISE EXCEPTION 'LAGER_KALKULATION_MANDANT_FEHLT' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('f1:invoice:order:' || NEW.tenant_id || ':' || NEW.order_id, 0));

  IF NEW.movement_type = 'reversal' THEN
    SELECT rechnungsnummer INTO nummer FROM private.lager_material_rechnung(ARRAY[NEW.order_id])
    WHERE NEW.gegenbuchung_id = ANY(event_ids);
    IF FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'LAGER_RECHNUNG_AUSGESTELLT', DETAIL = nummer;
    END IF;
  ELSIF NEW.lagerwirksam AND NEW.quantity < 0 AND (
    NEW.movement_type IN ('stock_out', 'consumption', 'waste')
    OR (NEW.movement_type = 'move' AND NEW.geschaeftsgrund = 'umlagerung')
  ) THEN
    SELECT rechnungsnummer INTO nummer FROM private.lager_material_rechnung(ARRAY[NEW.order_id]);
    IF FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'LAGER_AUFTRAG_BERECHNET', DETAIL = nummer;
    END IF;
  END IF;
  RETURN NEW;
END;
$funktion$;
REVOKE ALL ON FUNCTION private.lager_material_rechnung_sperren() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER stock_movements_lager_rechnung_sperren
  BEFORE INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION private.lager_material_rechnung_sperren();

-- Der vorhandene Auslöser entwertet den Tagesstand der betroffenen Betriebe.
DO $install$
DECLARE quelle regclass;
BEGIN
  FOREACH quelle IN ARRAY ARRAY[
    'public.stock_movements'::regclass, 'public.material_prices'::regclass,
    'public.inventory_sessions'::regclass, 'public.inventory_counts'::regclass,
    'public.inventory_lines'::regclass, 'public.lager_material_nachbewertungen'::regclass,
    'private.quote_create_receipts'::regclass, 'private.quote_number_counters'::regclass
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS today_mark_insert_v1 ON %s', quelle);
    EXECUTE format('DROP TRIGGER IF EXISTS today_mark_update_v1 ON %s', quelle);
    EXECUTE format('DROP TRIGGER IF EXISTS today_mark_delete_v1 ON %s', quelle);
    EXECUTE format('CREATE TRIGGER today_mark_insert_v1 AFTER INSERT ON %s REFERENCING NEW TABLE AS today_new FOR EACH STATEMENT EXECUTE FUNCTION private.today_mark_inventory_items_v1()', quelle);
    EXECUTE format('CREATE TRIGGER today_mark_update_v1 AFTER UPDATE ON %s REFERENCING OLD TABLE AS today_old NEW TABLE AS today_new FOR EACH STATEMENT EXECUTE FUNCTION private.today_mark_inventory_items_v1()', quelle);
    EXECUTE format('CREATE TRIGGER today_mark_delete_v1 AFTER DELETE ON %s REFERENCING OLD TABLE AS today_old FOR EACH STATEMENT EXECUTE FUNCTION private.today_mark_inventory_items_v1()', quelle);
  END LOOP;
END
$install$;

-- Materialpositionen im bestehenden Rechnungsoriginal und USt-Vertrag.
CREATE OR REPLACE FUNCTION private.invoice_collection_snapshot_valid(original jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $function$
DECLARE collection jsonb; member jsonb; line jsonb; ref jsonb; members jsonb; seen_orders text[]:=ARRAY[]::text[]; seen_freezes text[]:=ARRAY[]::text[]; seen_shipments text[]:=ARRAY[]::text[]; seen_items text[]:=ARRAY[]::text[]; base_orders text[]:=ARRAY[]::text[]; refs text[]; order_key text; day date;
BEGIN
 IF original->'schemaVersion' IS DISTINCT FROM '3'::jsonb OR original->'order' IS DISTINCT FROM 'null'::jsonb OR original->'serviceDate' IS DISTINCT FROM 'null'::jsonb THEN RETURN false; END IF;
 collection:=original->'collection';
 IF jsonb_typeof(collection) IS DISTINCT FROM 'object' OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(collection) key) IS DISTINCT FROM ARRAY['collectionId','members','month','version']::text[] THEN RETURN false; END IF;
 IF NOT coalesce(collection->>'collectionId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',false)
 OR jsonb_typeof(collection->'version') IS DISTINCT FROM 'number' OR NOT coalesce(collection->>'version' ~ '^[1-9][0-9]*$',false)
 OR NOT coalesce(collection->>'month' ~ '^[0-9]{4}-[0-9]{2}-01$',false) THEN RETURN false; END IF;
 IF (collection->>'version')::bigint>2147483647 THEN RETURN false; END IF;
 day:=(collection->>'month')::date;
 IF to_char(day,'YYYY-MM-DD') IS DISTINCT FROM collection->>'month' THEN RETURN false; END IF;
 members:=collection->'members';
 IF jsonb_typeof(members) IS DISTINCT FROM 'array' OR jsonb_array_length(members)=0 THEN RETURN false; END IF;
 FOR member IN SELECT value FROM jsonb_array_elements(members) LOOP
  IF jsonb_typeof(member) IS DISTINCT FROM 'object' OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(member) key) IS DISTINCT FROM ARRAY['freezeId','orderId','orderNumber','orderVersion','serviceDate','title']::text[] THEN RETURN false; END IF;
  IF jsonb_typeof(member->'orderId') IS DISTINCT FROM 'string' OR length(member->>'orderId') NOT BETWEEN 1 AND 128 OR btrim(member->>'orderId') IS DISTINCT FROM member->>'orderId'
  OR jsonb_typeof(member->'orderNumber') IS DISTINCT FROM 'string' OR btrim(member->>'orderNumber')='' OR jsonb_typeof(member->'title') IS DISTINCT FROM 'string' OR btrim(member->>'title')=''
  OR jsonb_typeof(member->'orderVersion') IS DISTINCT FROM 'number' OR NOT coalesce(member->>'orderVersion' ~ '^[1-9][0-9]*$',false)
  OR NOT coalesce(member->>'freezeId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',false)
  OR NOT coalesce(member->>'serviceDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',false) THEN RETURN false; END IF;
  IF (member->>'orderVersion')::bigint>2147483647 OR member->>'orderId'=ANY(seen_orders) OR member->>'freezeId'=ANY(seen_freezes) THEN RETURN false; END IF;
  day:=(member->>'serviceDate')::date;
  IF to_char(day,'YYYY-MM-DD') IS DISTINCT FROM member->>'serviceDate' THEN RETURN false; END IF;
  seen_orders:=array_append(seen_orders,member->>'orderId');seen_freezes:=array_append(seen_freezes,member->>'freezeId');
 END LOOP;
 IF jsonb_typeof(original->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(original->'lines')=0 THEN RETURN false; END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(original->'lines') LOOP
  IF line->>'type'='SHIPPING' THEN
   IF line ? 'sourceOrderId' OR jsonb_typeof(line->'sourceOrderIds') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'sourceOrderIds')=0 OR jsonb_typeof(line->'shipmentGroupId') IS DISTINCT FROM 'string' OR btrim(line->>'shipmentGroupId')='' OR line->>'shipmentGroupId'=ANY(seen_shipments) THEN RETURN false; END IF;
   seen_shipments:=array_append(seen_shipments,line->>'shipmentGroupId');refs:=ARRAY[]::text[];
   FOR ref IN SELECT value FROM jsonb_array_elements(line->'sourceOrderIds') LOOP
    order_key:=ref#>>'{}';
    IF jsonb_typeof(ref) IS DISTINCT FROM 'string' OR NOT coalesce(order_key=ANY(seen_orders),false) OR order_key=ANY(refs) THEN RETURN false; END IF;
    refs:=array_append(refs,order_key);
   END LOOP;
  ELSIF line->>'type' IN ('BASE','EXTRA_WORK','MATERIAL') THEN
   IF line ? 'sourceOrderIds' OR jsonb_typeof(line->'sourceOrderId') IS DISTINCT FROM 'string' OR NOT coalesce(line->>'sourceOrderId'=ANY(seen_orders),false) THEN RETURN false; END IF;
   IF line->>'type'='BASE' THEN
    order_key:=(line->>'sourceOrderId')||':'||(line->>'itemId');
    IF jsonb_typeof(line->'itemId') IS DISTINCT FROM 'string' OR btrim(line->>'itemId')='' OR order_key=ANY(seen_items) THEN RETURN false; END IF;
    seen_items:=array_append(seen_items,order_key);base_orders:=array_append(base_orders,line->>'sourceOrderId');
   END IF;
  ELSE RETURN false; END IF;
 END LOOP;
 RETURN seen_orders <@ base_orders;
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$function$;
REVOKE ALL ON FUNCTION private.invoice_collection_snapshot_valid(jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.invoice_original_source_valid(tenant text,customer text,order_key text,order_version integer,expected_freeze uuid,service_day date,original jsonb,issue_time timestamptz)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path='' AS $function$
DECLARE member jsonb; collection jsonb;
BEGIN
 IF NOT original ? 'collection' THEN
  RETURN coalesce(order_key IS NOT NULL AND order_version>0 AND expected_freeze IS NOT NULL AND service_day IS NOT NULL
   AND jsonb_typeof(original->'order')='object'
   AND (original->'order') ?& ARRAY['orderId','orderVersion','orderNumber','title','freezeId']
   AND jsonb_typeof(original#>'{order,orderId}')='string' AND original#>>'{order,orderId}'=order_key
   AND jsonb_typeof(original#>'{order,orderVersion}')='number' AND (original#>>'{order,orderVersion}')::numeric=order_version
   AND jsonb_typeof(original#>'{order,freezeId}')='string' AND original#>>'{order,freezeId}'=expected_freeze::text
   AND jsonb_typeof(original#>'{order,orderNumber}')='string' AND btrim(original#>>'{order,orderNumber}')<>''
   AND jsonb_typeof(original#>'{order,title}')='string' AND btrim(original#>>'{order,title}')<>''
   AND jsonb_typeof(original->'serviceDate')='string' AND original->>'serviceDate'=to_char(service_day,'YYYY-MM-DD')
   AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(original->'lines')='array'
      THEN original->'lines' ELSE '[]'::jsonb END) line
    WHERE line->>'type'='MATERIAL' AND line->>'sourceOrderId' IS DISTINCT FROM order_key
   ),false);
 END IF;
 IF order_key IS NOT NULL OR order_version IS NOT NULL OR expected_freeze IS NOT NULL OR service_day IS NOT NULL OR NOT private.invoice_collection_snapshot_valid(original) THEN RETURN false; END IF;
 collection:=original->'collection';
 IF NOT EXISTS(SELECT 1 FROM public.invoice_collections source WHERE source.id=(collection->>'collectionId')::uuid AND source.tenant_id=tenant AND source.customer_id=customer AND source.monat=(collection->>'month')::date AND source.version IN ((collection->>'version')::integer,(collection->>'version')::integer+1)) THEN RETURN false; END IF;
 FOR member IN SELECT value FROM jsonb_array_elements(collection->'members') LOOP
  IF NOT EXISTS(SELECT 1 FROM private.v_order_freeze_state_v1 source
   WHERE source.tenant_id=tenant AND source.order_id=member->>'orderId' AND source.freeze_id=(member->>'freezeId')::uuid AND source.integrity_ok=true
    AND source.order_version<=(member->>'orderVersion')::integer AND source.frozen_at<=issue_time
    AND to_char(source.frozen_at AT TIME ZONE 'Europe/Berlin','YYYY-MM-DD')=member->>'serviceDate') THEN RETURN false; END IF;
  IF 1<>(SELECT count(*) FROM public.events handover WHERE handover.tenant_id::text=tenant AND handover.order_id=member->>'orderId'
   AND handover.event_type='ORDER_PICKED_UP_V3' AND handover.event_schema_version=3 AND handover.status='success'
   AND handover.station='abgeholt' AND handover.from_station='fertig' AND handover.payload->>'orderId'=member->>'orderId'
   AND handover.payload->>'settlement'='collection' AND handover.payload->>'agreementType'='sammelrechnung'
   -- The immutable V3 physical source follows the existing parseEvent contract:
   -- exact keys, typed agreement/N5/actor identity, genuine physical transition.
   AND (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(handover.payload) key)=ARRAY['agreementId','agreementType','agreementVersion','gateAllowed','mode','orderId','orderVersion','paymentMode','settlement']::text[]
   AND handover.payload->'gateAllowed'='true'::jsonb AND handover.payload->>'mode' IN ('versand','abholung') AND handover.payload->>'paymentMode'='rechnung'
   AND handover.payload->>'agreementId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
   AND jsonb_typeof(handover.payload->'agreementVersion')='number' AND handover.payload->>'agreementVersion' ~ '^[1-9][0-9]*$'
   AND jsonb_typeof(handover.payload->'orderVersion')='number' AND handover.payload->>'orderVersion' ~ '^[1-9][0-9]*$'
   AND handover.client_event_id IS NOT NULL AND handover.correlation_id IS NOT NULL
   AND handover.aggregate_version=(handover.payload->>'orderVersion')::integer AND handover.aggregate_version<=(member->>'orderVersion')::integer
   AND handover.created_at AT TIME ZONE 'UTC'<=issue_time AND to_char(handover.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin','YYYY-MM-01')=collection->>'month'
   AND EXISTS(SELECT 1 FROM private.order_freezes frozen WHERE frozen.tenant_id=tenant AND frozen.id=(member->>'freezeId')::uuid AND frozen.order_id=handover.order_id AND frozen.order_version<handover.aggregate_version AND frozen.frozen_at<=handover.created_at AT TIME ZONE 'UTC')
   AND EXISTS(SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=tenant AND actor.id=handover.user_id)) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$function$;
REVOKE ALL ON FUNCTION private.invoice_original_source_valid(text,text,text,integer,uuid,date,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.invoice_original_vat_valid(original jsonb, net bigint, head_rate integer, vat bigint, gross bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE totals jsonb; line jsonb; grp jsonb; rates integer[] := ARRAY[]::integer[];
 rate integer; line_net numeric; group_net numeric; group_vat numeric;
 sum_net numeric := 0; sum_vat numeric := 0; sum_gross numeric := 0;
 original_v3 boolean := original->'schemaVersion' IS NOT DISTINCT FROM '3'::jsonb;
 movement jsonb; movement_id text; material_events text[] := ARRAY[]::text[];
BEGIN
 -- The frozen original is untouched. Only already qualified collection-source
 -- metadata is removed from this local VAT-validation projection, exactly like
 -- the existing v3 unit metadata; financial rules/calculations stay unchanged.
 IF original ? 'collection' THEN
  IF NOT private.invoice_collection_snapshot_valid(original) THEN RETURN false; END IF;
  original:=jsonb_set(original,'{lines}',(SELECT jsonb_agg(CASE WHEN value->>'type'='MATERIAL' THEN value
    ELSE value-ARRAY['sourceOrderId','sourceOrderIds']::text[] END ORDER BY ordinal) FROM jsonb_array_elements(original->'lines') WITH ORDINALITY AS element(value,ordinal)));
 END IF;
 IF original->'schemaVersion'='3'::jsonb THEN
  IF jsonb_typeof(original->'seller') IS DISTINCT FROM 'object'
   OR original->'seller' ? 'taxId'
   OR NOT COALESCE(jsonb_typeof(original->'seller'->'vatId') IN ('string','null'),false)
   OR NOT COALESCE(jsonb_typeof(original->'seller'->'taxNumber') IN ('string','null'),false)
   OR COALESCE(NULLIF(btrim(original->'seller'->>'vatId'),''),NULLIF(btrim(original->'seller'->>'taxNumber'),'')) IS NULL
   OR jsonb_typeof(original->'lines') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(original->'lines') LOOP
   IF line ? 'unitSource' AND (
      line->>'type' IS DISTINCT FROM 'BASE'
      OR line->'unitSource' IS DISTINCT FROM '"default_piece"'::jsonb
      OR line->'unit' IS DISTINCT FROM '"C62"'::jsonb
      OR jsonb_typeof(line->'itemId') IS DISTINCT FROM 'string'
      OR NULLIF(btrim(line->>'itemId'),'') IS NULL
      OR jsonb_typeof(line->'quantity') IS DISTINCT FROM 'number'
      OR COALESCE((line->>'quantity')::numeric<=0
        OR (line->>'quantity')::numeric<>trunc((line->>'quantity')::numeric),true)
    ) THEN RETURN false; END IF;
   IF line->'taxCategory' IS DISTINCT FROM to_jsonb(CASE WHEN line->>'vat_rate_basis_points'='0' THEN 'AE'::text ELSE 'S'::text END)
    OR (line->>'taxCategory'='AE' AND NULLIF(btrim(original->'seller'->>'vatId'),'') IS NULL) THEN RETURN false; END IF;
   IF line->>'type'='MATERIAL' THEN
    IF jsonb_typeof(line) IS DISTINCT FROM 'object'
     OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(line) key)
         IS DISTINCT FROM ARRAY['articleId','eventIds','lineNetAmountCents','name','quantity','sourceOrderId','taxCategory','type','unit','unitNetAmount','vat_rate_basis_points']
     OR jsonb_typeof(line->'articleId') IS DISTINCT FROM 'string' OR NULLIF(btrim(line->>'articleId'),'') IS NULL
     OR jsonb_typeof(line->'name') IS DISTINCT FROM 'string' OR NULLIF(btrim(line->>'name'),'') IS NULL
     OR jsonb_typeof(line->'sourceOrderId') IS DISTINCT FROM 'string' OR NULLIF(btrim(line->>'sourceOrderId'),'') IS NULL
     OR NOT coalesce(line->>'unit' IN ('C62','PR','MLT','LTR','GRM','KGM','MMT','CMT','MTR'),false)
     OR jsonb_typeof(line->'quantity') IS DISTINCT FROM 'string'
     OR NOT coalesce(line->>'quantity' ~ '^(0|[1-9][0-9]*)([.][0-9]{1,3})?$',false)
     OR jsonb_typeof(line->'unitNetAmount') IS DISTINCT FROM 'string'
     OR NOT coalesce(line->>'unitNetAmount' ~ '^(0|[1-9][0-9]*)[.][0-9]{4}$',false)
     OR jsonb_typeof(line->'lineNetAmountCents') IS DISTINCT FROM 'number'
     OR jsonb_typeof(line->'eventIds') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
    IF (line->>'quantity')::numeric<=0
     OR (line->>'lineNetAmountCents')::numeric IS DISTINCT FROM round((line->>'quantity')::numeric*(line->>'unitNetAmount')::numeric*100)
     OR (line->>'lineNetAmountCents')::numeric>9007199254740991
     OR jsonb_array_length(line->'eventIds')=0 THEN RETURN false; END IF;
    FOR movement IN SELECT value FROM jsonb_array_elements(line->'eventIds') LOOP
     movement_id:=movement#>>'{}';
     IF jsonb_typeof(movement) IS DISTINCT FROM 'string'
      OR NOT coalesce(movement_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$',false)
      OR movement_id=ANY(material_events) THEN RETURN false; END IF;
     material_events:=array_append(material_events,movement_id);
    END LOOP;
   ELSIF line->>'unit' IS NULL OR line->>'unit' NOT IN ('C62','KGM','GRM','MTR','MTK','HUR','DMK','SET')
    OR (line->>'type'='EXTRA_WORK' AND line->>'unit'<>'HUR')
    OR (line->>'type'='SHIPPING' AND line->>'unit'<>'C62') THEN RETURN false; END IF;
  END LOOP;
  -- Validate v3 with the same existing VAT arithmetic. This is a local
  -- compatibility projection only, never a change to an original or source.
  -- Metadata has been validated above. Remove only the two v3-only keys
  -- in this local validation projection so the unchanged, strict v2 SHIPPING
  -- key-set check can inspect the same line. The stored original is untouched.
  original:=jsonb_set(original,'{lines}',(SELECT jsonb_agg(value-'unit'-'taxCategory'-'unitSource' ORDER BY ordinal)
   FROM jsonb_array_elements(original->'lines') WITH ORDINALITY AS entry(value,ordinal)));
  original:=jsonb_set(original,'{schemaVersion}','2'::jsonb);
  original:=jsonb_set(original,'{seller,taxId}',to_jsonb(COALESCE(NULLIF(btrim(original->'seller'->>'vatId'),''),NULLIF(btrim(original->'seller'->>'taxNumber'),''))));
 END IF;
 IF original IS NULL OR jsonb_typeof(original) IS DISTINCT FROM 'object' OR net IS NULL OR vat IS NULL OR gross IS NULL OR net<0 OR vat<0 OR gross<>net+vat THEN RETURN false; END IF;
 totals:=original->'totals';
 IF jsonb_typeof(totals) IS DISTINCT FROM 'object' OR jsonb_typeof(totals->'netAmountCents') IS DISTINCT FROM 'number' OR jsonb_typeof(totals->'vatAmountCents') IS DISTINCT FROM 'number' OR jsonb_typeof(totals->'grossAmountCents') IS DISTINCT FROM 'number'
 OR (totals->>'netAmountCents')::numeric<>net OR (totals->>'vatAmountCents')::numeric<>vat OR (totals->>'grossAmountCents')::numeric<>gross THEN RETURN false; END IF;
 IF original->'schemaVersion'='1'::jsonb THEN
  IF jsonb_path_exists(original,'$.lines[*] ? (@.type == "MATERIAL")') THEN RETURN false; END IF;
  RETURN COALESCE(head_rate IN (700,1900) AND jsonb_typeof(totals->'vatRateBasisPoints')='number' AND (totals->>'vatRateBasisPoints')::numeric=head_rate AND vat=round(net::numeric*head_rate/10000),false);
 END IF;
 IF original->'schemaVersion' IS DISTINCT FROM '2'::jsonb OR head_rate IS NOT NULL OR totals->'vatRateBasisPoints' IS DISTINCT FROM 'null'::jsonb
 OR jsonb_typeof(totals->'vatBreakdown') IS DISTINCT FROM 'array' OR jsonb_array_length(totals->'vatBreakdown')=0
 OR jsonb_typeof(original->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(original->'lines')=0 THEN RETURN false; END IF;
 FOR grp IN SELECT value FROM jsonb_array_elements(totals->'vatBreakdown') LOOP
  IF jsonb_typeof(grp) IS DISTINCT FROM 'object' OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(grp) key) IS DISTINCT FROM ARRAY['grossCents','netCents','rateBp','vatCents']
  OR jsonb_typeof(grp->'rateBp') IS DISTINCT FROM 'number' OR (grp->>'rateBp')::numeric NOT IN (0,700,1900)
  OR jsonb_typeof(grp->'netCents') IS DISTINCT FROM 'number' OR jsonb_typeof(grp->'vatCents') IS DISTINCT FROM 'number' OR jsonb_typeof(grp->'grossCents') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
  rate:=(grp->>'rateBp')::integer;
  IF rate=ANY(rates) THEN RETURN false; END IF;
  rates:=array_append(rates,rate); group_net:=0;
  FOR line IN SELECT value FROM jsonb_array_elements(original->'lines') LOOP
   IF jsonb_typeof(line) IS DISTINCT FROM 'object' OR jsonb_typeof(line->'vat_rate_basis_points') IS DISTINCT FROM 'number' OR (line->>'vat_rate_basis_points')::numeric NOT IN (0,700,1900) THEN RETURN false; END IF;
   IF line->>'type'='BASE' OR (original_v3 AND line->>'type'='MATERIAL') THEN
    IF jsonb_typeof(line->'lineNetAmountCents') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    line_net:=(line->>'lineNetAmountCents')::numeric;
   ELSIF line->>'type' IN ('EXTRA_WORK','SHIPPING') THEN
    IF line->>'type'='SHIPPING' AND (
     ((SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(line) key) IS DISTINCT FROM ARRAY['amountCents','name','shipmentGroupId','type','vat_rate_basis_points'] AND (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(line) key) IS DISTINCT FROM ARRAY['amountCents','name','shipmentGroupId','shippingKind','type','vat_rate_basis_points'])
     OR (line ? 'shippingKind' AND (line->>'shippingKind' NOT IN ('fee','reference') OR jsonb_typeof(line->'shippingKind') IS DISTINCT FROM 'string' OR (line->>'shippingKind'='reference' AND line->'amountCents' IS DISTINCT FROM '0'::jsonb)))
     OR jsonb_typeof(line->'shipmentGroupId') IS DISTINCT FROM 'string' OR NULLIF(btrim(line->>'shipmentGroupId'),'') IS NULL
     OR jsonb_typeof(line->'name') IS DISTINCT FROM 'string' OR NULLIF(btrim(line->>'name'),'') IS NULL
    ) THEN RETURN false; END IF;
    IF jsonb_typeof(line->'amountCents') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    line_net:=(line->>'amountCents')::numeric;
   ELSE RETURN false; END IF;
   IF line_net IS NULL OR line_net<0 OR line_net<>trunc(line_net) THEN RETURN false; END IF;
   IF (line->>'vat_rate_basis_points')::integer=rate THEN group_net:=group_net+line_net; END IF;
  END LOOP;
  group_vat:=round(group_net*rate/10000);
  IF (grp->>'netCents')::numeric<>group_net OR (grp->>'vatCents')::numeric<>group_vat OR (grp->>'grossCents')::numeric<>group_net+group_vat THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(original->'lines') item WHERE (item->>'vat_rate_basis_points')::integer=rate) THEN RETURN false; END IF;
  sum_net:=sum_net+group_net; sum_vat:=sum_vat+group_vat; sum_gross:=sum_gross+group_net+group_vat;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(original->'lines') item WHERE NOT ((item->>'vat_rate_basis_points')::integer=ANY(rates))) THEN RETURN false; END IF;
 IF 0=ANY(rates) THEN
  IF cardinality(rates)<>1 OR jsonb_typeof(original->'customer'->'country') IS DISTINCT FROM 'string' OR jsonb_typeof(original->'customer'->'vatId') IS DISTINCT FROM 'string' OR jsonb_typeof(original->'seller'->'taxId') IS DISTINCT FROM 'string' OR (original->'customer'->>'country') IS NULL OR NOT ((original->'customer'->>'country')=ANY(ARRAY['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']))
  OR NULLIF(btrim(original->'customer'->>'vatId'),'') IS NULL OR NULLIF(btrim(original->'seller'->>'taxId'),'') IS NULL THEN RETURN false; END IF;
 END IF;
 RETURN sum_net=net AND sum_vat=vat AND sum_gross=gross;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_parameter_value THEN RETURN false;
END $function$;

-- S09 übernimmt Grundpositionen und Mehrarbeit unverändert. Material kommt
-- beim Ersatz aus dem aktuellen Lagerjournal, Versandkosten entfallen weiter.
DO $migration$
DECLARE
  definition text;
  alte_zeilen constant text := $alt$WHERE line->>'type'<>'SHIPPING';$alt$;
  neuer_ursprung constant text := $neu$WHERE line->>'type' NOT IN ('SHIPPING','MATERIAL');$neu$;
  alter_vergleich constant text := $alt$NEW.snapshot->'lines' IS DISTINCT FROM goods$alt$;
  neuer_vergleich constant text := $neu$(
    SELECT jsonb_agg(line ORDER BY ordinal)
    FROM jsonb_array_elements(NEW.snapshot->'lines') WITH ORDINALITY source(line,ordinal)
    WHERE line->>'type' <> 'MATERIAL'
  ) IS DISTINCT FROM goods$neu$;
BEGIN
  definition := pg_get_functiondef('private.guard_invoice_reissue_original_v1()'::regprocedure);
  IF length(definition)-length(replace(definition,alte_zeilen,'')) <> length(alte_zeilen)
     OR length(definition)-length(replace(definition,alter_vergleich,'')) <> length(alter_vergleich) THEN
    RAISE EXCEPTION 'B3A_S09_ORIGINALPRUEFUNG_GEAENDERT';
  END IF;
  EXECUTE replace(replace(definition,alte_zeilen,neuer_ursprung),alter_vergleich,neuer_vergleich);
END
$migration$;
