-- Add image_urls and customer_number to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_number text UNIQUE;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip_code text;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name text;

-- Populate existing customers with a legacy customer number if they don't have one
UPDATE customers SET customer_number = 'K-LEGACY-' || id WHERE customer_number IS NULL;
