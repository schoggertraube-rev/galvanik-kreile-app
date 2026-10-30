-- F2: personal "Der Tag" preferences and reminders. Private, tenant and actor bound.
CREATE TABLE private.today_preferences (
  tenant_id text NOT NULL,
  actor_id uuid NOT NULL,
  visible_fields text[] NOT NULL DEFAULT ARRAY['today', 'assign', 'money', 'bundle']::text[],
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (tenant_id, actor_id),
  FOREIGN KEY (tenant_id, actor_id) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT,
  CHECK (visible_fields <@ ARRAY['today', 'assign', 'money', 'bundle']::text[])
);

CREATE TABLE private.today_reminders (
  tenant_id text NOT NULL,
  actor_id uuid NOT NULL,
  item_key text NOT NULL,
  reminder_until timestamptz NOT NULL,
  reminder_mode text NOT NULL CHECK (reminder_mode IN ('afternoon', 'tomorrow', 'after_due')),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (tenant_id, actor_id, item_key),
  FOREIGN KEY (tenant_id, actor_id) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT,
  CHECK (item_key = btrim(item_key) AND length(item_key) BETWEEN 3 AND 300)
);

REVOKE ALL ON TABLE private.today_preferences, private.today_reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE private.today_preferences, private.today_reminders TO service_role;

COMMENT ON TABLE private.today_preferences IS 'F2 visible Der-Tag fields per tenant login.';
COMMENT ON TABLE private.today_reminders IS 'F2 per-login reminders; items remain counted and visible with their reminder time.';
