-- Bound private scan/photo uploads at the storage service, not only in browser code.
UPDATE storage.buckets
SET
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
WHERE id = 'scans';

DO $$
DECLARE
  configured_limit bigint;
  configured_mime_types text[];
BEGIN
  SELECT file_size_limit, allowed_mime_types
  INTO configured_limit, configured_mime_types
  FROM storage.buckets
  WHERE id = 'scans';

  IF configured_limit IS DISTINCT FROM 20971520 THEN
    RAISE EXCEPTION 'scans bucket file-size limit is not 20 MiB';
  END IF;

  IF configured_mime_types IS DISTINCT FROM ARRAY[
    'application/pdf',
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[] THEN
    RAISE EXCEPTION 'scans bucket MIME allowlist is wrong';
  END IF;
END
$$;
