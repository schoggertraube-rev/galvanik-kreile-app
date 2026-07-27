-- PREPARED CONTRACT ONLY: apply after the scale-aware application is deployed
-- and every old writer is drained.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

LOCK TABLE public.beleg IN SHARE ROW EXCLUSIVE MODE;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.beleg
    WHERE ocr_confidence IS NOT NULL
      AND ocr_confidence_scale IS NULL
  ) THEN
    RAISE EXCEPTION
      'OCR_CONFIDENCE_CONTRACT_BLOCKED: non-null confidence lacks explicit scale';
  END IF;
END
$preflight$;

UPDATE public.beleg
SET
  ocr_confidence = round(ocr_confidence * 100, 2),
  ocr_confidence_scale = 'percent'
WHERE ocr_confidence_scale = 'fraction';

ALTER TABLE public.beleg
  DROP CONSTRAINT IF EXISTS beleg_ocr_confidence_range_chk,
  DROP CONSTRAINT IF EXISTS beleg_ocr_confidence_scale_chk,
  DROP CONSTRAINT IF EXISTS beleg_ocr_confidence_scale_value_chk,
  DROP CONSTRAINT IF EXISTS beleg_ocr_confidence_percent_contract_chk;

ALTER TABLE public.beleg
  ADD CONSTRAINT beleg_ocr_confidence_percent_contract_chk
    CHECK (
      (ocr_confidence IS NULL AND ocr_confidence_scale IS NULL)
      OR (
        ocr_confidence >= 0
        AND ocr_confidence <= 100
        AND ocr_confidence::text NOT IN ('NaN', 'Infinity', '-Infinity')
        AND ocr_confidence_scale = 'percent'
      )
    ) NOT VALID;

ALTER TABLE public.beleg
  VALIDATE CONSTRAINT beleg_ocr_confidence_percent_contract_chk;

COMMENT ON COLUMN public.beleg.ocr_confidence IS
  'Provider confidence in percent (0..100), backed by ocr_confidence_scale=percent. This is not an accounting approval.';
