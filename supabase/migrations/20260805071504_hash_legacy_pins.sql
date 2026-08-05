-- Convert legacy four-digit PIN values in-place. No PIN value leaves Postgres.
-- Existing bcrypt hashes and users without a tablet PIN remain untouched.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE pin_hash IS NOT NULL
      AND pin_hash !~ '^\$2[abxy]\$'
      AND pin_hash !~ '^[0-9]{4}$'
  ) THEN
    RAISE EXCEPTION 'Unexpected app_users.pin_hash format; legacy PIN migration aborted';
  END IF;

  UPDATE public.app_users
  SET pin_hash = extensions.crypt(
    pin_hash,
    extensions.gen_salt('bf', 12)
  )
  WHERE pin_hash ~ '^[0-9]{4}$';

  IF EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE pin_hash IS NOT NULL
      AND pin_hash !~ '^\$2[abxy]\$'
  ) THEN
    RAISE EXCEPTION 'Legacy PIN values remain after migration';
  END IF;
END
$$;
