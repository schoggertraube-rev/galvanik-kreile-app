-- F2 K14: persist the complete per-login Der-Tag layout.
CREATE FUNCTION private.is_today_layout_v1(p_layout jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  WITH elements AS (
    SELECT value AS item, ordinality::integer - 1 AS expected_order
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_layout) = 'array' THEN p_layout ELSE '[]'::jsonb END) WITH ORDINALITY
  )
  SELECT
    jsonb_typeof(p_layout) = 'array'
    AND jsonb_array_length(p_layout) BETWEEN 1 AND 5
    AND (SELECT count(*) = jsonb_array_length(p_layout) FROM elements)
    AND (SELECT bool_and(
      jsonb_typeof(item) = 'object'
      AND (SELECT count(*) = 3 FROM jsonb_object_keys(item))
      AND item ?& ARRAY['field', 'column', 'order']
      AND item->>'field' IN ('action', 'today', 'assign', 'money', 'bundle')
      AND item->>'column' IN ('left', 'right')
      AND jsonb_typeof(item->'order') = 'number'
      AND (item->>'order') ~ '^[0-9]+$'
      AND (item->>'order')::integer = expected_order
    ) FROM elements)
    AND (SELECT count(DISTINCT item->>'field') = count(*) FROM elements)
    AND (SELECT item->>'field' = 'action' FROM elements WHERE expected_order = 0);
$$;

REVOKE ALL ON FUNCTION private.is_today_layout_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_today_layout_v1(jsonb) TO service_role;

ALTER TABLE private.today_preferences
  ADD COLUMN layout jsonb,
  ADD CONSTRAINT today_preferences_layout_v1_chk
    CHECK (layout IS NULL OR private.is_today_layout_v1(layout));

COMMENT ON COLUMN private.today_preferences.layout IS
  'F2 complete per-login layout: field, left/right column, and global order. NULL uses the role template.';
