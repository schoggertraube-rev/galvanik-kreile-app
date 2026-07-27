\set ON_ERROR_STOP on

BEGIN;
SET TRANSACTION READ ONLY;

DO $validation$
DECLARE
  confidence_count bigint;
  classified_count bigint;
  confidence_digest text;
BEGIN
  SELECT
    count(*),
    pg_catalog.md5(coalesce(pg_catalog.string_agg(
      pg_catalog.concat_ws('|', id::text, ocr_confidence::text),
      E'\n'
      ORDER BY id::text
    ), ''))
  INTO confidence_count, confidence_digest
  FROM public.beleg
  WHERE ocr_confidence IS NOT NULL;

  SELECT count(*)
  INTO classified_count
  FROM public.beleg
  WHERE ocr_confidence IS NOT NULL
    AND ocr_confidence_scale = 'fraction';

  IF confidence_count <> 15
     OR classified_count <> confidence_count
     OR confidence_digest IS DISTINCT FROM '897411d5f1d8f1610e3c00489fc60f30' THEN
    RAISE EXCEPTION
      'OCR_CONFIDENCE_LOCAL_VALIDATION_FAILED: restored-snapshot values were changed or incompletely classified';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.beleg
    WHERE (ocr_confidence IS NULL AND ocr_confidence_scale IS NOT NULL)
       OR ocr_confidence_scale NOT IN ('fraction', 'percent')
       OR ocr_confidence::text IN ('NaN', 'Infinity', '-Infinity')
       OR ocr_confidence < 0
       OR ocr_confidence > 100
       OR (
         ocr_confidence_scale = 'fraction'
         AND ocr_confidence > 1
       )
  ) THEN
    RAISE EXCEPTION
      'OCR_CONFIDENCE_LOCAL_VALIDATION_FAILED: confidence and scale disagree';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.beleg'::regclass
      AND conname IN (
        'beleg_ocr_confidence_range_chk',
        'beleg_ocr_confidence_scale_chk',
        'beleg_ocr_confidence_scale_value_chk'
      )
      AND convalidated
  ) <> 3 THEN
    RAISE EXCEPTION
      'OCR_CONFIDENCE_LOCAL_VALIDATION_FAILED: expected three validated confidence constraints';
  END IF;
END
$validation$;

SELECT 'ocr_confidence_scale_validation_ok' AS result;

ROLLBACK;
