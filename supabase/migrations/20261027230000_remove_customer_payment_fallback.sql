-- Legacy customers without an explicit payment agreement must remain undecided.
ALTER TABLE public.customers
  ALTER COLUMN payment_preference DROP DEFAULT;
