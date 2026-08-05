-- Close the legacy Data API exposure. Application reads and writes for these
-- tables are performed only by authenticated server code.
--
-- This intentionally changes grants only. It does not introduce speculative
-- tenant policies for tables whose ownership model has not yet been proven.

REVOKE ALL PRIVILEGES ON TABLE
  public.aktion,
  public.attribution,
  public.einwilligung,
  public.feedback_eingang,
  public.feedback_mail,
  public.forecast_version,
  public.inventory_items,
  public.kampagne,
  public.kanal,
  public.kosten_posten,
  public.kostensatz_default,
  public.kostenstelle,
  public.kostenstellen_energie_monat,
  public.lern_metrik,
  public.marketing_asset,
  public.marketing_touchpoints,
  public.periode,
  public.price_agreements,
  public.segment,
  public.statistik_kennzahl,
  public.teile_klassifikator,
  public.telemetrie_event,
  public.touchpoint,
  public.vorlage_verbrauch,
  public.vorlage_zeit,
  public.warning_event
FROM anon, authenticated;

DO $$
DECLARE
  exposed_table text;
BEGIN
  SELECT table_name
  INTO exposed_table
  FROM (VALUES
    ('aktion'),
    ('attribution'),
    ('einwilligung'),
    ('feedback_eingang'),
    ('feedback_mail'),
    ('forecast_version'),
    ('inventory_items'),
    ('kampagne'),
    ('kanal'),
    ('kosten_posten'),
    ('kostensatz_default'),
    ('kostenstelle'),
    ('kostenstellen_energie_monat'),
    ('lern_metrik'),
    ('marketing_asset'),
    ('marketing_touchpoints'),
    ('periode'),
    ('price_agreements'),
    ('segment'),
    ('statistik_kennzahl'),
    ('teile_klassifikator'),
    ('telemetrie_event'),
    ('touchpoint'),
    ('vorlage_verbrauch'),
    ('vorlage_zeit'),
    ('warning_event')
  ) AS protected_tables(table_name)
  WHERE EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants grants
    WHERE grants.table_schema = 'public'
      AND grants.table_name = protected_tables.table_name
      AND grants.grantee IN ('anon', 'authenticated')
  )
  LIMIT 1;

  IF exposed_table IS NOT NULL THEN
    RAISE EXCEPTION 'Data API grants remain on public.%', exposed_table;
  END IF;
END
$$;
