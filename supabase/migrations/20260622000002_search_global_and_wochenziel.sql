-- Migration: 20260622000002_search_global_and_wochenziel.sql

-- 1. Add wochenziel to company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS wochenziel integer DEFAULT 25

-- 2. Create search_global function
CREATE OR REPLACE FUNCTION search_global(query text)
RETURNS TABLE (typ text, id text, label text, sublabel text) AS $$
  SELECT 'auftrag' AS typ, id, order_number AS label, title AS sublabel
  FROM orders
  WHERE order_number ILIKE '%' || query || '%' OR title ILIKE '%' || query || '%'

  UNION ALL

  SELECT 'kunde' AS typ, id, coalesce(company_name, name) AS label, email AS sublabel
  FROM customers
  WHERE company_name ILIKE '%' || query || '%'
     OR name ILIKE '%' || query || '%'
     OR email ILIKE '%' || query || '%'

  UNION ALL

  SELECT 'teil' AS typ, id, name AS label, material AS sublabel
  FROM items
  WHERE name ILIKE '%' || query || '%' OR material ILIKE '%' || query || '%'

  LIMIT 20;
$$ LANGUAGE sql STABLE
