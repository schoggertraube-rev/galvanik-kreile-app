-- K13K-1: actual replay inventory contains 26 tables (audit reported 25).
-- Existing server readers already use the authorized service-role boundary.
-- No data is changed and no client policy or new grant is introduced.
DO $s13k$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'aktion','attribution','einwilligung','feedback_eingang','feedback_mail',
    'forecast_version','inventory_items','kampagne','kanal','kosten_posten',
    'kostensatz_default','kostenstelle','kostenstellen_energie_monat','lern_metrik',
    'marketing_asset','marketing_touchpoints','periode','price_agreements','segment',
    'statistik_kennzahl','teile_klassifikator','telemetrie_event','touchpoint',
    'vorlage_verbrauch','vorlage_zeit','warning_event'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
  END LOOP;
END;
$s13k$;
