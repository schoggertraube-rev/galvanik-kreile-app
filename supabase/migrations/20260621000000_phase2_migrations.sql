-- 1. Overlay Pflicht
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS promised_due_date timestamptz,
  ADD COLUMN IF NOT EXISTS intake_date timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_date timestamptz;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS station text;

CREATE TABLE IF NOT EXISTS communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  customer_id text,
  order_id text REFERENCES orders(id) ON DELETE CASCADE,
  subject text,
  body text,
  type text,
  channel_type text,
  resend_message_id text,
  status text DEFAULT 'queued',
  opened_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 2. Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject_template text NOT NULL,
  body_html_template text NOT NULL,
  body_text_template text,
  variables jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON email_templates(tenant_id);

-- 3. Items Restauration
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS repair_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS station_sequence jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- 4. Price Lines
CREATE TABLE IF NOT EXISTS price_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id text REFERENCES items(id) ON DELETE CASCADE,
  position_text text NOT NULL,
  qty numeric(10,2) DEFAULT 1,
  unit_price_eur numeric(10,2) NOT NULL,
  unit_total_eur numeric(10,2) GENERATED ALWAYS AS (qty * unit_price_eur) STORED,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_lines_order ON price_lines(order_id);

CREATE INDEX IF NOT EXISTS idx_price_lines_item ON price_lines(item_id);

-- 5. Payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  amount_eur numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_intent_id text,
  ADD COLUMN IF NOT EXISTS mollie_status text,
  ADD COLUMN IF NOT EXISTS mollie_method text,
  ADD COLUMN IF NOT EXISTS receipt_url text;

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE INDEX IF NOT EXISTS idx_payments_intent ON payments(provider_intent_id);

-- 6. Payments RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_all" ON payments FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE price_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_lines_all" ON price_lines FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_all" ON email_templates FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. Ausgangsrechnung Payment
ALTER TABLE ausgangsrechnung
  ADD COLUMN IF NOT EXISTS bezahlt_am timestamptz,
  ADD COLUMN IF NOT EXISTS bezahlt_methode text,
  ADD COLUMN IF NOT EXISTS bezahlt_betrag_eur numeric(10,2),
  ADD COLUMN IF NOT EXISTS bezahlt_payment_id uuid REFERENCES payments(id) ON DELETE SET NULL;

-- 8. Company Settings Workflow Templates
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS workflow_templates jsonb DEFAULT '{}'::jsonb;

UPDATE company_settings
SET workflow_templates = '{
  "chrom_hochglanz": ["wareneingang", "entmetallisierung", "reparatur", "schleiferei_grob", "schleiferei_fein", "kupfer", "kupfer_schleifen", "nickel", "chrom", "politur", "nachpolitur", "qs", "warenausgang"],
  "vernickeln": ["wareneingang", "entmetallisierung", "reparatur", "schleiferei_grob", "schleiferei_fein", "nickel", "qs", "warenausgang"],
  "bruenieren": ["wareneingang", "entmetallisierung", "reparatur", "schleiferei_grob", "bruenieren", "qs", "warenausgang"],
  "verzinken": ["wareneingang", "entmetallisierung", "reparatur", "schleiferei_grob", "verzinken", "qs", "warenausgang"]
}'::jsonb
WHERE tenant_id = 'galvanik-kreile';
