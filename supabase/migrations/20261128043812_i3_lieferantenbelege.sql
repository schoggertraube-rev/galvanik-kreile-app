-- I3: Lieferanten aus dem Eingang und ein späterer, einmaliger Auftragsbezug zur Ware.
CREATE VIEW public.v_eingang_lieferanten_v1 WITH (security_invoker = true) AS
  SELECT tenant_id, id, name, vat_id
  FROM public.customers
  WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND type = 'lieferant';
REVOKE ALL ON public.v_eingang_lieferanten_v1 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.v_eingang_lieferanten_v1 TO service_role;

ALTER TABLE public.goods_receipt
  ADD COLUMN verknuepft_am timestamptz,
  DROP CONSTRAINT goods_receipt_modus_check,
  DROP CONSTRAINT goods_receipt_has_business_reference,
  DROP CONSTRAINT goods_receipt_quote_evidence,
  ADD CONSTRAINT goods_receipt_modus_check CHECK (modus IN ('erwartet','erfassung','ohne_bezug')),
  ADD CONSTRAINT goods_receipt_has_business_reference CHECK (
    auftrag_id IS NOT NULL OR kv_id IS NOT NULL
    OR (modus='ohne_bezug' AND auftrag_id IS NULL AND verknuepft_am IS NULL)
  ),
  ADD CONSTRAINT goods_receipt_quote_evidence CHECK (
    (kv_id IS NULL AND kv_fassung IS NULL AND (lagerort IS NULL OR modus='ohne_bezug'))
    OR (kv_id IS NOT NULL AND kv_fassung IS NOT NULL AND lagerort IS NOT NULL)
  ),
  ADD CONSTRAINT goods_receipt_ohne_bezug_complete CHECK (
    (modus<>'ohne_bezug' AND verknuepft_am IS NULL)
    OR (modus='ohne_bezug' AND kv_id IS NULL AND item_id IS NOT NULL AND lagerort IS NOT NULL
      AND ((auftrag_id IS NULL) = (verknuepft_am IS NULL)))
  );

CREATE OR REPLACE FUNCTION private.protect_goods_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF OLD.status<>'entwurf' AND NEW.status='entwurf' THEN RAISE EXCEPTION 'GOODS_RECEIPT_STATE_REGRESSION' USING ERRCODE='23514'; END IF;
 IF ROW(NEW.id,NEW.tenant_id,NEW.client_key,NEW.modus,NEW.kv_id,NEW.kv_fassung,NEW.lagerort)
   IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.client_key,OLD.modus,OLD.kv_id,OLD.kv_fassung,OLD.lagerort)
   OR (OLD.item_id IS NOT NULL AND NEW.item_id IS DISTINCT FROM OLD.item_id)
 THEN RAISE EXCEPTION 'GOODS_RECEIPT_IDENTITY_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF (NEW.auftrag_id IS DISTINCT FROM OLD.auftrag_id OR NEW.verknuepft_am IS DISTINCT FROM OLD.verknuepft_am) AND NOT (
   OLD.auftrag_id IS NULL AND OLD.kv_id IS NOT NULL AND NEW.auftrag_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM private.quotes q WHERE q.tenant_id=NEW.tenant_id AND q.id=NEW.kv_id AND q.linked_order_id=NEW.auftrag_id)
   OR OLD.auftrag_id IS NOT NULL AND NEW.auftrag_id IS NULL AND OLD.kv_id IS NOT NULL
     AND EXISTS(SELECT 1 FROM public.events reversed JOIN public.orders cancelled ON cancelled.tenant_id=reversed.tenant_id AND cancelled.id=OLD.auftrag_id
       WHERE reversed.tenant_id=OLD.tenant_id AND reversed.event_type='QUOTE_CONVERSION_REVERSED_V04'
         AND reversed.status='success' AND reversed.user_id IS NOT NULL
         AND reversed.payload->>'quoteId'=OLD.kv_id::text AND reversed.payload->>'orderId'=OLD.auftrag_id
         AND reversed.payload->'receiptIds' ? OLD.id::text AND cancelled.status='storniert' AND cancelled.ware='storniert')
   OR OLD.modus='ohne_bezug' AND OLD.auftrag_id IS NULL AND OLD.verknuepft_am IS NULL
     AND NEW.auftrag_id IS NOT NULL AND NEW.verknuepft_am IS NOT NULL
 ) THEN RAISE EXCEPTION 'GOODS_RECEIPT_ORDER_BINDING_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $fn$;
