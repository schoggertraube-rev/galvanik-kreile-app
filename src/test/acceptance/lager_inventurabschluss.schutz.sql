BEGIN;
GRANT UPDATE, DELETE, TRUNCATE ON public.inventory_lines TO service_role;
SET LOCAL ROLE service_role;
DO $abnahme$
BEGIN
  BEGIN
    UPDATE public.inventory_lines SET position = position;
    RAISE EXCEPTION 'TEST unveränderliche Inventurzeile aktualisierbar';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'LAGER_JOURNAL_UNVERAENDERLICH' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.inventory_lines;
    RAISE EXCEPTION 'TEST unveränderliche Inventurzeile löschbar';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'LAGER_JOURNAL_UNVERAENDERLICH' THEN RAISE; END IF;
  END;
  BEGIN
    TRUNCATE public.inventory_lines;
    RAISE EXCEPTION 'TEST unveränderliche Inventurzeile trennbar';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'LAGER_JOURNAL_UNVERAENDERLICH' THEN RAISE; END IF;
  END;
END;
$abnahme$;
RESET ROLE;
ROLLBACK;
