-- S38a / PL19.11.14:47 and16:22: native collection original in the existing v3 invoice contract.
-- Same original, number allocator, fiscal source and immutable event ledger.
-- PL19.11.14:47 native collection branch in the existing invoice contract.
-- No new ledger, representative order, writer or number allocator.
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
  ELSIF line->>'type' IN ('BASE','EXTRA_WORK') THEN
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
GRANT EXECUTE ON FUNCTION private.invoice_collection_snapshot_valid(jsonb) TO service_role;

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
   AND jsonb_typeof(original->'serviceDate')='string' AND original->>'serviceDate'=to_char(service_day,'YYYY-MM-DD'),false);
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
GRANT EXECUTE ON FUNCTION private.invoice_original_source_valid(text,text,text,integer,uuid,date,jsonb,timestamptz) TO service_role;

ALTER TABLE public.invoices DROP CONSTRAINT invoices_f14_snapshot_shape_chk;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_f14_snapshot_shape_chk CHECK (((contract_version IS DISTINCT FROM 1) OR COALESCE(((snapshot ?& ARRAY['schemaVersion'::text, 'seller'::text, 'customer'::text, 'order'::text, 'lines'::text, 'totals'::text, 'serviceDate'::text, 'issuedAt'::text, 'paymentTermDays'::text]) AND (jsonb_typeof((snapshot -> 'schemaVersion'::text)) = 'number'::text) AND
CASE
    WHEN (jsonb_typeof((snapshot -> 'schemaVersion'::text)) = 'number'::text) THEN (((snapshot ->> 'schemaVersion'::text))::numeric = ANY (ARRAY[(1)::numeric, (2)::numeric, (3)::numeric]))
    ELSE false
END AND (jsonb_typeof((snapshot -> 'seller'::text)) = 'object'::text) AND ((snapshot -> 'seller'::text) ?& ARRAY['companyName'::text, 'street'::text, 'zip'::text, 'city'::text, 'country'::text, 'iban'::text, 'bic'::text, 'bankName'::text]) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'companyName'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'companyName'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'street'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'street'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'zip'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'zip'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'city'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'city'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'country'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'country'::text)) <> ''::text) AND (((snapshot -> 'schemaVersion'::text) = '3'::jsonb) OR ((jsonb_typeof(((snapshot -> 'seller'::text) -> 'taxId'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'taxId'::text)) <> ''::text))) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'iban'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'iban'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'bic'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'bic'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'bankName'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'bankName'::text)) <> ''::text) AND (jsonb_typeof((snapshot -> 'customer'::text)) = 'object'::text) AND ((snapshot -> 'customer'::text) ?& ARRAY['name'::text, 'companyName'::text, 'contactPerson'::text, 'street'::text, 'zip'::text, 'city'::text, 'country'::text]) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'name'::text)) = 'string'::text) AND (btrim(((snapshot -> 'customer'::text) ->> 'name'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'street'::text)) = 'string'::text) AND (btrim(((snapshot -> 'customer'::text) ->> 'street'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'zip'::text)) = 'string'::text) AND (btrim(((snapshot -> 'customer'::text) ->> 'zip'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'city'::text)) = 'string'::text) AND (btrim(((snapshot -> 'customer'::text) ->> 'city'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'country'::text)) = 'string'::text) AND (btrim(((snapshot -> 'customer'::text) ->> 'country'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'companyName'::text)) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'contactPerson'::text)) = ANY (ARRAY['string'::text, 'null'::text])) AND private.invoice_original_source_valid(tenant_id,customer_id,order_id,order_version,freeze_id,service_date,snapshot,issued_at) AND
CASE
    WHEN (jsonb_typeof((snapshot -> 'lines'::text)) = 'array'::text) THEN (jsonb_array_length((snapshot -> 'lines'::text)) > 0)
    ELSE false
