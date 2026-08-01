-- Migration: v_analyse_werkstatt_puls_economics
-- View für Werkstatt-Puls Economics: Auftragswert, DB, Verzögerungskosten pro offenem Auftrag
-- Nutzt reale Spaltennamen aus bestehendem Schema

CREATE OR REPLACE VIEW v_analyse_werkstatt_puls_economics AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.customer_id,
  c.name AS customer_name,
  COALESCE(o.current_station, o.station) AS station_id,
  COALESCE(o.current_station, o.station) AS station_name,

  -- Auftragswert: Rechnung > Freigabe > Schätzung
  COALESCE(
    ar_sum.netto_sum,
    ofi.invoiced_revenue_net_eur,
    ofi.approved_revenue_net_eur,
    ofi.expected_revenue_net_eur
  ) AS revenue_reference_eur,

  CASE
    WHEN ar_sum.netto_sum IS NOT NULL THEN 'invoice'
    WHEN ofi.invoiced_revenue_net_eur IS NOT NULL THEN 'invoiced'
    WHEN ofi.approved_revenue_net_eur IS NOT NULL THEN 'approved'
    WHEN ofi.expected_revenue_net_eur IS NOT NULL THEN 'expected'
    ELSE 'missing'
  END AS revenue_source,

  -- DB aus v_auftrag_db (live berechnet)
  vdb.deckungsbeitrag AS db_ist,
  vdb.db_marge,
  vdb.erloes_netto,
  vdb.material_kosten,
  vdb.arbeitszeit_kosten,

  -- Verzögerung
  CASE
    WHEN o.promised_due_date IS NOT NULL AND o.completed_date IS NULL
    THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - o.promised_due_date)) / 86400.0)::numeric
    ELSE 0
  END AS delay_days,

  -- Belegte Verzögerungskosten
  COALESCE(oce_sum.actual_delay_cost_eur, 0) AS actual_delay_cost_eur,

  -- Modellierte Verzögerungskosten (nur wenn kpi_cost_assumptions konfiguriert)
  CASE
    WHEN kca_delay.value_numeric IS NOT NULL AND o.promised_due_date IS NOT NULL AND o.completed_date IS NULL
    THEN GREATEST(0, EXTRACT(EPOCH FROM (now() - o.promised_due_date)) / 86400.0) * kca_delay.value_numeric
    ELSE NULL
  END AS model_delay_risk_eur,

  -- Confidence
  CASE
    WHEN ar_sum.netto_sum IS NOT NULL OR ofi.invoiced_revenue_net_eur IS NOT NULL THEN 'high'
    WHEN ofi.approved_revenue_net_eur IS NOT NULL THEN 'medium'
    WHEN ofi.expected_revenue_net_eur IS NOT NULL THEN 'low'
    ELSE 'none'
  END AS confidence,

  -- Fehlende Grundlagen
  ARRAY_REMOVE(ARRAY[
    CASE WHEN COALESCE(ar_sum.netto_sum, ofi.invoiced_revenue_net_eur, ofi.approved_revenue_net_eur, ofi.expected_revenue_net_eur) IS NULL
         THEN 'Auftragswert fehlt' END,
    CASE WHEN vdb.deckungsbeitrag IS NULL AND vdb.erloes_netto = 0
         THEN 'DB-Grundlage fehlt' END,
    CASE WHEN kca_delay.value_numeric IS NULL
         THEN 'Terminrisiko-Modell nicht konfiguriert' END,
    CASE WHEN o.promised_due_date IS NULL
         THEN 'Zusagetermin fehlt' END
  ], NULL) AS missing_reasons

FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
LEFT JOIN order_financials ofi ON ofi.order_id = o.id
LEFT JOIN v_auftrag_db vdb ON vdb.order_id = o.id
LEFT JOIN (
  SELECT ar.order_id, SUM(ar.netto) AS netto_sum
  FROM ausgangsrechnung ar
  WHERE (ar.is_demo IS NULL OR ar.is_demo = false)
  GROUP BY ar.order_id
) ar_sum ON ar_sum.order_id = o.id
LEFT JOIN (
  SELECT oce.order_id, SUM(oce.amount_eur) AS actual_delay_cost_eur
  FROM order_cost_events oce
  WHERE oce.caused_by IN ('delay', 'engpass', 'terminrettung')
  GROUP BY oce.order_id
) oce_sum ON oce_sum.order_id = o.id
LEFT JOIN kpi_cost_assumptions kca_delay
  ON kca_delay.key = 'delay_cost_per_day_eur'
 AND kca_delay.is_active = true
 AND kca_delay.tenant_id = o.tenant_id
WHERE o.tenant_id = 'galvanik-kreile'
  AND COALESCE(o.status, '') NOT IN ('closed', 'abgeschlossen', 'cancelled', 'storniert')

NOTIFY pgrst, 'reload schema'
