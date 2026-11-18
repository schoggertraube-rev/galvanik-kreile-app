-- S54o A2: preserve the strict historical VAT validator for v3 shipping.
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
 IF original->'schemaVersion'='3'::jsonb THEN
  IF jsonb_typeof(original->'seller') IS DISTINCT FROM 'object'
   OR original->'seller' ? 'taxId'
   OR NOT COALESCE(jsonb_typeof(original->'seller'->'vatId') IN ('string','null'),false)
   OR NOT COALESCE(jsonb_typeof(original->'seller'->'taxNumber') IN ('string','null'),false)
   OR COALESCE(NULLIF(btrim(original->'seller'->>'vatId'),''),NULLIF(btrim(original->'seller'->>'taxNumber'),'')) IS NULL
   OR jsonb_typeof(original->'lines') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(original->'lines') LOOP
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
  original:=jsonb_set(original,'{lines}',(SELECT jsonb_agg(value-'unit'-'taxCategory' ORDER BY ordinal)
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
END $function$;
