BEGIN;
SELECT set_config('app.tenant_id','TEST-W1',true);
DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM private.lager_w1_altverbrauch) THEN
    RAISE EXCEPTION 'TEST unerwartete Altverbrauchszeilen für TEST-W1';
  END IF;

  BEGIN
    INSERT INTO public.consumable_uses (tenant_id,order_id,station_kuerzel,item_name,quantity,unit,unit_cost_eur)
      VALUES ('TEST-W1','TEST-W1-AUFTRAG','TEST','TEST Veralteter Schreiber',1,'l',1);
    RAISE EXCEPTION 'TEST W1 Alter Schreiber weiterhin aktiv';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'LAGER_JOURNAL_UNVERAENDERLICH' THEN RAISE; END IF;
  END;
END;
$test$;
ROLLBACK;
