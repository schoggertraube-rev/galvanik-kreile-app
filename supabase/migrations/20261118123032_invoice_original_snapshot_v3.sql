-- S54o d, PL18Nov12:32. One canonical version; historical originals untouched.
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

ALTER TABLE public.invoices DROP CONSTRAINT invoices_f14_required_issue_fields_chk;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_f14_required_issue_fields_chk CHECK (((contract_version IS DISTINCT FROM 1) OR COALESCE(((status IS NOT NULL) AND (order_id IS NOT NULL) AND (customer_id IS NOT NULL) AND (freeze_id IS NOT NULL) AND (invoice_number IS NOT NULL) AND (snapshot IS NOT NULL) AND (jsonb_typeof(snapshot) = 'object'::text) AND (net_amount_cents IS NOT NULL) AND ((((snapshot -> 'schemaVersion'::text) = '1'::jsonb) AND (vat_rate_basis_points IS NOT NULL)) OR (((snapshot -> 'schemaVersion'::text) IN ('2'::jsonb,'3'::jsonb)) AND (vat_rate_basis_points IS NULL))) AND (vat_amount_cents IS NOT NULL) AND (gross_amount_cents IS NOT NULL) AND (amount_total IS NOT NULL) AND (service_date IS NOT NULL) AND (order_version IS NOT NULL) AND (payment_term_days IS NOT NULL) AND (due_date IS NOT NULL) AND (aggregate_version IS NOT NULL) AND (client_event_id IS NOT NULL) AND (correlation_id IS NOT NULL) AND (issue_event_id IS NOT NULL) AND (issued_at IS NOT NULL) AND (issued_by IS NOT NULL) AND (pdf_ref IS NOT NULL) AND (pdf_sha256 IS NOT NULL) AND (pdf_content IS NOT NULL)), false))) NOT VALID;

ALTER TABLE public.invoices DROP CONSTRAINT invoices_f14_snapshot_shape_chk;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_f14_snapshot_shape_chk CHECK (((contract_version IS DISTINCT FROM 1) OR COALESCE(((snapshot ?& ARRAY['schemaVersion'::text, 'seller'::text, 'customer'::text, 'order'::text, 'lines'::text, 'totals'::text, 'serviceDate'::text, 'issuedAt'::text, 'paymentTermDays'::text]) AND (jsonb_typeof((snapshot -> 'schemaVersion'::text)) = 'number'::text) AND
CASE
    WHEN (jsonb_typeof((snapshot -> 'schemaVersion'::text)) = 'number'::text) THEN (((snapshot ->> 'schemaVersion'::text))::numeric = ANY (ARRAY[(1)::numeric, (2)::numeric, (3)::numeric]))
    ELSE false
END AND (jsonb_typeof((snapshot -> 'seller'::text)) = 'object'::text) AND ((snapshot -> 'seller'::text) ?& ARRAY['companyName'::text, 'street'::text, 'zip'::text, 'city'::text, 'country'::text, 'iban'::text, 'bic'::text, 'bankName'::text]) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'companyName'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'companyName'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'street'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'street'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'zip'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'zip'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'city'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'city'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'country'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'country'::text)) <> ''::text) AND (((snapshot->'schemaVersion')='3'::jsonb) OR ((jsonb_typeof(((snapshot -> 'seller'::text) -> 'taxId'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'taxId'::text)) <> ''::text))) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'iban'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'iban'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'bic'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'bic'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'seller'::text) -> 'bankName'::text)) = 'string'::text) AND (btrim(((snapshot -> 'seller'::text) ->> 'bankName'::text)) <> ''::text) AND (jsonb_typeof((snapshot -> 'customer'::text)) = 'object'::text) AND ((snapshot -> 'customer'::text) ?& ARRAY['name'::text, 'companyName'::text, 'contactPerson'::text, 'street'::text, 'zip'::text, 'city'::text, 'country'::text]) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'name'::text)) = 'string'::text) AND (btrim(((snapshot -> 'customer'::text) ->> 'name'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'street'::text)) = 'string'::text) AND (btrim(((snapshot -> 'customer'::text) ->> 'street'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'zip'::text)) = 'string'::text) AND (btrim(((snapshot -> 'customer'::text) ->> 'zip'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'city'::text)) = 'string'::text) AND (btrim(((snapshot -> 'customer'::text) ->> 'city'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'country'::text)) = 'string'::text) AND (btrim(((snapshot -> 'customer'::text) ->> 'country'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'companyName'::text)) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof(((snapshot -> 'customer'::text) -> 'contactPerson'::text)) = ANY (ARRAY['string'::text, 'null'::text])) AND (jsonb_typeof((snapshot -> 'order'::text)) = 'object'::text) AND ((snapshot -> 'order'::text) ?& ARRAY['orderId'::text, 'orderVersion'::text, 'orderNumber'::text, 'title'::text, 'freezeId'::text]) AND (jsonb_typeof(((snapshot -> 'order'::text) -> 'orderVersion'::text)) = 'number'::text) AND
CASE
    WHEN (jsonb_typeof(((snapshot -> 'order'::text) -> 'orderVersion'::text)) = 'number'::text) THEN (((((snapshot -> 'order'::text) ->> 'orderVersion'::text))::numeric = trunc((((snapshot -> 'order'::text) ->> 'orderVersion'::text))::numeric)) AND ((((snapshot -> 'order'::text) ->> 'orderVersion'::text))::numeric = (order_version)::numeric))
    ELSE false
