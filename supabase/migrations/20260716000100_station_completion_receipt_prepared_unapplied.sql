-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Additive upgrade for databases that already created capture_request_receipts
-- before station_completion became an atomic capture kind.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $constraint$
BEGIN
  IF to_regclass('public.capture_request_receipts') IS NULL THEN
    RAISE EXCEPTION 'capture_request_receipts is missing; apply the prepared capture integrity migration first';
  END IF;

  ALTER TABLE public.capture_request_receipts
    DROP CONSTRAINT IF EXISTS capture_request_receipts_kind_check;
  ALTER TABLE public.capture_request_receipts
    ADD CONSTRAINT capture_request_receipts_kind_check
    CHECK (kind IN ('time', 'material', 'template', 'station_completion')) NOT VALID;
  ALTER TABLE public.capture_request_receipts
    VALIDATE CONSTRAINT capture_request_receipts_kind_check;
END
$constraint$;
