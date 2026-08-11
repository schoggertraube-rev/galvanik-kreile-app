ALTER TABLE public.orders
  ADD COLUMN version integer NOT NULL DEFAULT 1;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_version_positive CHECK (version > 0);

COMMENT ON COLUMN public.orders.version IS
  'Optimistic-lock version for server-side order commands.';
