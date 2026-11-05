-- P55: capture provenance is supplied by the capture path, never inferred from MIME.
ALTER TABLE public.intake_file
  ADD COLUMN aufnahme_herkunft text NOT NULL DEFAULT 'dokument'
  CHECK (aufnahme_herkunft IN ('warenfoto', 'dokument'));

ALTER TABLE public.intake_item DROP CONSTRAINT intake_item_kanal_chk;
ALTER TABLE public.intake_item ADD CONSTRAINT intake_item_kanal_chk
  CHECK (kanal IN ('mail','notiz','foto','datei','scan','weitergeleitet','system','telefon'));

CREATE OR REPLACE FUNCTION private.protect_intake_original() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF ROW(NEW.id,NEW.tenant_id,NEW.item_id,NEW.client_key,NEW.art,NEW.abgeleitet_von,NEW.foto_art,NEW.dateiname,NEW.mime,NEW.bytes,NEW.sha256,NEW.speicherpfad,NEW.aufgenommen_am,NEW.aufgenommen_von,NEW.aufgenommen_auf,NEW.reihenfolge,NEW.aufnahme_herkunft)
  IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.item_id,OLD.client_key,OLD.art,OLD.abgeleitet_von,OLD.foto_art,OLD.dateiname,OLD.mime,OLD.bytes,OLD.sha256,OLD.speicherpfad,OLD.aufgenommen_am,OLD.aufgenommen_von,OLD.aufgenommen_auf,OLD.reihenfolge,OLD.aufnahme_herkunft)
 THEN RAISE EXCEPTION 'INTAKE_ORIGINAL_IMMUTABLE' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $fn$;

-- P56 C02: append the last order handover to the existing tenant-bound customer view.
CREATE OR REPLACE VIEW private.v_order_intake_customers_v1
WITH (security_invoker = true)
AS
SELECT
  customer.id,
  customer.tenant_id,
  customer.customer_number,
  customer.name,
  customer.company_name,
  customer.type AS customer_type,
  NULL::text AS contact_person,
  customer.phone,
  customer.email,
  customer.street,
  customer.zip_code,
  customer.city,
  customer.country,
  customer.payment_preference,
  customer.vat_id,
  count(orders.id)::integer AS orders_count,
  lower(concat_ws(' ',
    customer.name,
    customer.company_name,
    customer.first_name, customer.last_name, concat_ws(' ',customer.last_name,customer.first_name),
    customer.phone,
    customer.email,
    customer.street,
    customer.zip_code,
    customer.city,
    customer.customer_number
  )) AS search_text,
  (
    customer.id = btrim(customer.id)
    AND length(customer.id) BETWEEN 1 AND 128
    AND customer.name = btrim(customer.name)
    AND length(customer.name) BETWEEN 2 AND 160
    AND NOT EXISTS (
      SELECT 1
      FROM public.orders corrupt_order
      WHERE corrupt_order.customer_id = customer.id
        AND corrupt_order.tenant_id IS DISTINCT FROM customer.tenant_id
    )
  ) AS integrity_ok,
  customer.salutation,customer.first_name,customer.last_name,customer.contact_role,customer.house_number,customer.handover_preference,
  customer.ziel_freigeschaltet,customer.ziel_tage,customer.auto_info,customer.vorrang,
  (SELECT latest.handover_mode FROM public.orders latest
   WHERE latest.tenant_id=customer.tenant_id AND latest.customer_id=customer.id
   ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1) AS last_handover_mode
FROM public.customers customer
LEFT JOIN public.orders orders
  ON orders.customer_id = customer.id
 AND orders.tenant_id = customer.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND customer.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND coalesce(customer.source, '') NOT IN ('seed', 'test', 'demo', 'integration-test')
  AND coalesce(customer.name, '') NOT LIKE 'Capture%'
GROUP BY customer.id, customer.tenant_id, customer.customer_number,
  customer.name, customer.company_name, customer.type,
  customer.salutation,customer.first_name,customer.last_name,customer.contact_role,customer.house_number,customer.handover_preference,
  customer.ziel_freigeschaltet,customer.ziel_tage,customer.auto_info,customer.vorrang,
  customer.phone, customer.email, customer.street, customer.zip_code, customer.city,
  customer.country, customer.payment_preference, customer.vat_id;