END AND (jsonb_typeof(((snapshot -> 'order'::text) -> 'orderId'::text)) = 'string'::text) AND (((snapshot -> 'order'::text) ->> 'orderId'::text) = order_id) AND (jsonb_typeof(((snapshot -> 'order'::text) -> 'orderNumber'::text)) = 'string'::text) AND (btrim(((snapshot -> 'order'::text) ->> 'orderNumber'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'order'::text) -> 'title'::text)) = 'string'::text) AND (btrim(((snapshot -> 'order'::text) ->> 'title'::text)) <> ''::text) AND (jsonb_typeof(((snapshot -> 'order'::text) -> 'freezeId'::text)) = 'string'::text) AND (((snapshot -> 'order'::text) ->> 'freezeId'::text) = (freeze_id)::text) AND
CASE
    WHEN (jsonb_typeof((snapshot -> 'lines'::text)) = 'array'::text) THEN (jsonb_array_length((snapshot -> 'lines'::text)) > 0)
    ELSE false
END AND private.invoice_original_vat_valid(snapshot, (net_amount_cents)::bigint, vat_rate_basis_points, (vat_amount_cents)::bigint, (gross_amount_cents)::bigint) AND (jsonb_typeof((snapshot -> 'serviceDate'::text)) = 'string'::text) AND ((snapshot ->> 'serviceDate'::text) = to_char((service_date)::timestamp with time zone, 'YYYY-MM-DD'::text)) AND (jsonb_typeof((snapshot -> 'issuedAt'::text)) = 'string'::text) AND ((snapshot ->> 'issuedAt'::text) = to_char((issued_at AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text)) AND (jsonb_typeof((snapshot -> 'paymentTermDays'::text)) = 'number'::text) AND
CASE
    WHEN (jsonb_typeof((snapshot -> 'paymentTermDays'::text)) = 'number'::text) THEN (((snapshot ->> 'paymentTermDays'::text))::numeric = (payment_term_days)::numeric)
    ELSE false
END), false))) NOT VALID;

