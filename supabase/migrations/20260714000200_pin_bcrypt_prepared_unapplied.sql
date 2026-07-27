-- APPROVAL REQUIRED - PREPARED, NOT APPLIED BY THIS MISSION.
-- IRREVERSIBLE: bcrypt hashing cannot restore plaintext PINs. Take an approved backup first.
-- Scope is intentionally limited to active four-digit plaintext-looking pin_hash values.
-- No RLS or policy changes.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.app_users
    WHERE pin_hash IS NOT NULL
      AND pin_hash !~ '^\$2[aby]\$[0-9]{2}\$'
      AND pin_hash !~ '^[0-9]{4}$'
  ) THEN
    RAISE EXCEPTION 'PIN_HASH_PREFLIGHT_FAILED: unexpected non-bcrypt/non-4-digit value';
  END IF;
END $$;

DO $pin_hash_upgrade$
DECLARE
  crypto_schema text;
BEGIN
  SELECT namespace.nspname
  INTO crypto_schema
  FROM pg_extension extension
  JOIN pg_namespace namespace ON namespace.oid = extension.extnamespace
  WHERE extension.extname = 'pgcrypto';

  IF crypto_schema IS NULL
     OR to_regprocedure(format('%I.crypt(text,text)', crypto_schema)) IS NULL
     OR to_regprocedure(format('%I.gen_salt(text,integer)', crypto_schema)) IS NULL THEN
    RAISE EXCEPTION 'PIN_HASH_PREFLIGHT_FAILED: pgcrypto functions are unavailable';
  END IF;

  EXECUTE format(
    'UPDATE public.app_users '
    'SET pin_hash = %1$I.crypt(pin_hash, %1$I.gen_salt(''bf'', 12)) '
    'WHERE pin_hash ~ ''^[0-9]{4}$''',
    crypto_schema
  );
END
$pin_hash_upgrade$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.app_users WHERE pin_hash ~ '^[0-9]{4}$') THEN
    RAISE EXCEPTION 'PIN_HASH_POSTCHECK_FAILED: plaintext PIN remains';
  END IF;
END $$;
