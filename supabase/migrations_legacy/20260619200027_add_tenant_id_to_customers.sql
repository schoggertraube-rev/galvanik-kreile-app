ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id varchar(50) DEFAULT 'galvanik-kreile' NOT NULL;
UPDATE customers SET tenant_id = 'galvanik-kreile' WHERE tenant_id IS NULL;
