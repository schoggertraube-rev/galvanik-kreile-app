-- The original inspection remains immutable evidence. Physical return is an audited event.
CREATE UNIQUE INDEX intake_event_quote_goods_return_once
ON public.intake_event(tenant_id,(nachher->>'receiptId'))
WHERE art='ware' AND nachher->>'action'='kv.ware_zurueckgegeben';

CREATE OR REPLACE VIEW public.v_quote_goods_receipt_v1 WITH(security_invoker=true) AS
SELECT receipt.*,
 (quote.linked_order_id IS NULL AND (quote.zugesagt_fassung IS DISTINCT FROM quote.fassung OR quote.zugesagt_am IS NULL OR nullif(btrim(quote.zusage_nachweis),'') IS NULL OR quote.abgesagt_am IS NOT NULL)) AS gesperrt,
 returned.nachher->'receipt' AS rueckgabe
FROM public.goods_receipt receipt
JOIN private.quotes quote ON quote.tenant_id=receipt.tenant_id AND quote.id=receipt.kv_id
LEFT JOIN LATERAL (
 SELECT event.nachher FROM public.intake_event event
 WHERE event.tenant_id=receipt.tenant_id AND event.item_id=receipt.item_id
 AND event.art='ware' AND event.nachher->>'action'='kv.ware_zurueckgegeben'
 AND event.nachher->>'receiptId'=receipt.id::text
 ORDER BY event.zeit,event.id LIMIT 1
) returned ON true
WHERE receipt.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'');
REVOKE ALL ON public.v_quote_goods_receipt_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_quote_goods_receipt_v1 TO service_role;
