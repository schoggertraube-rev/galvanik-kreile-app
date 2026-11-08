-- U-245: the existing receipt may reference a KV before an order exists.
ALTER TABLE public.goods_receipt
 ALTER COLUMN auftrag_id DROP NOT NULL,
 ADD COLUMN kv_id uuid,
 ADD COLUMN kv_fassung integer CHECK(kv_fassung>0),
 ADD COLUMN lagerort text CHECK(lagerort IS NULL OR length(btrim(lagerort)) BETWEEN 1 AND 120),
 ADD CONSTRAINT goods_receipt_quote_tenant_fk FOREIGN KEY(tenant_id,kv_id) REFERENCES private.quotes(tenant_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT goods_receipt_has_business_reference CHECK(auftrag_id IS NOT NULL OR kv_id IS NOT NULL),
 ADD CONSTRAINT goods_receipt_quote_evidence CHECK((kv_id IS NULL AND kv_fassung IS NULL AND lagerort IS NULL) OR (kv_id IS NOT NULL AND kv_fassung IS NOT NULL AND lagerort IS NOT NULL));
CREATE INDEX goods_receipt_quote_tenant ON public.goods_receipt(tenant_id,kv_id,erstellt_am) WHERE kv_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.protect_goods_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF OLD.status<>'entwurf' AND NEW.status='entwurf' THEN RAISE EXCEPTION 'GOODS_RECEIPT_STATE_REGRESSION' USING ERRCODE='23514'; END IF;
 IF ROW(NEW.id,NEW.tenant_id,NEW.client_key,NEW.modus,NEW.kv_id,NEW.kv_fassung,NEW.lagerort)
   IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id,OLD.client_key,OLD.modus,OLD.kv_id,OLD.kv_fassung,OLD.lagerort)
   OR (OLD.item_id IS NOT NULL AND NEW.item_id IS DISTINCT FROM OLD.item_id)
 THEN RAISE EXCEPTION 'GOODS_RECEIPT_IDENTITY_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NEW.auftrag_id IS DISTINCT FROM OLD.auftrag_id AND NOT (
   OLD.auftrag_id IS NULL AND OLD.kv_id IS NOT NULL AND NEW.auftrag_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM private.quotes q WHERE q.tenant_id=NEW.tenant_id AND q.id=NEW.kv_id AND q.linked_order_id=NEW.auftrag_id)
 ) THEN RAISE EXCEPTION 'GOODS_RECEIPT_ORDER_BINDING_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $fn$;

CREATE VIEW public.v_quote_goods_receipt_v1 WITH(security_invoker=true) AS
SELECT receipt.*,
 (quote.linked_order_id IS NULL AND (quote.zugesagt_fassung IS DISTINCT FROM quote.fassung OR quote.zugesagt_am IS NULL OR nullif(btrim(quote.zusage_nachweis),'') IS NULL OR quote.abgesagt_am IS NOT NULL)) AS gesperrt
FROM public.goods_receipt receipt JOIN private.quotes quote ON quote.tenant_id=receipt.tenant_id AND quote.id=receipt.kv_id
WHERE receipt.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'');
REVOKE ALL ON public.v_quote_goods_receipt_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_quote_goods_receipt_v1 TO service_role;
