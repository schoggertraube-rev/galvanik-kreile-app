-- S38a E14/A13; PL19.11.14:47: keep the real Berlin handover month.
-- Existing closed collections retain their identities; only one open collection
-- per customer/month may accept further orders. No rows or grants change.
ALTER TABLE public.invoice_collections
  DROP CONSTRAINT invoice_collections_customer_month_uidx;
CREATE UNIQUE INDEX invoice_collections_customer_month_open_uidx
  ON public.invoice_collections (tenant_id, customer_id, monat)
  WHERE status = 'offen';
