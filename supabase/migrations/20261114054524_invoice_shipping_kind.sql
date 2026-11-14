-- S09 A09-6 / PL14Nov05:45. New columns in the existing invoice truth.
-- Old rows retain auftrag; issued originals and the existing full-row
-- immutable guard remain unchanged. No new writer, ledger or number sequence.
ALTER TABLE public.invoices
 ADD COLUMN belegart text NOT NULL DEFAULT 'auftrag',
 ADD COLUMN ursprung_rechnung_id uuid,
 ADD CONSTRAINT invoices_s09_kind_chk CHECK (belegart IN ('auftrag','versandkosten')),
 ADD CONSTRAINT invoices_s09_origin_shape_chk CHECK (
   (belegart='auftrag' AND ursprung_rechnung_id IS NULL)
   OR (belegart='versandkosten' AND contract_version IS NOT DISTINCT FROM 1 AND ursprung_rechnung_id IS NOT NULL)),
 ADD CONSTRAINT invoices_s09_origin_tenant_fkey FOREIGN KEY (tenant_id,ursprung_rechnung_id)
   REFERENCES public.invoices(tenant_id,id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX invoices_s09_tenant_active_order_uidx ON public.invoices(tenant_id,order_id)
 WHERE contract_version=1 AND status='issued' AND belegart='auftrag';
CREATE UNIQUE INDEX invoices_s09_tenant_active_freeze_uidx ON public.invoices(tenant_id,freeze_id)
 WHERE contract_version=1 AND status='issued' AND belegart='auftrag';
DROP INDEX public.invoices_f14_tenant_active_order_uidx;
DROP INDEX public.invoices_f14_tenant_active_freeze_uidx;

-- One actual shipment group, otherwise this order, as decided by PL05:45.
-- The original SHIPPING lines carry the group, never the editable handover mode.
CREATE UNIQUE INDEX invoices_s09_tenant_active_shipping_uidx ON public.invoices
 (tenant_id,(CASE WHEN left(snapshot#>>'{lines,0,shipmentGroupId}',8)='sendung:'
   THEN lower(snapshot#>>'{lines,0,shipmentGroupId}') ELSE 'order:'||order_id END))
 WHERE contract_version=1 AND status='issued' AND belegart='versandkosten';

CREATE FUNCTION private.guard_s09_shipping_invoice_source()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE source_order text; line jsonb; key text; scope text; first_scope text;
        seen text[]:=ARRAY[]::text[]; actual_count integer;
BEGIN
 IF NEW.belegart='auftrag' THEN RETURN NEW; END IF;
 SELECT original.order_id INTO source_order FROM public.invoices original
 WHERE original.tenant_id=NEW.tenant_id AND original.id=NEW.ursprung_rechnung_id
   AND original.belegart='auftrag' AND original.contract_version=1 AND original.status='issued' FOR SHARE;
 IF source_order IS NULL OR source_order IS DISTINCT FROM NEW.order_id THEN
   RAISE EXCEPTION 'INVOICE_SHIPPING_ORIGIN_INVALID' USING ERRCODE='23514';
 END IF;
 IF jsonb_typeof(NEW.snapshot->'lines') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'INVOICE_SHIPPING_LINES_INVALID' USING ERRCODE='23514';
 END IF;
 IF jsonb_array_length(NEW.snapshot->'lines')<1 THEN
   RAISE EXCEPTION 'INVOICE_SHIPPING_LINES_INVALID' USING ERRCODE='23514';
 END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(NEW.snapshot->'lines') LOOP
   IF line->>'type' IS DISTINCT FROM 'SHIPPING' OR jsonb_typeof(line->'shipmentGroupId') IS DISTINCT FROM 'string' THEN
     RAISE EXCEPTION 'INVOICE_SHIPPING_LINES_ONLY' USING ERRCODE='23514';
   END IF;
   key:=line->>'shipmentGroupId';
   IF key ~ '^sendung:[0-9a-fA-F-]{36}$' THEN
     scope:=lower(key);
     IF NOT EXISTS(SELECT 1 FROM public.shipments shipment WHERE shipment.tenant_id=NEW.tenant_id
       AND shipment.order_id=NEW.order_id AND shipment.sendung_id::text=substring(scope FROM 9)) THEN
       RAISE EXCEPTION 'INVOICE_SHIPPING_GROUP_INVALID' USING ERRCODE='23514';
     END IF;
   ELSIF key ~ '^shipment:[0-9a-fA-F-]{36}$' THEN
     scope:='order:'||NEW.order_id;
     IF NOT EXISTS(SELECT 1 FROM public.shipments shipment WHERE shipment.tenant_id=NEW.tenant_id
       AND shipment.order_id=NEW.order_id AND shipment.id::text=lower(substring(key FROM 10)) AND shipment.sendung_id IS NULL) THEN
       RAISE EXCEPTION 'INVOICE_SHIPPING_PARCEL_INVALID' USING ERRCODE='23514';
     END IF;
   ELSIF key='order:'||NEW.order_id THEN
     scope:=key;
     IF EXISTS(SELECT 1 FROM public.shipments shipment WHERE shipment.tenant_id=NEW.tenant_id AND shipment.order_id=NEW.order_id) THEN
       RAISE EXCEPTION 'INVOICE_SHIPPING_ORDER_SOURCE_INVALID' USING ERRCODE='23514';
     END IF;
   ELSE
     RAISE EXCEPTION 'INVOICE_SHIPPING_SOURCE_INVALID' USING ERRCODE='23514';
   END IF;
   IF first_scope IS NOT NULL AND first_scope<>scope OR lower(key)=ANY(seen) THEN
     RAISE EXCEPTION 'INVOICE_SHIPPING_SCOPE_AMBIGUOUS' USING ERRCODE='23514';
   END IF;
   first_scope:=scope;seen:=array_append(seen,lower(key));
 END LOOP;
 IF left(first_scope,8)='sendung:' AND cardinality(seen)<>1 THEN
   RAISE EXCEPTION 'INVOICE_SHIPPING_GROUP_COUNT_INVALID' USING ERRCODE='23514';
 END IF;
 IF left(first_scope,6)='order:' AND left(seen[1],9)='shipment:' THEN
   SELECT count(*)::integer INTO actual_count FROM public.shipments shipment
   WHERE shipment.tenant_id=NEW.tenant_id AND shipment.order_id=NEW.order_id AND shipment.sendung_id IS NULL;
   IF actual_count<>cardinality(seen) THEN
     RAISE EXCEPTION 'INVOICE_SHIPPING_PARCEL_COUNT_INVALID' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_s09_shipping_invoice_source() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.guard_s09_shipping_invoice_source() TO service_role;
CREATE TRIGGER invoices_s09_shipping_source_guard BEFORE INSERT ON public.invoices
 FOR EACH ROW WHEN (NEW.belegart='versandkosten') EXECUTE FUNCTION private.guard_s09_shipping_invoice_source();

-- Same source view and columns; only the main-document uniqueness predicate changes.
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
          WHERE existing_invoice.tenant_id = freeze_state.tenant_id AND existing_invoice.order_id = freeze_state.order_id AND existing_invoice.contract_version = 1 AND existing_invoice.status = 'issued'::text AND existing_invoice.belegart = 'auftrag')) AS no_active_invoice,
    freeze_state.active = true AND freeze_state.integrity_ok = true AND orders.id IS NOT NULL AND orders.station::text = 'fertig'::text AND customer.id IS NOT NULL AND company.config_count = 1 AND NULLIF(btrim(company.company_name), ''::text) IS NOT NULL AND NULLIF(btrim(company.street), ''::text) IS NOT NULL AND NULLIF(btrim(company.zip), ''::text) IS NOT NULL AND NULLIF(btrim(company.city), ''::text) IS NOT NULL AND NULLIF(btrim(company.country), ''::text) IS NOT NULL AND NULLIF(btrim(company.tax_id), ''::text) IS NOT NULL AND NULLIF(btrim(company.iban), ''::text) IS NOT NULL AND NULLIF(btrim(company.bic), ''::text) IS NOT NULL AND NULLIF(btrim(company.bank_name), ''::text) IS NOT NULL AND company.invoice_payment_term_days IS NOT NULL AND NULLIF(btrim(COALESCE(customer.company_name, customer.name)), ''::text) IS NOT NULL AND NULLIF(btrim(concat_ws(' '::text, customer.street, customer.house_number)), ''::text) IS NOT NULL AND NULLIF(btrim(customer.zip_code), ''::text) IS NOT NULL AND NULLIF(btrim(customer.city), ''::text) IS NOT NULL AND NULLIF(btrim(customer.country), ''::text) IS NOT NULL AND COALESCE(base_items.base_line_count, 0) > 0 AND COALESCE(base_items.invalid_price_count, 0) = 0 AS integrity_ok,
    customer.vat_id AS customer_vat_id
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
            selected.tax_id,
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
            jsonb_agg(jsonb_build_object('itemId', item.id, 'name', item.name, 'quantity', item.quantity, 'unitNetAmountCents', round(item.preis_netto * 100::numeric)::bigint, 'lineNetAmountCents', round(round(item.preis_netto * 100::numeric)::bigint::numeric * item.quantity)::bigint, 'vat_rate_basis_points', item.vat_rate_basis_points) ORDER BY item.id) AS base_lines
           FROM items item
          WHERE item.tenant_id::text = freeze_state.tenant_id AND item.order_id = freeze_state.order_id) base_items ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('itemId', line.item_id, 'catalogPositionId', line.catalog_position_id, 'catalogPositionName', line.catalog_position_name, 'minutes', line.minutes, 'hourlyRateCents', line.hourly_rate_cents, 'amountCents', line.amount_cents, 'vat_rate_basis_points', item.vat_rate_basis_points) ORDER BY line.item_id, line.catalog_position_name, line.catalog_position_id) AS lines
           FROM private.order_frozen_extra_work_lines line
             JOIN items item ON item.tenant_id::text = line.tenant_id AND item.order_id = freeze_state.order_id AND item.id = line.item_id
          WHERE line.tenant_id = freeze_state.tenant_id AND line.freeze_id = freeze_state.freeze_id) extra_work ON true
  WHERE freeze_state.active = true AND NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND freeze_state.tenant_id = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text);
