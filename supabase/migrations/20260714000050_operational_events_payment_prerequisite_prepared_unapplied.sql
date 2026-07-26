-- PREPARED, NOT REMOTELY APPLIED.
-- Payment RPCs defined by the next migration append audit events. Establish
-- their closed source relation first so no deployed function can point at a
-- relation that does not exist yet. The full append-only boundary follows in
-- 20260715001150 and 20260715001200.

BEGIN;

CREATE TABLE IF NOT EXISTS public.events (
  id text PRIMARY KEY,
  tenant_id varchar(50) NOT NULL DEFAULT 'galvanik-kreile',
  client_event_id uuid,
  order_id text NOT NULL,
  item_id text,
  event_type varchar(100) NOT NULL,
  description text,
  notes text,
  payload jsonb,
  status varchar(50) NOT NULL DEFAULT 'success',
  user_id uuid,
  worker_id varchar(100),
  station text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT events_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT,
  CONSTRAINT events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.app_users(id)
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.events
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
