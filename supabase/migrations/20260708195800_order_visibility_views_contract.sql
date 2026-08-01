-- Migration: order_visibility_views_contract
-- Created: 2026-07-08

-- A. central production orders view representing isProductionOrderVisible
CREATE OR REPLACE VIEW v_production_orders AS
SELECT *
FROM orders
WHERE tenant_id = 'galvanik-kreile'
  AND source IS NOT NULL
  AND LOWER(source) IN ('manual', 'scan', 'customer')
  AND customer_id IS NOT NULL
  AND TRIM(customer_id) <> ''
  AND order_number IS NOT NULL
  AND TRIM(order_number) <> ''
  AND order_number !~* '^A-SEED-'
  AND order_number !~* 'TEST'
  AND (COALESCE(TRIM(title), '') <> '' OR COALESCE(TRIM(task), '') <> '')
  -- Gibberish/Test title/task check
  AND NOT (
    (title IS NOT NULL AND TRIM(title) <> '' AND (
      LENGTH(TRIM(title)) < 3 OR
      TRIM(title) ~* '^[bcdfghjklmnpqrstvwxyz]{5,}' OR
      TRIM(title) ~* 'asd|sdf|dfg|fgh|ghj|hjk|jkl|yxc|xcv|cvb|vbn|bnm' OR
      TRIM(title) ~* $$^([a-z])\1+$$ OR
      LOWER(TRIM(title)) IN ('gjgvvh', 'sfdghgjklji') OR
      LOWER(TRIM(title)) LIKE '%auftrag per scan test e2e%' OR
      LOWER(TRIM(title)) LIKE '%test order%' OR
      LOWER(TRIM(title)) LIKE '%test stoßstange kundenakte%'
    ))
    OR
    (task IS NOT NULL AND TRIM(task) <> '' AND (
      LENGTH(TRIM(task)) < 3 OR
      TRIM(task) ~* '^[bcdfghjklmnpqrstvwxyz]{5,}' OR
      TRIM(task) ~* 'asd|sdf|dfg|fgh|ghj|hjk|jkl|yxc|xcv|cvb|vbn|bnm' OR
      TRIM(task) ~* $$^([a-z])\1+$$ OR
      LOWER(TRIM(task)) IN ('gjgvvh', 'sfdghgjklji') OR
      LOWER(TRIM(task)) LIKE '%auftrag per scan test e2e%' OR
      LOWER(TRIM(task)) LIKE '%test order%' OR
      LOWER(TRIM(task)) LIKE '%test stoßstange kundenakte%'
    ))
  )
  -- Keyword scan
  AND NOT (
    order_number ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder' OR
    title ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder' OR
    task ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'
  )

-- B. Central helper function using v_production_orders
CREATE OR REPLACE FUNCTION fn_is_production_order(p_order_id text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM v_production_orders WHERE id = p_order_id
  );
END;
$$ LANGUAGE plpgsql STABLE

-- C. Pflicht-Views neu definieren
-- 1. v_analyse_termintreue
CREATE OR REPLACE VIEW v_analyse_termintreue AS
SELECT
  count(*) FILTER (
    WHERE completed_date IS NOT NULL
      AND promised_due_date IS NOT NULL
      AND completed_date <= promised_due_date
  ) AS puenktlich,
  count(*) FILTER (
    WHERE completed_date IS NOT NULL
      AND promised_due_date IS NOT NULL
  ) AS nenner,
  CASE
    WHEN count(*) FILTER (WHERE completed_date IS NOT NULL AND promised_due_date IS NOT NULL) > 0
    THEN round(
      count(*) FILTER (WHERE completed_date <= promised_due_date AND completed_date IS NOT NULL AND promised_due_date IS NOT NULL)
      * 100.0
      / count(*) FILTER (WHERE completed_date IS NOT NULL AND promised_due_date IS NOT NULL),
      1
    )
    ELSE NULL
  END AS termintreue_pct,
  count(*) FILTER (
    WHERE promised_due_date IS NULL AND status != 'storniert'
  ) AS ohne_zusagetermin
