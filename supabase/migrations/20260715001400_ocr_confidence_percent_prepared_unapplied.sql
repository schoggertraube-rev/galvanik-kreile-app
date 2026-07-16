-- APPROVAL REQUIRED - PREPARED, NOT APPLIED BY THIS MISSION.
-- Canonicalize legacy fractional OCR confidence values to percent (0..100).

BEGIN;

DO $migration$
BEGIN
  IF to_regclass('public.beleg') IS NULL THEN
    RAISE EXCEPTION 'Required table public.beleg is missing';
  END IF;

  UPDATE public.beleg
  SET ocr_confidence = round(ocr_confidence * 100, 2)
  WHERE ocr_confidence IS NOT NULL
    AND ocr_confidence >= 0
    AND ocr_confidence <= 1;

  IF EXISTS (
    SELECT 1
    FROM public.beleg
    WHERE ocr_confidence IS NOT NULL
      AND (ocr_confidence < 0 OR ocr_confidence > 100)
  ) THEN
    RAISE EXCEPTION 'Existing OCR confidence is outside the canonical 0..100 range';
  END IF;

  ALTER TABLE public.beleg
    DROP CONSTRAINT IF EXISTS beleg_ocr_confidence_percent;
  ALTER TABLE public.beleg
    ADD CONSTRAINT beleg_ocr_confidence_percent
    CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 100));
END
$migration$;

COMMENT ON COLUMN public.beleg.ocr_confidence IS
  'Provider confidence in percent (0..100). This is not an accounting approval.';

COMMIT;