CREATE OR REPLACE VIEW private.v_invoice_issue_source_v1 WITH (security_invoker=true) AS
SELECT freeze_state.tenant_id,
    freeze_state.order_id,
    freeze_state.freeze_id,
    freeze_state.frozen_at,
    (freeze_state.frozen_at AT TIME ZONE 'Europe/Berlin'::text)::date AS service_date,
    freeze_state.order_version AS freeze_order_version,
    orders.version AS current_order_version,
    orders.order_number,
    orders.title AS order_title,
    orders.station,
    orders.status AS order_status,
    orders.customer_id,
        CASE
            WHEN customer.type::text = 'privat'::text THEN concat_ws(' '::text,
            CASE customer.salutation
                WHEN 'frau'::text THEN 'Frau'::text
                WHEN 'herr'::text THEN 'Herr'::text
                ELSE NULL::text
            END, customer.first_name, customer.last_name)
            ELSE customer.name
        END AS customer_name,
    customer.company_name AS customer_company_name,
        CASE
            WHEN customer.type::text = 'business'::text AND NULLIF(concat_ws(' '::text, customer.first_name, customer.last_name), ''::text) IS NOT NULL THEN 'z. Hd. '::text || concat_ws(' '::text,
            CASE customer.salutation
                WHEN 'frau'::text THEN 'Frau'::text
                WHEN 'herr'::text THEN 'Herr'::text
                ELSE NULL::text
            END, customer.first_name, customer.last_name)
            ELSE NULL::text
        END AS customer_contact_person,
        CASE
            WHEN NULLIF(btrim(customer.street), ''::text) IS NOT NULL THEN NULLIF(btrim(concat_ws(' '::text, customer.street, customer.house_number)), ''::text)
            ELSE NULL::text
        END AS customer_street,
    customer.zip_code AS customer_zip,
    customer.city AS customer_city,
    customer.country AS customer_country,
    company.company_name AS seller_company_name,
    company.street AS seller_street,
    company.zip AS seller_zip,
    company.city AS seller_city,
    company.country AS seller_country,
    company.tax_id AS seller_tax_id,
    company.iban AS seller_iban,
    company.bic AS seller_bic,
    company.bank_name AS seller_bank_name,
    company.invoice_vat_rate_basis_points,
    company.invoice_payment_term_days,
    COALESCE(base_items.base_lines, '[]'::jsonb) AS base_lines,
    COALESCE(base_items.base_line_count, 0) AS base_line_count,
    COALESCE(base_items.base_net_amount_cents, 0::bigint) AS base_net_amount_cents,
    COALESCE(extra_work.lines, '[]'::jsonb) AS extra_work_lines,
    freeze_state.line_count AS extra_work_line_count,
    freeze_state.total_amount_cents AS extra_work_net_amount_cents,
    company.config_count = 1 AND NULLIF(btrim(company.company_name), ''::text) IS NOT NULL AND NULLIF(btrim(company.street), ''::text) IS NOT NULL AND NULLIF(btrim(company.zip), ''::text) IS NOT NULL AND NULLIF(btrim(company.city), ''::text) IS NOT NULL AND NULLIF(btrim(company.country), ''::text) IS NOT NULL AND NULLIF(btrim(company.tax_id), ''::text) IS NOT NULL AND NULLIF(btrim(company.iban), ''::text) IS NOT NULL AND NULLIF(btrim(company.bic), ''::text) IS NOT NULL AND NULLIF(btrim(company.bank_name), ''::text) IS NOT NULL AND company.invoice_payment_term_days IS NOT NULL AS seller_config_complete,
    NULLIF(btrim(COALESCE(customer.company_name, customer.name)), ''::text) IS NOT NULL AND NULLIF(btrim(concat_ws(' '::text, customer.street, customer.house_number)), ''::text) IS NOT NULL AND NULLIF(btrim(customer.zip_code), ''::text) IS NOT NULL AND NULLIF(btrim(customer.city), ''::text) IS NOT NULL AND NULLIF(btrim(customer.country), ''::text) IS NOT NULL AS customer_config_complete,
    COALESCE(base_items.base_line_count, 0) > 0 AND COALESCE(base_items.invalid_price_count, 0) = 0 AS base_prices_complete,
    NOT (EXISTS ( SELECT 1
           FROM invoices existing_invoice
          WHERE existing_invoice.tenant_id = freeze_state.tenant_id AND existing_invoice.order_id = freeze_state.order_id AND existing_invoice.contract_version = 1 AND existing_invoice.status = 'issued'::text AND existing_invoice.belegart = 'auftrag'::text)) AS no_active_invoice,
    freeze_state.active = true AND freeze_state.integrity_ok = true AND orders.id IS NOT NULL AND orders.station::text = 'fertig'::text AND customer.id IS NOT NULL AND company.config_count = 1 AND NULLIF(btrim(company.company_name), ''::text) IS NOT NULL AND NULLIF(btrim(company.street), ''::text) IS NOT NULL AND NULLIF(btrim(company.zip), ''::text) IS NOT NULL AND NULLIF(btrim(company.city), ''::text) IS NOT NULL AND NULLIF(btrim(company.country), ''::text) IS NOT NULL AND NULLIF(btrim(company.tax_id), ''::text) IS NOT NULL AND NULLIF(btrim(company.iban), ''::text) IS NOT NULL AND NULLIF(btrim(company.bic), ''::text) IS NOT NULL AND NULLIF(btrim(company.bank_name), ''::text) IS NOT NULL AND company.invoice_payment_term_days IS NOT NULL AND NULLIF(btrim(COALESCE(customer.company_name, customer.name)), ''::text) IS NOT NULL AND NULLIF(btrim(concat_ws(' '::text, customer.street, customer.house_number)), ''::text) IS NOT NULL AND NULLIF(btrim(customer.zip_code), ''::text) IS NOT NULL AND NULLIF(btrim(customer.city), ''::text) IS NOT NULL AND NULLIF(btrim(customer.country), ''::text) IS NOT NULL AND COALESCE(base_items.base_line_count, 0) > 0 AND COALESCE(base_items.invalid_price_count, 0) = 0 AS integrity_ok,
    customer.vat_id AS customer_vat_id,
    company.vat_id AS seller_vat_id,
    company.tax_number AS seller_tax_number
   FROM private.v_order_freeze_state_v1 freeze_state
     JOIN orders orders ON orders.id = freeze_state.order_id AND orders.tenant_id::text = freeze_state.tenant_id
     JOIN customers customer ON customer.id = orders.customer_id AND customer.tenant_id::text = orders.tenant_id::text
     LEFT JOIN LATERAL ( SELECT selected.id,
            selected.tenant_id,
            selected.company_name,
            selected.tagline,
            selected.street,
            selected.zip,
            selected.city,
            selected.country,
            selected.phone,
            selected.email,
            selected.website,
            selected.iban,
            selected.bic,
            selected.bank_name,
            COALESCE(NULLIF(selected.tax_id, ''::text), NULLIF(selected.tax_number, ''::text)) AS tax_id,
            selected.tax_id AS vat_id,
            selected.tax_number,
            selected.logo_url,
            selected.updated_at,
            selected.email_greeting,
            selected.email_pickup_info,
            selected.email_payment_info,
            selected.email_agb_text,
            selected.email_footer,
            selected.email_additional_notes,
            selected.workflow_templates,
            selected.wochenziel,
            selected.invoice_vat_rate_basis_points,
            selected.invoice_payment_term_days,
            selected.tagesleistung_eur,
            count(*) OVER ()::integer AS config_count
           FROM company_settings selected
          WHERE selected.tenant_id = freeze_state.tenant_id
          ORDER BY selected.updated_at DESC, selected.id
         LIMIT 1) company ON true
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS base_line_count,
            count(*) FILTER (WHERE item.preis_netto IS NULL OR item.preis_netto < 0::numeric)::integer AS invalid_price_count,
            COALESCE(sum(round(round(item.preis_netto * 100::numeric)::bigint::numeric * item.quantity)::bigint), 0::numeric)::bigint AS base_net_amount_cents,
            jsonb_agg(jsonb_build_object('itemId', item.id, 'name', item.name, 'unit', item.unit, 'quantity', item.quantity, 'unitNetAmountCents', round(item.preis_netto * 100::numeric)::bigint, 'lineNetAmountCents', round(round(item.preis_netto * 100::numeric)::bigint::numeric * item.quantity)::bigint, 'vat_rate_basis_points', item.vat_rate_basis_points) ORDER BY item.id) AS base_lines
           FROM items item
          WHERE item.tenant_id::text = freeze_state.tenant_id AND item.order_id = freeze_state.order_id) base_items ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('itemId', line.item_id, 'catalogPositionId', line.catalog_position_id, 'catalogPositionName', line.catalog_position_name, 'minutes', line.minutes, 'hourlyRateCents', line.hourly_rate_cents, 'amountCents', line.amount_cents, 'vat_rate_basis_points', item.vat_rate_basis_points) ORDER BY line.item_id, line.catalog_position_name, line.catalog_position_id) AS lines
           FROM private.order_frozen_extra_work_lines line
             JOIN items item ON item.tenant_id::text = line.tenant_id AND item.order_id = freeze_state.order_id AND item.id = line.item_id
          WHERE line.tenant_id = freeze_state.tenant_id AND line.freeze_id = freeze_state.freeze_id) extra_work ON true
  WHERE freeze_state.active = true AND NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND freeze_state.tenant_id = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text);

