-- FOUNDATION_PRODUCTION_BASELINE_001
-- Non-personal configuration required after the schema-only baseline.
-- Values were read-only verified against Production project syhaigjhsbpjmtnggqka.
-- No storage objects, auth users, customer/order/PIN/financial rows, demo data,
-- or KPI snapshots are copied.

INSERT INTO "storage"."buckets" (
  "id",
  "name",
  "public",
  "file_size_limit",
  "allowed_mime_types"
)
VALUES
  (
    'belege',
    'belege',
    true,
    5242880,
    ARRAY['image/png', 'image/jpeg', 'application/pdf']::text[]
  ),
  (
    'buchhaltung-belege',
    'buchhaltung-belege',
    false,
    NULL,
    NULL
  ),
  (
    'item-photos',
    'item-photos',
    false,
    NULL,
    NULL
  ),
  (
    'scans',
    'scans',
    false,
    20971520,
    ARRAY[
      'application/pdf',
      'image/heic',
      'image/heif',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
  )
ON CONFLICT ("id") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "public" = EXCLUDED."public",
  "file_size_limit" = EXCLUDED."file_size_limit",
  "allowed_mime_types" = EXCLUDED."allowed_mime_types";
