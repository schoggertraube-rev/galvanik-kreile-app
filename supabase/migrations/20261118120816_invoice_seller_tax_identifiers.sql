-- S54o d, PL18Nov12:32: separate VAT identification and domestic tax number.
-- tax_id remains the existing VAT field. Historical invoice snapshots are untouched.
ALTER TABLE public.company_settings ADD COLUMN tax_number text;
UPDATE public.company_settings
SET tax_number = tax_id, tax_id = NULL
WHERE tax_id IS NOT NULL AND tax_id !~ '^DE[0-9]{9}$';
COMMENT ON COLUMN public.company_settings.tax_id IS 'Seller VAT identification, separate from tax_number (S54o).';
COMMENT ON COLUMN public.company_settings.tax_number IS 'Seller domestic tax number, migrated verbatim from the previous combined field (S54o).';

-- The existing legacy source accepts either identifier; all original predicates,
-- including S09 shipping exclusions, are preserved from the current view.
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
            COALESCE(NULLIF(selected.tax_id, ''), NULLIF(selected.tax_number, '')) AS tax_id,
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
