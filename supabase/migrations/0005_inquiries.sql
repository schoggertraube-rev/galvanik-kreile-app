-- Fresh-replay reconciliation: migration 0001 creates the legacy table and
-- migration 0002 attaches policies to it. No seed data exists at this point.
-- Production already records 0005 as applied, so this replacement is never
-- executed against the live relation.
DROP TABLE IF EXISTS public.inquiries;

CREATE TABLE inquiries (
  id            text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  tenant_id     text NOT NULL,
  customer_id   text REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  subject       text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  received_at   timestamptz NOT NULL DEFAULT now(),
  rust_level    text CHECK (rust_level IN ('Leicht','Mittel','Stark','Sehr stark')),
  dirt_level    text CHECK (dirt_level IN ('Sauber','Leicht','Stark')),
  part_count    integer NOT NULL DEFAULT 1,
  material      text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'offen'
                CHECK (status IN ('offen','angeboten','archiviert','angenommen','abgelehnt')),
  photo         text,
  pricing       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_tenant_all_inquiries" ON inquiries
    FOR ALL
    TO public
    USING (tenant_id = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