FROM v_production_orders
WHERE created_at >= date_trunc('week', now())

-- 2. v_analyse_durchlaufzeit
CREATE OR REPLACE VIEW v_analyse_durchlaufzeit AS
SELECT
  round(avg(EXTRACT(EPOCH FROM (completed_date - created_at)) / 86400.0)::numeric, 1)
    AS avg_tage,
  count(*) AS n
FROM v_production_orders
WHERE completed_date IS NOT NULL
  AND completed_date >= now() - interval '30 days'

-- 3. v_analyse_wochenziel
CREATE OR REPLACE VIEW v_analyse_wochenziel AS
SELECT
  count(*) AS fertig_diese_woche
FROM v_production_orders
WHERE completed_date IS NOT NULL
  AND completed_date >= date_trunc('week', now())

-- 4. v_analyse_station_durchlauf
CREATE OR REPLACE VIEW v_analyse_station_durchlauf AS
WITH eingang AS (
  SELECT order_id, station, MIN(created_at) AS ts_ein
  FROM events
  WHERE event_type = 'STATION_EINGANG' AND station IS NOT NULL
    AND fn_is_production_order(order_id)
  GROUP BY order_id, station
),
ausgang AS (
  SELECT order_id, station, MAX(created_at) AS ts_aus
  FROM events
  WHERE event_type = 'STATION_AUSGANG' AND station IS NOT NULL
    AND fn_is_production_order(order_id)
  GROUP BY order_id, station
)
SELECT
  e.station,
  round(avg(EXTRACT(EPOCH FROM (a.ts_aus - e.ts_ein)) / 86400.0)::numeric, 1) AS avg_tage,
  count(*) AS n,
  -- Engpass-Info: wie viele aktuell IN dieser Station (kein Ausgang)
  (SELECT count(*) FROM items WHERE current_station_id = e.station AND fn_is_production_order(order_id)) AS teile_aktuell
FROM eingang e
JOIN ausgang a ON a.order_id = e.order_id AND a.station = e.station
WHERE e.ts_ein >= now() - interval '30 days'
GROUP BY e.station

