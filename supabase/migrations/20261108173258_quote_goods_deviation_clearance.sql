-- AF-5: inspection facts remain; an explicit actor receipt releases the deviation.
CREATE UNIQUE INDEX intake_event_quote_goods_clearance_revision
ON public.intake_event(tenant_id,(nachher->>'receiptId'),(nachher->>'receiptVersion'))
WHERE art='ware' AND nachher->>'action'='kv.abweichung_geklaert';

CREATE OR REPLACE VIEW public.v_quote_goods_receipt_v1 WITH(security_invoker=true) AS
SELECT receipt.*,
 (quote.linked_order_id IS NULL AND (quote.zugesagt_fassung IS DISTINCT FROM quote.fassung OR quote.zugesagt_am IS NULL OR nullif(btrim(quote.zusage_nachweis),'') IS NULL OR quote.abgesagt_am IS NOT NULL
 OR ((receipt.zustand IS DISTINCT FROM 'unauffaellig' OR cardinality(receipt.abweichung)>0 OR receipt.packstuecke_da IS DISTINCT FROM receipt.packstuecke_gesamt OR receipt.verfahren_wie_kv IS DISTINCT FROM 'stimmt') AND cleared.nachher IS NULL))) AS gesperrt,
 returned.nachher->'receipt' AS rueckgabe,
 cleared.nachher->'clearance' AS abweichung_geklaert
FROM public.goods_receipt receipt
JOIN private.quotes quote ON quote.tenant_id=receipt.tenant_id AND quote.id=receipt.kv_id
LEFT JOIN LATERAL (
 SELECT event.nachher FROM public.intake_event event
 WHERE event.tenant_id=receipt.tenant_id AND event.item_id=receipt.item_id
 AND event.art='ware' AND event.nachher->>'action'='kv.ware_zurueckgegeben'
 AND event.nachher->>'receiptId'=receipt.id::text
 ORDER BY event.zeit,event.id LIMIT 1
) returned ON true
LEFT JOIN LATERAL (
 SELECT event.nachher FROM public.intake_event event
 WHERE event.tenant_id=receipt.tenant_id AND event.item_id=receipt.item_id AND event.art='ware'
 AND event.nachher->>'action'='kv.abweichung_geklaert' AND event.nachher->>'receiptId'=receipt.id::text
 AND event.nachher->>'receiptVersion'=receipt.version::text
 ORDER BY event.zeit,event.id DESC LIMIT 1
) cleared ON true
WHERE receipt.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'');
REVOKE ALL ON public.v_quote_goods_receipt_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_quote_goods_receipt_v1 TO service_role;