END AND private.invoice_original_vat_valid(snapshot, (net_amount_cents)::bigint, vat_rate_basis_points, (vat_amount_cents)::bigint, (gross_amount_cents)::bigint) AND (jsonb_typeof((snapshot -> 'issuedAt'::text)) = 'string'::text) AND ((snapshot ->> 'issuedAt'::text) = to_char((issued_at AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text)) AND (jsonb_typeof((snapshot -> 'paymentTermDays'::text)) = 'number'::text) AND
CASE
    WHEN (jsonb_typeof((snapshot -> 'paymentTermDays'::text)) = 'number'::text) THEN (((snapshot ->> 'paymentTermDays'::text))::numeric = (payment_term_days)::numeric)
    ELSE false
END), false))) NOT VALID;

ALTER TABLE public.invoices DROP CONSTRAINT invoices_f14_required_issue_fields_chk;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_f14_required_issue_fields_chk CHECK (((contract_version IS DISTINCT FROM 1) OR COALESCE(((status IS NOT NULL) AND (customer_id IS NOT NULL) AND (invoice_number IS NOT NULL) AND (snapshot IS NOT NULL) AND (jsonb_typeof(snapshot) = 'object'::text) AND (net_amount_cents IS NOT NULL) AND ((((snapshot -> 'schemaVersion'::text) = '1'::jsonb) AND (vat_rate_basis_points IS NOT NULL)) OR (((snapshot -> 'schemaVersion'::text) = ANY (ARRAY['2'::jsonb, '3'::jsonb])) AND (vat_rate_basis_points IS NULL))) AND (vat_amount_cents IS NOT NULL) AND (gross_amount_cents IS NOT NULL) AND (amount_total IS NOT NULL) AND (payment_term_days IS NOT NULL) AND (due_date IS NOT NULL) AND (aggregate_version IS NOT NULL) AND (client_event_id IS NOT NULL) AND (correlation_id IS NOT NULL) AND (issue_event_id IS NOT NULL) AND (issued_at IS NOT NULL) AND (issued_by IS NOT NULL) AND (pdf_ref IS NOT NULL) AND (pdf_sha256 IS NOT NULL) AND (pdf_content IS NOT NULL)), false))) NOT VALID;

ALTER TABLE public.invoices DROP CONSTRAINT invoices_f14_order_version_chk;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_f14_order_version_chk CHECK (contract_version IS DISTINCT FROM 1 OR coalesce((order_id IS NOT NULL AND order_version>0 AND NOT snapshot ? 'collection') OR (order_id IS NULL AND order_version IS NULL AND snapshot ? 'collection'),false)) NOT VALID;

