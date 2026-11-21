-- PL2026-11-20 19:53 / 2026-11-21 22:23: preserve the immutable create
-- intent and all identity/contact checks after a proved invoice-terms release.
CREATE OR REPLACE VIEW private.v_customer_create_receipts_v1 WITH (security_invoker=true) AS
SELECT receipt.id AS receipt_id,receipt.event_id,receipt.tenant_id,receipt.customer_id,
  receipt.customer_number,receipt.actor_id,receipt.client_event_id,receipt.correlation_id,
  receipt.intent_sha256,receipt.name,receipt.customer_type,receipt.company_name,
  receipt.contact_person,receipt.email,receipt.phone,receipt.street,receipt.zip_code,
  receipt.city,receipt.country,receipt.payment_preference,receipt.vat_id,receipt.notes,
  receipt.created_at AS recorded_at,
  (event.id IS NOT NULL AND customer.id IS NOT NULL AND actor.id IS NOT NULL
    AND event.tenant_id=receipt.tenant_id AND event.user_id=receipt.actor_id
    AND event.client_event_id=receipt.client_event_id AND event.correlation_id=receipt.correlation_id
    AND event.event_type='CUSTOMER_CREATED_V1' AND event.status='success'
    AND event.event_schema_version=1 AND event.aggregate_version=1
    AND event.payload->>'intentSha256'=receipt.intent_sha256
    AND event.payload->>'customerId'=receipt.customer_id
    AND event.payload->>'customerNumber'=receipt.customer_number
    AND customer.customer_number=receipt.customer_number
    AND CASE WHEN latest_update.id IS NOT NULL THEN
      latest_update.status='success' AND latest_update.user_id IS NOT NULL
      AND latest_update.client_event_id IS NOT NULL AND latest_update.correlation_id IS NOT NULL
      AND latest_update.event_schema_version=1 AND latest_update.aggregate_version>0
      AND latest_update.payload->>'intentSha256' ~ '^[0-9a-f]{64}$'
      AND jsonb_typeof(latest_update.payload->'fields')='object'
      AND to_jsonb(customer) @> ((latest_update.payload->'fields') || CASE WHEN terms_event.id IS NOT NULL AND (latest_update.payload->'fields')->>'payment_preference'='vorkasse' THEN jsonb_build_object('payment_preference','rechnung') ELSE '{}'::jsonb END)
      AND customer.name=CASE WHEN customer.type='privat' THEN concat_ws(' ',nullif(customer.first_name,''),nullif(customer.last_name,'')) ELSE customer.company_name END
    ELSE customer.name=receipt.name AND customer.type=receipt.customer_type
      AND CASE WHEN receipt.customer_fields IS NOT NULL THEN
        jsonb_typeof(receipt.customer_fields)='object'
        AND to_jsonb(customer) @> (receipt.customer_fields || CASE WHEN terms_event.id IS NOT NULL AND receipt.customer_fields->>'payment_preference'='vorkasse' THEN jsonb_build_object('payment_preference','rechnung') ELSE '{}'::jsonb END)
      ELSE
        customer.company_name IS NOT DISTINCT FROM receipt.company_name
        AND customer.email IS NOT DISTINCT FROM receipt.email AND customer.phone IS NOT DISTINCT FROM receipt.phone
        AND customer.street IS NOT DISTINCT FROM (SELECT s.street FROM private.kunde_split_street(receipt.street) s)
        AND customer.zip_code IS NOT DISTINCT FROM receipt.zip_code
        AND customer.country IS NOT DISTINCT FROM private.kunde_land_schluessel(receipt.country)
        AND customer.payment_preference IS NOT DISTINCT FROM CASE WHEN terms_event.id IS NOT NULL AND receipt.payment_preference='vorkasse' THEN 'rechnung' WHEN receipt.payment_preference ~ '^rechnung_[0-9]+$' THEN 'rechnung' ELSE receipt.payment_preference END
        AND customer.vat_id IS NOT DISTINCT FROM receipt.vat_id AND customer.notes IS NOT DISTINCT FROM receipt.notes
      END
    END) AS integrity_ok
FROM private.customer_create_receipts receipt
LEFT JOIN public.events event ON event.id=receipt.event_id AND event.tenant_id=receipt.tenant_id
LEFT JOIN public.customers customer ON customer.id=receipt.customer_id AND customer.tenant_id=receipt.tenant_id
LEFT JOIN LATERAL (
  SELECT update_event.* FROM public.events update_event
  WHERE update_event.tenant_id=receipt.tenant_id AND update_event.event_type='CUSTOMER_UPDATED_V1'
    AND update_event.payload->>'customerId'=receipt.customer_id
  ORDER BY update_event.aggregate_version DESC LIMIT 1
) latest_update ON true
-- A later payment preference is valid only with the existing successful terms
-- event for this same customer/tenant, after the profile snapshot being checked.
LEFT JOIN LATERAL (
  SELECT terms.id FROM public.events terms
  JOIN public.app_users terms_actor ON terms_actor.id=terms.user_id AND terms_actor.tenant_id=terms.tenant_id
  WHERE terms.tenant_id=receipt.tenant_id
    AND terms.event_type='CUSTOMER_INVOICE_TERMS_ENABLED_V1'
    AND terms.payload->>'customerId'=receipt.customer_id
    AND terms.status='success' AND terms.event_schema_version=1 AND terms.aggregate_version=1
    AND terms.client_event_id IS NOT NULL AND terms.correlation_id IS NOT NULL
    AND terms.created_at>=receipt.created_at
    AND (latest_update.id IS NULL OR terms.created_at>=latest_update.created_at)
    AND customer.ziel_freigeschaltet IS TRUE AND customer.payment_preference='rechnung'
    AND terms.payload->'targetDays'=to_jsonb(customer.ziel_tage)
    AND terms.payload->'cashDiscountPercent'=to_jsonb(customer.skonto_prozent)
    AND terms.payload->'cashDiscountDays'=to_jsonb(customer.skonto_tage)
  ORDER BY terms.created_at DESC,terms.id DESC LIMIT 1
) terms_event ON true
LEFT JOIN public.app_users actor ON actor.id=receipt.actor_id AND actor.tenant_id=receipt.tenant_id
WHERE receipt.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'');
REVOKE ALL ON TABLE private.v_customer_create_receipts_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE private.v_customer_create_receipts_v1 TO service_role;
