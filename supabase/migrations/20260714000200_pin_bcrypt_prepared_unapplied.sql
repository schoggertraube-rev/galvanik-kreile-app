-- APPROVAL REQUIRED - PREPARED, NOT APPLIED BY THIS MISSION.
-- IRREVERSIBLE: bcrypt hashing cannot restore plaintext PINs. Take an approved backup first.
-- Scope is intentionally limited to active four-digit plaintext-looking pin_hash values.
-- No RLS or policy changes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

UPDATE public.app_users
SET pin_hash = crypt(pin_hash, gen_salt('bf', 12))
WHERE pin_hash ~ '^[0-9]{4}$';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.app_users WHERE pin_hash ~ '^[0-9]{4}$') THEN
    RAISE EXCEPTION 'PIN_HASH_POSTCHECK_FAILED: plaintext PIN remains';
  END IF;
END $$;

COMMIT;
