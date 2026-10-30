-- P1b erweitert den bestehenden CUSTOMER_CREATED_V1-Beleg um die fachliche
-- Vollstaendigkeitsmarkierung. Der append-only Vertrag bleibt ansonsten unveraendert.
ALTER TABLE public.events
  DROP CONSTRAINT events_customer_created_v1_contract_chk;

ALTER TABLE public.events
  ADD CONSTRAINT events_customer_created_v1_contract_chk
  CHECK (
    event_type <> 'CUSTOMER_CREATED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version = 1
      AND from_station IS NULL
      AND station IS NULL
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload->>'customerId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND payload->>'customerNumber' ~ '^K-[0-9]{4}-[0-9]{4,}$'
      AND payload->>'intentSha256' ~ '^[0-9a-f]{64}$'
      AND payload - 'completeForOrder' = jsonb_build_object(
        'customerId', payload->>'customerId',
        'customerNumber', payload->>'customerNumber',
        'intentSha256', payload->>'intentSha256'
      )
      AND (
        NOT payload ? 'completeForOrder'
        OR jsonb_typeof(payload->'completeForOrder') = 'boolean'
      )
    ), false)
  ) NOT VALID;
