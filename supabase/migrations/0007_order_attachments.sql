-- Add attachment_url to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS attachment_url text
