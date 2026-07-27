\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public.ausgangsrechnung (
  nummer,
  datum,
  brutto,
  status,
  is_demo,
  tenant_id
) VALUES (
  'LOCAL-UNIQUE-VALIDATION',
  CURRENT_DATE,
  1,
  'offen',
  false,
  'galvanik-kreile'
);

DO $productive_duplicate$
BEGIN
  BEGIN
    INSERT INTO public.ausgangsrechnung (
      nummer,
      datum,
      brutto,
      status,
      is_demo,
      tenant_id
    ) VALUES (
      'LOCAL-UNIQUE-VALIDATION',
      CURRENT_DATE,
      2,
      'offen',
      false,
      'galvanik-kreile'
    );
    RAISE EXCEPTION 'Duplicate productive invoice number was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$productive_duplicate$;

INSERT INTO public.ausgangsrechnung (
  nummer,
  datum,
  brutto,
  status,
  is_demo,
  tenant_id
) VALUES
  ('LOCAL-DEMO-DUPLICATE', CURRENT_DATE, 1, 'offen', true, 'galvanik-kreile'),
  ('LOCAL-DEMO-DUPLICATE', CURRENT_DATE, 2, 'offen', true, 'galvanik-kreile');

DO $final_check$
BEGIN
  IF (
    SELECT count(*)
    FROM public.ausgangsrechnung
    WHERE tenant_id = 'galvanik-kreile'
      AND nummer = 'LOCAL-DEMO-DUPLICATE'
      AND is_demo IS TRUE
  ) <> 2 THEN
    RAISE EXCEPTION 'Historical demo duplicate exception is not operational';
  END IF;
END
$final_check$;

SELECT 'invoice_number_uniqueness_validation_ok' AS result;

ROLLBACK;
