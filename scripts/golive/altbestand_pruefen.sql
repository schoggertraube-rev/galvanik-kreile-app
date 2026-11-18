-- S47b Nr. 7, PL 18.11.04:07: read only; no repair or constraint change.
-- The actual CHECK is s13k_orders_station_combination (NOT VALID).
-- Inspect the explicitly requested legacy values, not every possible CHECK failure.
-- Real inspection: BEGIN READ ONLY; SET LOCAL search_path TO public;
-- execute this file on that same connection, then ROLLBACK.
-- Only isolated TEST fixtures use pg_temp first, with the same unchanged query.
SELECT 'orders_legacy_station' AS pruefung,
       count(*)::bigint AS anzahl,
       COALESCE(jsonb_agg(jsonb_build_object(
         'id', id, 'tenant_id', tenant_id, 'status', status, 'station', station
       ) ORDER BY tenant_id, id), '[]'::jsonb) AS treffer
FROM orders
WHERE status IN ('in_progress', 'completed')
   OR station IN ('wareneingang', 'versendet')
UNION ALL
SELECT 'complaints_stand_null' AS pruefung,
       count(*)::bigint AS anzahl,
       COALESCE(jsonb_agg(jsonb_build_object(
         'id', id, 'tenant_id', tenant_id
       ) ORDER BY tenant_id, id), '[]'::jsonb) AS treffer
FROM complaints
WHERE stand IS NULL;

-- S54o A16, PL18Nov14:03. Count only: no invoice contents leave this gate.
-- A missing/invalid version is not silently treated as a current original.
DO $s54o_live_gate$
DECLARE old_count bigint;
BEGIN
  SELECT count(*) INTO old_count FROM invoices
  WHERE CASE WHEN jsonb_typeof(snapshot->'schemaVersion')='number'
    THEN (snapshot->>'schemaVersion')::numeric<3 ELSE true END;
  RAISE NOTICE 'invoices_snapshot_before_v3: %',old_count;
  IF old_count>0 THEN
    RAISE EXCEPTION 'LIVEGANG_STOP_RECHNUNGEN_VOR_V3: %',old_count;
  END IF;
END
$s54o_live_gate$;
