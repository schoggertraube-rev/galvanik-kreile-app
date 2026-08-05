-- Migration: 20260622000001_view_werkstatt_puls.sql

-- A: Termintreue (aktuelle Woche)
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
FROM orders
WHERE tenant_id = 'galvanik-kreile'
  AND created_at >= date_trunc('week', now());


-- B: Durchlaufzeit gesamt (letzte 30 Tage, abgeschlossene Aufträge)
CREATE OR REPLACE VIEW v_analyse_durchlaufzeit AS
SELECT
  round(avg(EXTRACT(EPOCH FROM (completed_date - created_at)) / 86400.0)::numeric, 1)
    AS avg_tage,
  count(*) AS n
FROM orders
WHERE tenant_id = 'galvanik-kreile'
  AND completed_date IS NOT NULL
  AND completed_date >= now() - interval '30 days';


-- C: Durchlaufzeit pro Station (Events-basiert)
CREATE OR REPLACE VIEW v_analyse_station_durchlauf AS
WITH eingang AS (
  SELECT order_id, station, MIN(created_at) AS ts_ein
  FROM events
  WHERE event_type = 'STATION_EINGANG' AND station IS NOT NULL
  GROUP BY order_id, station
),
ausgang AS (
  SELECT order_id, station, MAX(created_at) AS ts_aus
  FROM events
  WHERE event_type = 'STATION_AUSGANG' AND station IS NOT NULL
  GROUP BY order_id, station
)
SELECT
  e.station,
  round(avg(EXTRACT(EPOCH FROM (a.ts_aus - e.ts_ein)) / 86400.0)::numeric, 1) AS avg_tage,
  count(*) AS n,
  -- Engpass-Info: wie viele aktuell IN dieser Station (kein Ausgang)
  (SELECT count(*) FROM items WHERE current_station_id = e.station) AS teile_aktuell
FROM eingang e
JOIN ausgang a ON a.order_id = e.order_id AND a.station = e.station
WHERE e.ts_ein >= now() - interval '30 days'
GROUP BY e.station;


-- D: Wochenziel (abgeschlossene Aufträge diese Woche)
CREATE OR REPLACE VIEW v_analyse_wochenziel AS
SELECT
  count(*) AS fertig_diese_woche
FROM orders
WHERE tenant_id = 'galvanik-kreile'
  AND completed_date IS NOT NULL
  AND completed_date >= date_trunc('week', now());


-- E: Engpass-Heatmap (Teile pro Station JETZT)
CREATE OR REPLACE VIEW v_analyse_engpass AS
SELECT
  current_station_id AS station,
  count(*) AS teile_wartend
FROM items
WHERE current_station_id IS NOT NULL
GROUP BY current_station_id
ORDER BY teile_wartend DESC;
