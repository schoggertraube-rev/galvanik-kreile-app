-- K13K-6: quote_conversion_receipts.created_at is timestamptz;
-- production snapshots retain UTC-naive occurred_at. Compare actual instants.
-- Preserve all original evidence, tenant, actor, amount and reversal checks.
DO $migration$
DECLARE
  body text;
  previous text := 'receipt.created_at<=NEW.occurred_at';
  corrected text := 'receipt.created_at<=(NEW.occurred_at AT TIME ZONE ''UTC'')';
BEGIN
  SELECT pg_get_functiondef('private.guard_order_production_snapshot()'::regprocedure) INTO body;
  IF (length(body)-length(replace(body,previous,'')))<>length(previous) THEN
    RAISE EXCEPTION 'S13K_HISTORICAL_QUOTE_TIME_CONTRACT_CHANGED';
  END IF;
  EXECUTE replace(body,previous,corrected);
END;
$migration$;
