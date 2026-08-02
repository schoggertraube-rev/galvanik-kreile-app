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

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scan_uploads'
      AND column_name = 'upload_claim_token'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scan_uploads'
      AND column_name = 'upload_claimed_at'
  ) THEN
    RAISE EXCEPTION 'scan upload cleanup lease columns are missing';
  END IF;
END
$$;

SELECT 'PASS: order photo storage boundary' AS result;