ALTER TABLE public.invoices ADD CONSTRAINT invoice_original_source_xor_chk CHECK(contract_version IS DISTINCT FROM 1 OR coalesce((order_id IS NOT NULL) <> (snapshot ? 'collection'),false)) NOT VALID;
CREATE UNIQUE INDEX invoice_collections_one_original_idx ON public.invoice_collections(tenant_id,invoice_id) WHERE invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.invoice_original_vat_valid(original jsonb, net bigint, head_rate integer, vat bigint, gross bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'private'
AS $function$
DECLARE totals jsonb; line jsonb; grp jsonb; rates integer[] := ARRAY[]::integer[];
 rate integer; line_net numeric; group_net numeric; group_vat numeric;
 sum_net numeric := 0; sum_vat numeric := 0; sum_gross numeric := 0;
BEGIN
 -- The frozen original is untouched. Only already qualified collection-source
 -- metadata is removed from this local VAT-validation projection, exactly like
 -- the existing v3 unit metadata; financial rules/calculations stay unchanged.
 IF original ? 'collection' THEN
  IF NOT private.invoice_collection_snapshot_valid(original) THEN RETURN false; END IF;
  original:=jsonb_set(original,'{lines}',(SELECT jsonb_agg(value-ARRAY['sourceOrderId','sourceOrderIds']::text[] ORDER BY ordinal) FROM jsonb_array_elements(original->'lines') WITH ORDINALITY AS element(value,ordinal)));
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
   IF line->>'unit' IS NULL OR line->>'unit' NOT IN ('C62','KGM','GRM','MTR','MTK','HUR','DMK','SET')
    OR line->'taxCategory' IS DISTINCT FROM to_jsonb(CASE WHEN line->>'vat_rate_basis_points'='0' THEN 'AE'::text ELSE 'S'::text END)
    OR (line->>'type'='EXTRA_WORK' AND line->>'unit'<>'HUR')
    OR (line->>'type'='SHIPPING' AND line->>'unit'<>'C62')
    OR (line->>'taxCategory'='AE' AND NULLIF(btrim(original->'seller'->>'vatId'),'') IS NULL) THEN RETURN false; END IF;
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
   IF line->>'type'='BASE' THEN
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
END $function$

;


-- One order-to-original relation for all readers; never a representative member.
CREATE OR REPLACE VIEW private.v_invoice_order_members_v1 WITH(security_invoker=true) AS
 SELECT invoice.tenant_id,invoice.id AS invoice_id,invoice.order_id,
  invoice.snapshot#>>'{order,orderNumber}' AS order_number,invoice.order_version,invoice.freeze_id,invoice.service_date,NULL::uuid AS collection_id
 FROM public.invoices invoice WHERE invoice.order_id IS NOT NULL AND invoice.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'')
 UNION ALL
 SELECT invoice.tenant_id,invoice.id,member.value->>'orderId',member.value->>'orderNumber',(member.value->>'orderVersion')::integer,(member.value->>'freezeId')::uuid,(member.value->>'serviceDate')::date,(invoice.snapshot#>>'{collection,collectionId}')::uuid
 FROM public.invoices invoice CROSS JOIN LATERAL jsonb_array_elements(invoice.snapshot#>'{collection,members}') member
 WHERE invoice.contract_version=1 AND invoice.order_id IS NULL AND invoice.snapshot ? 'collection'
  AND invoice.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'');
REVOKE ALL ON private.v_invoice_order_members_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.v_invoice_order_members_v1 TO service_role;

-- Native relation must be complete at transaction end. The existing issuer
-- writes invoice and collection atomically; no preparatory state is a receipt.
CREATE OR REPLACE FUNCTION private.guard_invoice_collection_original_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $function$
DECLARE affected uuid[]:=ARRAY[]::uuid[]; original public.invoices%ROWTYPE; collection public.invoice_collections%ROWTYPE; identifier uuid; actual text[]; expected text[];
BEGIN
 IF TG_TABLE_NAME='invoices' THEN
  IF TG_OP<>'INSERT' THEN affected:=array_append(affected,OLD.id); END IF;
  IF TG_OP<>'DELETE' THEN affected:=array_append(affected,NEW.id); END IF;
 ELSIF TG_TABLE_NAME='invoice_collections' THEN
  IF TG_OP<>'INSERT' AND OLD.invoice_id IS NOT NULL THEN affected:=array_append(affected,OLD.invoice_id); END IF;
  IF TG_OP<>'DELETE' AND NEW.invoice_id IS NOT NULL THEN affected:=array_append(affected,NEW.invoice_id); END IF;
 ELSE
  IF TG_OP<>'INSERT' THEN SELECT array_agg(invoice_id) FILTER(WHERE invoice_id IS NOT NULL) INTO affected FROM public.invoice_collections WHERE id=OLD.collection_id AND tenant_id=OLD.tenant_id; END IF;
  IF TG_OP<>'DELETE' THEN affected:=array_append(affected,(SELECT invoice_id FROM public.invoice_collections WHERE id=NEW.collection_id AND tenant_id=NEW.tenant_id)); END IF;
 END IF;
 FOR identifier IN SELECT DISTINCT value FROM unnest(affected) value WHERE value IS NOT NULL LOOP
  SELECT * INTO original FROM public.invoices WHERE id=identifier;
  IF NOT FOUND OR NOT coalesce(original.snapshot ? 'collection',false) THEN CONTINUE; END IF; -- Ordinary original retains its existing guards.
  IF NOT private.invoice_original_source_valid(original.tenant_id,original.customer_id,original.order_id,original.order_version,original.freeze_id,original.service_date,original.snapshot,original.issued_at) THEN RAISE EXCEPTION 'INVOICE_COLLECTION_SOURCE_INVALID' USING ERRCODE='23514'; END IF;
  SELECT * INTO collection FROM public.invoice_collections WHERE tenant_id=original.tenant_id AND id=(original.snapshot#>>'{collection,collectionId}')::uuid;
  IF NOT FOUND OR collection.invoice_id IS DISTINCT FROM original.id OR collection.status IS DISTINCT FROM 'abgerechnet' OR collection.version IS DISTINCT FROM (original.snapshot#>>'{collection,version}')::integer+1 THEN RAISE EXCEPTION 'INVOICE_COLLECTION_RELATION_INCOMPLETE' USING ERRCODE='23514'; END IF;
  SELECT array_agg(member.order_id ORDER BY member.order_id) INTO actual FROM public.invoice_collection_orders member WHERE member.tenant_id=original.tenant_id AND member.collection_id=collection.id;
  IF original.status='issued' THEN
   SELECT array_agg(member.value->>'orderId' ORDER BY member.value->>'orderId') INTO expected FROM jsonb_array_elements(original.snapshot#>'{collection,members}') member;
   IF actual IS DISTINCT FROM expected OR EXISTS(SELECT 1 FROM public.invoice_collection_orders member LEFT JOIN public.orders orders ON orders.id=member.order_id AND orders.tenant_id::text=member.tenant_id WHERE member.tenant_id=original.tenant_id AND member.collection_id=collection.id AND (orders.id IS NULL OR orders.customer_id IS DISTINCT FROM original.customer_id)) THEN RAISE EXCEPTION 'INVOICE_COLLECTION_MEMBERS_CHANGED' USING ERRCODE='23514'; END IF;
  ELSIF original.status='cancelled' THEN
   IF actual IS NOT NULL THEN RAISE EXCEPTION 'INVOICE_COLLECTION_CANCELLATION_NOT_RELEASED' USING ERRCODE='23514'; END IF;
  ELSE RAISE EXCEPTION 'INVOICE_COLLECTION_STATUS_INVALID' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION private.guard_invoice_collection_original_v1() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER invoice_collection_original_complete AFTER INSERT OR UPDATE ON public.invoices DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.guard_invoice_collection_original_v1();
CREATE CONSTRAINT TRIGGER invoice_collection_original_bound AFTER INSERT OR UPDATE OR DELETE ON public.invoice_collections DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.guard_invoice_collection_original_v1();
CREATE CONSTRAINT TRIGGER invoice_collection_original_members AFTER INSERT OR UPDATE OR DELETE ON public.invoice_collection_orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.guard_invoice_collection_original_v1();

CREATE OR REPLACE VIEW private.v_invoice_receipt_v1 WITH(security_invoker=true) AS
 SELECT event.id AS event_id,
    event.tenant_id,
    event.order_id,
    event.event_type,
    event.client_event_id,
    event.correlation_id,
    event.event_schema_version,
    event.aggregate_version,
    event.user_id AS actor_id,
    to_char(event.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) AS occurred_at,
    invoice.id AS invoice_id,
    invoice.invoice_number,
    invoice.order_version,
        CASE
            WHEN event.event_type::text = 'INVOICE_CREATED_V1'::text THEN (event.payload ->> 'orderVersion'::text)::integer
            ELSE (event.payload ->> 'expectedVersion'::text)::integer
        END AS intent_expected_version,
    invoice.status AS current_status,
    invoice.aggregate_version AS current_version,
    invoice.net_amount_cents,
    invoice.vat_rate_basis_points,
    invoice.vat_amount_cents,
    invoice.gross_amount_cents,
    invoice.service_date,
    invoice.due_date,
        CASE
            WHEN event.event_type::text = 'INVOICE_CREATED_V1'::text THEN invoice.pdf_ref
            ELSE invoice.cancellation_pdf_ref
        END AS pdf_ref,
        CASE
            WHEN event.event_type::text = 'INVOICE_CREATED_V1'::text THEN invoice.pdf_sha256
            ELSE invoice.cancellation_pdf_sha256
        END AS pdf_sha256,
    invoice.cancel_reason,
    invoice.pdf_sha256 AS original_pdf_sha256,
    actor.id IS NOT NULL AND event.order_id = invoice.order_id AND invoice.id::text = (event.payload ->> 'invoiceId'::text) AND invoice.invoice_number = (event.payload ->> 'invoiceNumber'::text) AND invoice.order_version = (((invoice.snapshot -> 'order'::text) ->> 'orderVersion'::text)::integer) AND invoice.order_id = ((invoice.snapshot -> 'order'::text) ->> 'orderId'::text) AND invoice.freeze_id::text = ((invoice.snapshot -> 'order'::text) ->> 'freezeId'::text) AND (invoice.snapshot ->> 'serviceDate'::text) = to_char(invoice.service_date::timestamp with time zone, 'YYYY-MM-DD'::text) AND (invoice.snapshot ->> 'issuedAt'::text) = to_char((invoice.issued_at AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) AND invoice.net_amount_cents = (((invoice.snapshot -> 'totals'::text) ->> 'netAmountCents'::text)::integer) AND private.invoice_original_vat_valid(invoice.snapshot, invoice.net_amount_cents::bigint, invoice.vat_rate_basis_points, invoice.vat_amount_cents::bigint, invoice.gross_amount_cents::bigint) AND invoice.vat_amount_cents = (((invoice.snapshot -> 'totals'::text) ->> 'vatAmountCents'::text)::integer) AND invoice.gross_amount_cents = (((invoice.snapshot -> 'totals'::text) ->> 'grossAmountCents'::text)::integer) AND (event.event_type::text = 'INVOICE_CREATED_V1'::text AND invoice.issue_event_id = event.id AND invoice.client_event_id = event.client_event_id AND invoice.correlation_id = event.correlation_id AND invoice.issued_by = event.user_id AND invoice.issued_at = (event.created_at AT TIME ZONE 'UTC'::text) AND event.aggregate_version = 1 AND ((event.payload ->> 'orderVersion'::text)::integer) = invoice.order_version AND (event.payload ->> 'pdfSha256'::text) = invoice.pdf_sha256 AND encode(sha256(invoice.pdf_content), 'hex'::text) = invoice.pdf_sha256 OR event.event_type::text = 'INVOICE_CANCELLED_V1'::text AND invoice.cancel_event_id = event.id AND invoice.cancel_client_event_id = event.client_event_id AND invoice.cancel_correlation_id = event.correlation_id AND invoice.cancelled_by = event.user_id AND invoice.cancelled_at IS NOT NULL AND invoice.cancelled_at = (event.created_at AT TIME ZONE 'UTC'::text) AND event.aggregate_version = 2 AND ((event.payload ->> 'expectedVersion'::text)::integer) = (invoice.aggregate_version - 1) AND (event.payload ->> 'cancellationPdfSha256'::text) = invoice.cancellation_pdf_sha256 AND (event.payload ->> 'cancelReason'::text) = invoice.cancel_reason AND encode(sha256(invoice.cancellation_pdf_content), 'hex'::text) = invoice.cancellation_pdf_sha256) AND ((event.event_type::text <> ALL (ARRAY['INVOICE_CREATED_V1'::text, 'INVOICE_CREATED_V2'::text])) OR (event.payload -> 'netAmountCents'::text) = ((invoice.snapshot -> 'totals'::text) -> 'netAmountCents'::text) AND (event.payload -> 'vatRateBasisPoints'::text) = ((invoice.snapshot -> 'totals'::text) -> 'vatRateBasisPoints'::text) AND (event.payload -> 'vatAmountCents'::text) = ((invoice.snapshot -> 'totals'::text) -> 'vatAmountCents'::text) AND (event.payload -> 'grossAmountCents'::text) = ((invoice.snapshot -> 'totals'::text) -> 'grossAmountCents'::text)) AS integrity_ok,
    invoice.snapshot
   FROM events event
     JOIN invoices invoice ON invoice.tenant_id = event.tenant_id::text AND invoice.id::text = (event.payload ->> 'invoiceId'::text)
     JOIN app_users actor ON actor.id = event.user_id AND actor.tenant_id = event.tenant_id::text
  WHERE invoice.contract_version = 1 AND (event.event_type::text = ANY (ARRAY['INVOICE_CREATED_V1'::character varying::text, 'INVOICE_CANCELLED_V1'::character varying::text])) AND event.status::text = 'success'::text AND NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND event.tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) AND invoice.order_id IS NOT NULL
UNION ALL

SELECT event.id AS event_id,event.tenant_id,event.order_id,event.event_type,event.client_event_id,event.correlation_id,event.event_schema_version,event.aggregate_version,event.user_id AS actor_id,
 to_char(event.created_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
 invoice.id AS invoice_id,invoice.invoice_number,invoice.order_version,
 CASE WHEN event.event_type='INVOICE_CREATED_V3' THEN (event.payload->>'collectionVersion')::integer ELSE (event.payload->>'expectedVersion')::integer END AS intent_expected_version,
 invoice.status AS current_status,invoice.aggregate_version AS current_version,invoice.net_amount_cents,invoice.vat_rate_basis_points,invoice.vat_amount_cents,invoice.gross_amount_cents,invoice.service_date,invoice.due_date,
 CASE WHEN event.event_type='INVOICE_CREATED_V3' THEN invoice.pdf_ref ELSE invoice.cancellation_pdf_ref END AS pdf_ref,
 CASE WHEN event.event_type='INVOICE_CREATED_V3' THEN invoice.pdf_sha256 ELSE invoice.cancellation_pdf_sha256 END AS pdf_sha256,
 invoice.cancel_reason,invoice.pdf_sha256 AS original_pdf_sha256,
 coalesce(actor.id IS NOT NULL AND event.order_id IS NULL AND invoice.order_id IS NULL
  AND invoice.id::text=event.payload->>'invoiceId' AND invoice.invoice_number=event.payload->>'invoiceNumber'
  AND event.payload->'collection'=invoice.snapshot->'collection'
  AND private.invoice_original_source_valid(invoice.tenant_id,invoice.customer_id,invoice.order_id,invoice.order_version,invoice.freeze_id,invoice.service_date,invoice.snapshot,invoice.issued_at)
  AND invoice.snapshot->>'issuedAt'=to_char(invoice.issued_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  AND private.invoice_original_vat_valid(invoice.snapshot,invoice.net_amount_cents::bigint,invoice.vat_rate_basis_points,invoice.vat_amount_cents::bigint,invoice.gross_amount_cents::bigint)
  AND ((event.event_type='INVOICE_CREATED_V3' AND event.event_schema_version=3 AND event.aggregate_version=1
    AND invoice.issue_event_id=event.id AND invoice.client_event_id=event.client_event_id AND invoice.correlation_id=event.correlation_id
    AND invoice.issued_by=event.user_id AND invoice.issued_at=event.created_at AT TIME ZONE 'UTC'
    AND (event.payload->>'collectionVersion')::integer=(invoice.snapshot#>>'{collection,version}')::integer
    AND event.payload->'netAmountCents'=invoice.snapshot#>'{totals,netAmountCents}'
    AND event.payload->'vatRateBasisPoints'=invoice.snapshot#>'{totals,vatRateBasisPoints}'
    AND event.payload->'vatAmountCents'=invoice.snapshot#>'{totals,vatAmountCents}'
    AND event.payload->'grossAmountCents'=invoice.snapshot#>'{totals,grossAmountCents}'
    AND event.payload->>'pdfSha256'=invoice.pdf_sha256 AND encode(sha256(invoice.pdf_content),'hex')=invoice.pdf_sha256)
   OR (event.event_type='INVOICE_CANCELLED_V1' AND event.event_schema_version=1 AND event.aggregate_version=2
    AND invoice.cancel_event_id=event.id AND invoice.cancel_client_event_id=event.client_event_id AND invoice.cancel_correlation_id=event.correlation_id
    AND invoice.cancelled_by=event.user_id AND invoice.cancelled_at=event.created_at AT TIME ZONE 'UTC'
    AND (event.payload->>'expectedVersion')::integer=invoice.aggregate_version-1
    AND event.payload->>'cancellationPdfSha256'=invoice.cancellation_pdf_sha256 AND event.payload->>'cancelReason'=invoice.cancel_reason
    AND encode(sha256(invoice.cancellation_pdf_content),'hex')=invoice.cancellation_pdf_sha256)),false) AS integrity_ok,
 invoice.snapshot
FROM public.events event
JOIN public.invoices invoice ON invoice.tenant_id=event.tenant_id::text AND invoice.id::text=event.payload->>'invoiceId'
JOIN public.app_users actor ON actor.tenant_id=event.tenant_id::text AND actor.id=event.user_id
WHERE invoice.contract_version=1 AND invoice.order_id IS NULL AND invoice.snapshot ? 'collection'
 AND event.event_type IN ('INVOICE_CREATED_V3','INVOICE_CANCELLED_V1') AND event.status='success'
 AND nullif(btrim(current_setting('app.tenant_id',true)),'') IS NOT NULL AND event.tenant_id::text=nullif(btrim(current_setting('app.tenant_id',true)),'')
;
CREATE OR REPLACE VIEW private.v_order_invoice_presence_v1 WITH(security_invoker=true) AS
 SELECT tenant_id,
    id AS order_id,
    (EXISTS ( SELECT 1
           FROM private.v_invoice_order_members_v1 invoice
          WHERE invoice.order_id = orders.id AND invoice.tenant_id = orders.tenant_id::text)) AS invoice_exists,
    ( SELECT count(*)::integer AS count
           FROM private.v_invoice_order_members_v1 invoice
          WHERE invoice.order_id = orders.id AND invoice.tenant_id = orders.tenant_id::text) AS invoice_count,
    NOT (EXISTS ( SELECT 1
           FROM invoices invoice
          WHERE invoice.order_id = orders.id AND invoice.tenant_id IS DISTINCT FROM orders.tenant_id::text)) AS integrity_ok
   FROM orders orders
  WHERE NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text);

-- Extend the existing immutable invoice-event guard to the native source kind.
DROP TRIGGER events_invoice_lifecycle_delete_immutable ON public.events;
CREATE TRIGGER events_invoice_lifecycle_delete_immutable BEFORE DELETE ON public.events FOR EACH ROW
 WHEN(OLD.event_type IN ('INVOICE_CREATED_V1','INVOICE_CREATED_V3','INVOICE_CANCELLED_V1')) EXECUTE FUNCTION public.prevent_audit_mutation();
DROP TRIGGER events_invoice_lifecycle_update_immutable ON public.events;
CREATE TRIGGER events_invoice_lifecycle_update_immutable BEFORE UPDATE ON public.events FOR EACH ROW
 WHEN(OLD.event_type IN ('INVOICE_CREATED_V1','INVOICE_CREATED_V3','INVOICE_CANCELLED_V1') OR NEW.event_type IN ('INVOICE_CREATED_V1','INVOICE_CREATED_V3','INVOICE_CANCELLED_V1')) EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE UNIQUE INDEX events_invoice_collection_created_n5_idx ON public.events(tenant_id,client_event_id) WHERE event_type='INVOICE_CREATED_V3';
-- An issued source stays unchanged, including after a cancellation. Releasing
-- members never rewrites the historical collection or its original pointer.
CREATE TRIGGER invoice_collection_issued_update_immutable BEFORE UPDATE ON public.invoice_collections FOR EACH ROW WHEN(OLD.invoice_id IS NOT NULL) EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER invoice_collection_issued_delete_immutable BEFORE DELETE ON public.invoice_collections FOR EACH ROW WHEN(OLD.invoice_id IS NOT NULL) EXECUTE FUNCTION public.prevent_audit_mutation();
