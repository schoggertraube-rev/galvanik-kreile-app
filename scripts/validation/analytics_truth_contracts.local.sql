\set ON_ERROR_STOP on

BEGIN;

DO $catalog_prefixes$
DECLARE
  columns_text text;
BEGIN
  SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
  INTO columns_text
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'v_analyse_kunden_kpi';

  IF columns_text <>
    'customer_id,kunde,classification,kunde_seit,umsatz_ltv,gewinn_ltv,offene_posten,aktive_auftraege,puenklichkeit_pct,reklamationen,tenant_id'
  THEN
    RAISE EXCEPTION 'ANALYTICS_CUSTOMER_KPI_PREFIX_INVALID: %', columns_text;
  END IF;

  SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
  INTO columns_text
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'v_kunde_clv';

  IF columns_text <>
    'customer_id,name,company_name,kundentyp,erstkontakt,auftraege_gesamt,auftraege_12m,umsatz_gesamt,db_gesamt,db_marge,letzter_auftrag,reklamationen,avg_durchlauf_tage,avg_zahlungsverzug_tage,tenant_id'
  THEN
    RAISE EXCEPTION 'ANALYTICS_CLV_PREFIX_INVALID: %', columns_text;
  END IF;

  SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
  INTO columns_text
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'v_periodenabschluss_status';

  IF columns_text <>
    'id,jahr,monat,status,geschlossen_am,belege_ohne_konto,belege_ohne_kostenstelle,rechnungen_ohne_auftrag,rechnungen_offen,auftraege_ohne_db,tenant_id'
  THEN
    RAISE EXCEPTION 'ANALYTICS_PERIOD_PREFIX_INVALID: %', columns_text;
  END IF;

  SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
  INTO columns_text
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'v_pipeline_forecast';

  IF columns_text <>
    'erwarteter_monat,anz_auftraege,pipeline_wert_gewichtet,pipeline_wert_ungewichtet,auftraege_ohne_erloes_evidenz,tenant_id'
  THEN
    RAISE EXCEPTION 'ANALYTICS_PIPELINE_PREFIX_INVALID: %', columns_text;
  END IF;
END
$catalog_prefixes$;

INSERT INTO public.customers (
  id,
  tenant_id,
  name,
  type
) VALUES
  (
    'analytics-truth-primary',
    'galvanik-kreile',
    'Analytics Truth Primary',
    'business'
  ),
  (
    'analytics-truth-other',
    'other-tenant',
    'Analytics Truth Other',
    'business'
  );

INSERT INTO public.ausgangsrechnung (
  id,
  tenant_id,
  nummer,
  kunde_id,
  datum,
  faellig_am,
  brutto,
  netto,
  status,
  bezahlt_betrag_eur,
  is_demo
) VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    'galvanik-kreile',
    'ANALYTICS-TRUTH-PRIMARY',
    'analytics-truth-primary',
    '2098-01-01',
    '2098-01-31',
    119,
    100,
    'teilbezahlt',
    19,
    false
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'other-tenant',
    'ANALYTICS-TRUTH-OTHER',
    'analytics-truth-other',
    '2098-01-01',
    '2098-01-31',
    777,
    700,
    'offen',
    0,
    false
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'galvanik-kreile',
    'ANALYTICS-TRUTH-CANCELLED',
    'analytics-truth-primary',
    '2098-01-01',
    '2098-01-31',
    999,
    900,
    'storniert',
    0,
    false
  );

DO $receivable_truth$
DECLARE
  primary_open numeric;
  other_open numeric;
BEGIN
  SELECT offene_posten
  INTO primary_open
  FROM public.v_analyse_kunden_kpi
  WHERE tenant_id = 'galvanik-kreile'
    AND customer_id = 'analytics-truth-primary';

  SELECT offene_posten
  INTO other_open
  FROM public.v_analyse_kunden_kpi
  WHERE tenant_id = 'other-tenant'
    AND customer_id = 'analytics-truth-other';

  IF primary_open IS DISTINCT FROM 100::numeric
     OR other_open IS DISTINCT FROM 777::numeric THEN
    RAISE EXCEPTION
      'ANALYTICS_REMAINING_RECEIVABLE_INVALID: primary=%, other=%',
      primary_open,
      other_open;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.v_analyse_kunden_kpi
    WHERE customer_id = 'analytics-truth-primary'
      AND tenant_id <> 'galvanik-kreile'
  ) OR EXISTS (
    SELECT 1
    FROM public.v_analyse_kunden_kpi
    WHERE customer_id = 'analytics-truth-other'
      AND tenant_id <> 'other-tenant'
  ) THEN
    RAISE EXCEPTION 'ANALYTICS_TENANT_LEAK_DETECTED';
  END IF;
END
$receivable_truth$;

DO $disabled_capabilities$
BEGIN
  IF EXISTS (SELECT 1 FROM public.v_pipeline_forecast)
     OR has_table_privilege('service_role', 'public.v_pipeline_forecast', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.v_analyse_kunden_kpi', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.v_kunde_clv', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.v_periodenabschluss_status', 'SELECT')
     OR has_function_privilege('service_role', 'public.fn_compute_warnings(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fn_compute_warnings(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_compute_warnings(text)', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'ANALYTICS_DISABLED_CAPABILITY_ACL_INVALID';
  END IF;
END
$disabled_capabilities$;

SELECT 'analytics_truth_contracts_ok' AS result;

ROLLBACK;