-- 5. v_auftrag_db
CREATE OR REPLACE VIEW v_auftrag_db AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.customer_id,
  c.name AS kunde_name,
  c.company_name,
  o.intake_date,
  o.status,
  o.current_station,
  o.due_date,
  -- Erlös
  COALESCE((
    SELECT SUM(ar.netto) FROM ausgangsrechnung ar
    WHERE ar.order_id = o.id
      AND (ar.is_demo IS NULL OR ar.is_demo = false)
      AND ar.tenant_id = 'galvanik-kreile'
  ), 0) AS erloes_netto,
  -- Materialkosten
  COALESCE((
    SELECT SUM(abs(sm.quantity) * COALESCE(sm.snapshot_einkaufspreis_eur, 0))
    FROM stock_movements sm
    WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch'
      AND sm.tenant_id = 'galvanik-kreile'
  ), 0) AS material_kosten,
  -- Arbeitszeitkosten
  COALESCE((
    SELECT SUM(zb.dauer_minuten / 60.0 * zb.kostensatz_eur_pro_stunde)
    FROM arbeitszeit_buchung zb
    WHERE zb.auftrag_id = o.id
      AND zb.tenant_id = 'galvanik-kreile'
  ), 0) AS arbeitszeit_kosten,
  -- Energieanteil (über Energie-Verteilung pro Stationsstunde)
  COALESCE((
    SELECT SUM(zb.dauer_minuten / 60.0 * COALESCE(kem.energie_eur_pro_stunde, 0))
    FROM arbeitszeit_buchung zb
    LEFT JOIN kostenstelle ks_bridge
      ON ks_bridge.kuerzel = zb.kostenstelle_kuerzel AND ks_bridge.tenant_id = zb.tenant_id
    LEFT JOIN kostenstellen_energie_monat kem
      ON kem.kostenstelle_id = ks_bridge.id
     AND kem.monat = date_trunc('month', zb.start_zeit)::date
     AND kem.tenant_id = 'galvanik-kreile'
    WHERE zb.auftrag_id = o.id
      AND zb.tenant_id = 'galvanik-kreile'
  ), 0) AS energie_anteil_kosten,
  -- Berechnete Felder
  COALESCE((
    SELECT SUM(ar.netto) FROM ausgangsrechnung ar
    WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id = 'galvanik-kreile'
  ), 0)
  - COALESCE((SELECT SUM(abs(sm.quantity) * COALESCE(sm.snapshot_einkaufspreis_eur, 0))
              FROM stock_movements sm WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch' AND sm.tenant_id = 'galvanik-kreile'), 0)
  - COALESCE((SELECT SUM(zb.dauer_minuten / 60.0 * zb.kostensatz_eur_pro_stunde)
              FROM arbeitszeit_buchung zb WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'), 0)
  - COALESCE((SELECT SUM(zb.dauer_minuten / 60.0 * COALESCE(kem.energie_eur_pro_stunde, 0))
              FROM arbeitszeit_buchung zb
              LEFT JOIN kostenstelle ks_bridge
                ON ks_bridge.kuerzel = zb.kostenstelle_kuerzel AND ks_bridge.tenant_id = zb.tenant_id
              LEFT JOIN kostenstellen_energie_monat kem
                ON kem.kostenstelle_id = ks_bridge.id
               AND kem.monat = date_trunc('month', zb.start_zeit)::date
               AND kem.tenant_id = 'galvanik-kreile'
              WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'), 0)
  AS deckungsbeitrag,
  -- DB-Marge
  CASE WHEN COALESCE((SELECT SUM(ar.netto) FROM ausgangsrechnung ar
    WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id = 'galvanik-kreile'), 0) > 0
  THEN (
    COALESCE((SELECT SUM(ar.netto) FROM ausgangsrechnung ar
      WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id = 'galvanik-kreile'), 0)
    - COALESCE((SELECT SUM(abs(sm.quantity) * COALESCE(sm.snapshot_einkaufspreis_eur, 0))
                FROM stock_movements sm WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch' AND sm.tenant_id = 'galvanik-kreile'), 0)
    - COALESCE((SELECT SUM(zb.dauer_minuten / 60.0 * zb.kostensatz_eur_pro_stunde)
                FROM arbeitszeit_buchung zb WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'), 0)
    - COALESCE((SELECT SUM(zb.dauer_minuten / 60.0 * COALESCE(kem.energie_eur_pro_stunde, 0))
                FROM arbeitszeit_buchung zb
                LEFT JOIN kostenstelle ks_bridge
                  ON ks_bridge.kuerzel = zb.kostenstelle_kuerzel AND ks_bridge.tenant_id = zb.tenant_id
                LEFT JOIN kostenstellen_energie_monat kem
                  ON kem.kostenstelle_id = ks_bridge.id
                 AND kem.monat = date_trunc('month', zb.start_zeit)::date
                 AND kem.tenant_id = 'galvanik-kreile'
                WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'), 0)
  ) / NULLIF((SELECT SUM(ar.netto) FROM ausgangsrechnung ar
    WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id = 'galvanik-kreile'), 0)
  ELSE NULL END AS db_marge,
  -- Anzahl Buchungen (für Datenherkunfts-Zeile)
  (SELECT COUNT(*) FROM ausgangsrechnung ar WHERE ar.order_id = o.id AND ar.tenant_id = 'galvanik-kreile') AS anz_rechnungen,
  (SELECT COUNT(*) FROM stock_movements sm WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch' AND sm.tenant_id = 'galvanik-kreile') AS anz_verbrauch,
  (SELECT COUNT(*) FROM arbeitszeit_buchung zb WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile') AS anz_zeitbuchungen
FROM v_production_orders o
LEFT JOIN customers c ON c.id = o.customer_id

-- 6. v_analyse_werkstatt_puls_economics
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

FROM v_production_orders o
LEFT JOIN customers c ON c.id = o.customer_id
LEFT JOIN order_financials ofi ON ofi.order_id = o.id
LEFT JOIN v_auftrag_db vdb ON vdb.order_id = o.id
LEFT JOIN (
  SELECT ar.order_id, SUM(ar.netto) AS netto_sum
  FROM ausgangsrechnung ar
  WHERE (ar.is_demo IS NULL OR ar.is_demo = false)
    AND ar.tenant_id = 'galvanik-kreile'
  GROUP BY ar.order_id
) ar_sum ON ar_sum.order_id = o.id
LEFT JOIN (
  SELECT oce.order_id, SUM(oce.amount_eur) AS actual_delay_cost_eur
  FROM order_cost_events oce
  WHERE oce.caused_by IN ('delay', 'engpass', 'terminrettung')
    AND oce.tenant_id = 'galvanik-kreile'
  GROUP BY oce.order_id
) oce_sum ON oce_sum.order_id = o.id
LEFT JOIN kpi_cost_assumptions kca_delay
  ON kca_delay.key = 'delay_cost_per_day_eur'
 AND kca_delay.is_active = true
 AND kca_delay.tenant_id = o.tenant_id
WHERE COALESCE(o.status, '') NOT IN ('closed', 'abgeschlossen', 'cancelled', 'storniert')

-- 7. v_analyse_kunden_kpi
CREATE OR REPLACE VIEW v_analyse_kunden_kpi AS
SELECT
  c.id AS customer_id,
  coalesce(c.company_name, c.name) AS kunde,
  c.classification,
  c.created_at AS kunde_seit,
  -- Umsatz LTV
  coalesce((
    SELECT sum(ar.brutto) FROM ausgangsrechnung ar
    JOIN v_production_orders o ON o.id = ar.order_id
    WHERE o.customer_id = c.id AND ar.status != 'storniert'
      AND ar.tenant_id = 'galvanik-kreile'
  ), 0) AS umsatz_ltv,
  -- Gewinn LTV (Erlös − Material − Arbeitszeit)
  coalesce((
    SELECT sum(i.preis_netto) FROM items i
    JOIN v_production_orders o ON o.id = i.order_id WHERE o.customer_id = c.id
      AND i.tenant_id = 'galvanik-kreile'
  ), 0)
  - coalesce((
    SELECT sum(cu.quantity * cu.unit_cost_eur) FROM consumable_uses cu
    JOIN v_production_orders o ON o.id = cu.order_id WHERE o.customer_id = c.id
      AND cu.tenant_id = 'galvanik-kreile'
  ), 0)
  - coalesce((
    SELECT sum(az.dauer_minuten / 60.0 * az.kostensatz_eur_pro_stunde) FROM arbeitszeit_buchung az
    JOIN v_production_orders o ON o.id = az.auftrag_id WHERE o.customer_id = c.id
      AND az.tenant_id = 'galvanik-kreile'
  ), 0) AS gewinn_ltv,
  -- Offene Posten
  coalesce((
    SELECT sum(ar.brutto) FROM ausgangsrechnung ar
    JOIN v_production_orders o ON o.id = ar.order_id
    WHERE o.customer_id = c.id AND ar.bezahlt_am IS NULL AND ar.status NOT IN ('storniert', 'bezahlt')
      AND ar.tenant_id = 'galvanik-kreile'
  ), 0) AS offene_posten,
  -- Aktive Aufträge
  (SELECT count(*) FROM v_production_orders o WHERE o.customer_id = c.id AND o.status NOT IN ('abgeschlossen', 'storniert')) AS aktive_auftraege,
  -- Pünktlichkeit
  CASE WHEN (SELECT count(*) FROM v_production_orders o WHERE o.customer_id = c.id AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL) > 0
    THEN round(
      (SELECT count(*) FROM v_production_orders o WHERE o.customer_id = c.id AND o.completed_date <= o.promised_due_date AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL)
      * 100.0
      / (SELECT count(*) FROM v_production_orders o WHERE o.customer_id = c.id AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL)
    , 1)
    ELSE NULL
  END AS puenklichkeit_pct,
  -- Reklamationen
  coalesce((SELECT count(*) FROM complaints co JOIN v_production_orders o ON o.id = co.order_id WHERE o.customer_id = c.id AND co.tenant_id = 'galvanik-kreile'), 0) AS reklamationen
FROM customers c
WHERE c.tenant_id = 'galvanik-kreile'

-- 8. v_engpass
CREATE OR REPLACE VIEW v_engpass AS
SELECT
  ks.id AS kostenstelle_id,
  ks.kuerzel,
  ks.name,
  ks.typ,
  -- Aufträge die aktuell auf dieser Station stehen
  (SELECT COUNT(*) FROM v_production_orders o
   WHERE o.current_station = ks.kuerzel
     AND o.status NOT IN ('completed','abgeschlossen','cancelled','storniert')
  ) AS warteschlange_aktuell,
  -- Durchschnittliche Verweildauer der letzten 30 Tage
  (SELECT AVG(zb.dauer_minuten / 60.0)
   FROM arbeitszeit_buchung zb
   WHERE zb.kostenstelle_kuerzel = ks.kuerzel
     AND zb.start_zeit > NOW() - INTERVAL '30 days'
     AND zb.tenant_id = ks.tenant_id
  ) AS avg_stunden_pro_auftrag_30d,
  -- Aktuelle Monatsauslastung
  (SELECT COALESCE(SUM(zb.dauer_minuten), 0) / 60.0
   FROM arbeitszeit_buchung zb
   WHERE zb.kostenstelle_kuerzel = ks.kuerzel
     AND date_trunc('month', zb.start_zeit) = date_trunc('month', NOW())
     AND zb.tenant_id = ks.tenant_id
  ) AS gebuchte_stunden_aktuell,
  ks.verfuegbare_stunden_monatlich,
  CASE WHEN COALESCE(ks.verfuegbare_stunden_monatlich, 0) > 0
    THEN (SELECT COALESCE(SUM(zb.dauer_minuten), 0) / 60.0
          FROM arbeitszeit_buchung zb
          WHERE zb.kostenstelle_kuerzel = ks.kuerzel
            AND date_trunc('month', zb.start_zeit) = date_trunc('month', NOW())
            AND zb.tenant_id = ks.tenant_id
         ) / ks.verfuegbare_stunden_monatlich
    ELSE NULL END AS auslastung_quote,
  -- Engpass-Score (0..1)
  LEAST(1.0, GREATEST(0,
    CASE WHEN COALESCE(ks.verfuegbare_stunden_monatlich, 0) > 0
      THEN (SELECT COALESCE(SUM(zb.dauer_minuten), 0) / 60.0
            FROM arbeitszeit_buchung zb
            WHERE zb.kostenstelle_kuerzel = ks.kuerzel
              AND date_trunc('month', zb.start_zeit) = date_trunc('month', NOW())
              AND zb.tenant_id = ks.tenant_id
           ) / ks.verfuegbare_stunden_monatlich
      ELSE 0 END
  )) AS engpass_score
FROM kostenstelle ks
WHERE ks.typ = 'produktion' AND ks.tenant_id = 'galvanik-kreile'

-- 9. v_periodenabschluss_status
CREATE OR REPLACE VIEW v_periodenabschluss_status AS
SELECT
  p.id,
  p.jahr,
  p.monat,
  p.status,
  p.geschlossen_am,
  -- Belege ohne Konto
  (SELECT COUNT(*) FROM beleg b
   WHERE b.periode_id = p.id AND b.konto_id IS NULL) AS belege_ohne_konto,
  -- Belege ohne Kostenstelle
  (SELECT COUNT(*) FROM beleg b
   WHERE b.periode_id = p.id AND b.kostenstelle_id IS NULL) AS belege_ohne_kostenstelle,
  -- Rechnungen ohne Auftragszuordnung
  (SELECT COUNT(*) FROM ausgangsrechnung ar
   WHERE ar.periode_id = p.id AND ar.order_id IS NULL AND ar.tenant_id = p.tenant_id) AS rechnungen_ohne_auftrag,
  -- Rechnungen unbezahlt
  (SELECT COUNT(*) FROM ausgangsrechnung ar
   WHERE ar.periode_id = p.id AND ar.bezahlt_am IS NULL AND ar.tenant_id = p.tenant_id) AS rechnungen_offen,
  -- Aufträge mit Abschluss im Monat aber ohne DB
  (SELECT COUNT(*) FROM v_production_orders o
   WHERE o.status IN ('completed','abgeschlossen')
     AND date_trunc('month', o.due_date) = make_date(p.jahr, p.monat, 1)
     AND o.db_ist IS NULL) AS auftraege_ohne_db
FROM periode p
WHERE p.tenant_id = 'galvanik-kreile'

-- 10. v_kunde_clv
CREATE OR REPLACE VIEW v_kunde_clv AS
SELECT
  c.id AS customer_id,
  c.name,
  c.company_name,
  c.type AS kundentyp,
  c.created_at AS erstkontakt,
  COUNT(DISTINCT o.id) AS auftraege_gesamt,
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.intake_date > NOW() - INTERVAL '12 months'
  ) AS auftraege_12m,
  COALESCE(SUM(vdb.erloes_netto), 0) AS umsatz_gesamt,
  COALESCE(SUM(vdb.deckungsbeitrag), 0) AS db_gesamt,
  CASE WHEN COALESCE(SUM(vdb.erloes_netto), 0) > 0
    THEN SUM(vdb.deckungsbeitrag) / SUM(vdb.erloes_netto)
    ELSE NULL END AS db_marge,
  MAX(o.intake_date) AS letzter_auftrag,
  (SELECT COUNT(*) FROM complaints cpl WHERE cpl.customer_id = c.id AND cpl.tenant_id = 'galvanik-kreile')
    AS reklamationen, -- Note: spelling is kept as original columns
  -- Durchschnittliche Durchlaufzeit (Eingang bis letzte Zeitbuchung)
  AVG(EXTRACT(EPOCH FROM (
    (SELECT MAX(zb.start_zeit) FROM arbeitszeit_buchung zb WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile')
    - o.intake_date::timestamptz
  )) / 86400.0)::numeric(8,1) AS avg_durchlauf_tage,
  -- Zahlungsmoral
  AVG(ar.bezahlt_am - ar.faellig_am)::numeric(8,1) AS avg_zahlungsverzug_tage
FROM customers c
LEFT JOIN v_production_orders o ON o.customer_id = c.id
LEFT JOIN v_auftrag_db vdb ON vdb.order_id = o.id
LEFT JOIN ausgangsrechnung ar ON ar.order_id = o.id
  AND (ar.is_demo IS NULL OR ar.is_demo = false)
  AND ar.tenant_id = 'galvanik-kreile'
WHERE c.tenant_id = 'galvanik-kreile'
GROUP BY c.id, c.name, c.company_name, c.type, c.created_at

-- 11. v_monatsergebnis
CREATE OR REPLACE VIEW v_monatsergebnis AS
WITH erloes AS (
  SELECT date_trunc('month', ar.datum)::date AS monat,
         SUM(ar.netto) AS summe
  FROM ausgangsrechnung ar
  WHERE (ar.is_demo IS NULL OR ar.is_demo = false)
    AND ar.tenant_id = 'galvanik-kreile'
  GROUP BY 1
),
material AS (
  SELECT date_trunc('month', b.erstellt_am)::date AS monat,
         SUM(b.netto) AS summe
  FROM beleg b
  LEFT JOIN konto k ON k.id = b.konto_id
  WHERE k.kategorie = 'wareneinsatz'
    AND k.tenant_id = 'galvanik-kreile'
  GROUP BY 1
),
personal AS (
  SELECT date_trunc('month', zb.start_zeit)::date AS monat,
         SUM(zb.dauer_minuten / 60.0 * zb.kostensatz_eur_pro_stunde) AS summe
  FROM arbeitszeit_buchung zb
  WHERE zb.tenant_id = 'galvanik-kreile'
  GROUP BY 1
),
energie AS (
  SELECT date_trunc('month', b.erstellt_am)::date AS monat,
         SUM(b.netto) AS summe
  FROM beleg b
  LEFT JOIN konto k ON k.id = b.konto_id
  WHERE k.kategorie = 'energie'
    AND k.tenant_id = 'galvanik-kreile'
  GROUP BY 1
),
sachkosten AS (
  SELECT date_trunc('month', b.erstellt_am)::date AS monat,
         SUM(b.netto) AS summe
  FROM beleg b
  LEFT JOIN konto k ON k.id = b.konto_id
  WHERE k.kategorie = 'sachkosten'
    AND k.tenant_id = 'galvanik-kreile'
  GROUP BY 1
),
alle_monate AS (
  SELECT monat FROM erloes
  UNION SELECT monat FROM material
  UNION SELECT monat FROM personal
  UNION SELECT monat FROM energie
  UNION SELECT monat FROM sachkosten
)
SELECT
  am.monat,
  COALESCE(e.summe, 0) AS erloes_netto,
  COALESCE(m.summe, 0) AS material_kosten,
  COALESCE(p.summe, 0) AS personal_kosten,
  COALESCE(en.summe, 0) AS energie_kosten,
  COALESCE(s.summe, 0) AS sachkosten,
  COALESCE(e.summe, 0)
    - COALESCE(m.summe, 0)
    - COALESCE(p.summe, 0)
    - COALESCE(en.summe, 0)
    - COALESCE(s.summe, 0) AS ergebnis
FROM alle_monate am
LEFT JOIN erloes e ON e.monat = am.monat
LEFT JOIN material m ON m.monat = am.monat
LEFT JOIN personal p ON p.monat = am.monat
LEFT JOIN energie en ON en.monat = am.monat
LEFT JOIN sachkosten s ON s.monat = am.monat
ORDER BY am.monat DESC

-- 12. v_aging
CREATE OR REPLACE VIEW v_aging AS
SELECT
  ar.id,
  ar.nummer AS rechnungsnummer,
  ar.kunde_id AS customer_id,
  c.name AS kunde_name,
  c.company_name,
  ar.netto,
  ar.brutto,
  ar.faellig_am,
  ar.bezahlt_am,
  ar.mahnstufe,
  CASE
    WHEN ar.bezahlt_am IS NOT NULL THEN 'bezahlt'
    WHEN ar.faellig_am IS NULL THEN 'ohne_faelligkeit'
    WHEN NOW()::date <= ar.faellig_am THEN 'nicht_faellig'
    WHEN NOW()::date - ar.faellig_am <= 14 THEN '1-14'
    WHEN NOW()::date - ar.faellig_am <= 30 THEN '15-30'
    WHEN NOW()::date - ar.faellig_am <= 60 THEN '31-60'
    WHEN NOW()::date - ar.faellig_am <= 90 THEN '61-90'
    ELSE '>90'
  END AS aging_bucket,
  CASE WHEN ar.bezahlt_am IS NULL AND ar.faellig_am IS NOT NULL
    THEN GREATEST(0, NOW()::date - ar.faellig_am)
    ELSE NULL END AS tage_ueberfaellig
FROM ausgangsrechnung ar
LEFT JOIN customers c ON c.id = ar.kunde_id
WHERE (ar.is_demo IS NULL OR ar.is_demo = false)
  AND ar.tenant_id = 'galvanik-kreile'

NOTIFY pgrst, 'reload schema'