CREATE OR REPLACE VIEW private.v_invoice_issue_source_v2 WITH (security_invoker=true) AS
SELECT source.tenant_id,
    source.order_id,
    source.freeze_id,
    source.frozen_at,
    source.service_date,
    source.freeze_order_version,
    source.current_order_version,
    source.order_number,
    source.order_title,
    source.station,
    source.order_status,
    source.customer_id,
    source.customer_name,
    source.customer_company_name,
    source.customer_contact_person,
    source.customer_street,
    source.customer_zip,
    source.customer_city,
    source.customer_country,
    source.seller_company_name,
    source.seller_street,
    source.seller_zip,
    source.seller_city,
    source.seller_country,
    source.seller_tax_id,
    source.seller_iban,
    source.seller_bic,
    source.seller_bank_name,
    source.invoice_vat_rate_basis_points,
    source.invoice_payment_term_days,
    source.base_lines,
    source.base_line_count,
    source.base_net_amount_cents,
    source.extra_work_lines,
    source.extra_work_line_count,
    source.extra_work_net_amount_cents,
    source.seller_config_complete,
    source.customer_config_complete,
    source.base_prices_complete,
    source.no_active_invoice,
    source.integrity_ok,
    COALESCE(eligibility.post_goods_out_invoice_eligible, false) AS post_goods_out_invoice_eligible,
    source.integrity_ok OR COALESCE(eligibility.post_goods_out_invoice_eligible, false) AS effective_integrity_ok,
    source.customer_vat_id,
    source.seller_vat_id,
    source.seller_tax_number
   FROM private.v_invoice_issue_source_v1 source
     LEFT JOIN LATERAL ( SELECT count(*) = 1 AND bool_and(receipt.integrity_ok) AND orders.payment_mode = 'rechnung'::text AND orders.station::text = 'abgeholt'::text AND orders.status::text = 'abgeholt'::text AND freeze_state.active = true AND freeze_state.integrity_ok = true AND source.seller_config_complete AND source.customer_config_complete AND source.base_prices_complete AS post_goods_out_invoice_eligible
           FROM orders orders
             JOIN private.v_order_freeze_state_v1 freeze_state ON freeze_state.tenant_id = orders.tenant_id::text AND freeze_state.order_id = orders.id AND freeze_state.freeze_id = source.freeze_id
             JOIN private.v_goods_out_receipt_v2 receipt ON receipt.tenant_id::text = orders.tenant_id::text AND receipt.order_id = orders.id AND receipt.order_version = orders.version
          WHERE orders.tenant_id::text = source.tenant_id AND orders.id = source.order_id
          GROUP BY orders.payment_mode, orders.station, orders.status, freeze_state.active, freeze_state.integrity_ok) eligibility ON true;
