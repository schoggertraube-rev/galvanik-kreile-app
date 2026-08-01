-- Pipeline: offene KVs × Erfolgswahrscheinlichkeit nach Alter
CREATE OR REPLACE VIEW v_pipeline_forecast AS
SELECT
  date_trunc('month', o.due_date)::date AS erwarteter_monat,
  COUNT(*) AS anz_auftraege,
  SUM(CASE
    WHEN o.intake_date > NOW() - INTERVAL '7 days' THEN COALESCE(ar.netto, 0) * 0.80
    WHEN o.intake_date > NOW() - INTERVAL '21 days' THEN COALESCE(ar.netto, 0) * 0.60
    WHEN o.intake_date > NOW() - INTERVAL '45 days' THEN COALESCE(ar.netto, 0) * 0.30
    ELSE COALESCE(ar.netto, 0) * 0.10
  END) AS pipeline_wert_gewichtet,
  SUM(COALESCE(ar.netto, 0)) AS pipeline_wert_ungewichtet
FROM orders o
LEFT JOIN ausgangsrechnung ar ON ar.order_id = o.id
WHERE o.status NOT IN ('completed','abgeschlossen','cancelled','storniert')
  AND o.due_date IS NOT NULL
  AND (o.tenant_id = 'galvanik-kreile' OR o.tenant_id IS NULL)
GROUP BY 1
ORDER BY 1;
