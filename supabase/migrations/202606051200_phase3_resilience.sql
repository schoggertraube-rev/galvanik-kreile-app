-- Phase 3: Resilience, Order Profitability & Marketing Reactivation

-- 1. Extend Customers
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "marketing_opt_out" boolean DEFAULT false;

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_reactivated_at" timestamp;

-- 2. Extend Events
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "payload" jsonb;

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'success';

-- 3. Offline Outbox
CREATE TABLE IF NOT EXISTS "offline_outbox" (
  "id" text PRIMARY KEY,
  "tenant_id" varchar(50) NOT NULL DEFAULT 'galvanik-kreile',
  "mutation_type" varchar(100) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'pending',
  "retry_count" integer DEFAULT 0,
  "last_error" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "processed_at" timestamp
);

ALTER TABLE "offline_outbox" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON "offline_outbox";

CREATE POLICY "Enable all for authenticated users" ON "offline_outbox" FOR ALL TO authenticated USING (true);

-- 4. Order Cost Positions
CREATE TABLE IF NOT EXISTS "order_cost_positions" (
  "id" text PRIMARY KEY,
  "tenant_id" varchar(50) NOT NULL DEFAULT 'galvanik-kreile',
  "order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "type" varchar(50) NOT NULL,
  "description" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "order_cost_positions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON "order_cost_positions";

CREATE POLICY "Enable all for authenticated users" ON "order_cost_positions" FOR ALL TO authenticated USING (true);

-- 5. Communication Drafts
CREATE TABLE IF NOT EXISTS "communication_drafts" (
  "id" text PRIMARY KEY,
  "tenant_id" varchar(50) NOT NULL DEFAULT 'galvanik-kreile',
  "customer_id" text NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "type" varchar(50) NOT NULL DEFAULT 'reactivation',
  "status" varchar(50) NOT NULL DEFAULT 'draft',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "communication_drafts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON "communication_drafts";

CREATE POLICY "Enable all for authenticated users" ON "communication_drafts" FOR ALL TO authenticated USING (true);
