-- 0001 already creates the historical inquiries relation. Keep this migration
-- additive so a fresh database receives the richer quote-request contract
-- without attempting to replace the relation (and its existing FKs/policies).
CREATE TABLE IF NOT EXISTS inquiries (
  id            text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  tenant_id     text NOT NULL DEFAULT 'galvanik-kreile',
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

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT 'galvanik-kreile',
  ADD COLUMN IF NOT EXISTS dirt_level text,
  ADD COLUMN IF NOT EXISTS part_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS material text DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo text;

UPDATE inquiries
SET tenant_id = COALESCE(NULLIF(btrim(tenant_id), ''), 'galvanik-kreile'),
    subject = COALESCE(subject, ''),
    description = COALESCE(description, ''),
    part_count = COALESCE(part_count, 1),
    material = COALESCE(material, ''),
    status = COALESCE(status, 'offen');

ALTER TABLE inquiries
  ALTER COLUMN tenant_id SET DEFAULT 'galvanik-kreile',
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN subject SET DEFAULT '',
  ALTER COLUMN subject SET NOT NULL,
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN part_count SET DEFAULT 1,
  ALTER COLUMN part_count SET NOT NULL,
  ALTER COLUMN material SET DEFAULT '',
  ALTER COLUMN material SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'offen',
  ALTER COLUMN status SET NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass
      AND conname = 'inquiries_rust_level_chk'
  ) THEN
    ALTER TABLE inquiries
      ADD CONSTRAINT inquiries_rust_level_chk
      CHECK (rust_level IS NULL OR rust_level IN ('Leicht','Mittel','Stark','Sehr stark'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass
      AND conname = 'inquiries_dirt_level_chk'
  ) THEN
    ALTER TABLE inquiries
      ADD CONSTRAINT inquiries_dirt_level_chk
      CHECK (dirt_level IS NULL OR dirt_level IN ('Sauber','Leicht','Stark'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inquiries'::regclass
      AND conname = 'inquiries_status_chk'
  ) THEN
    ALTER TABLE inquiries
      ADD CONSTRAINT inquiries_status_chk
      CHECK (status IN ('offen','angeboten','archiviert','angenommen','abgelehnt'));
  END IF;
END
$constraints$;

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_tenant_all_inquiries" ON inquiries
    FOR ALL
    TO public
    USING (tenant_id = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
