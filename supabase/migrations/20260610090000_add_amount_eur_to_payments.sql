-- 20260610090000_add_amount_eur_to_payments.sql
-- Add missing amount_eur column to payments table

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS amount_eur numeric(10,2);

-- Optionally copy data from existing amount column if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='amount') THEN
    UPDATE payments SET amount_eur = amount;
    ALTER TABLE payments DROP COLUMN amount;
  END IF;
END $$;
